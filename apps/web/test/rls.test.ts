// Runs the real migrations (supabase/migrations/*.sql, in order) in an in-process Postgres (PGlite) with a
// stand-in for Supabase's auth schema, and checks the privacy rules: a user can only see and change their own rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const migration = (name: string) => readFileSync(join(__dirname, "..", "..", "..", "supabase", "migrations", name), "utf8");
const MIGRATIONS = ["0001_accounts.sql", "0002_workouts.sql", "0003_debrief_log.sql", "0004_profile_tailoring.sql"].map(migration);

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

let db: PGlite;

/** Runs sql as a signed-in user (role authenticated, auth.uid() = id), or as anon when id is null. */
async function as<T = Record<string, unknown>>(id: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${id ?? ""}', false); set role ${id === null ? "anon" : "authenticated"};`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

const profileSql = "insert into public.profiles (user_id, months_training, program, start_date, updated_at) values ($1, 3, '3-day', '2026-10-08', $2)";

beforeAll(async () => {
  db = new PGlite();
  // Minimal stand-ins for what Supabase provides.
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${ALICE}'), ('${BOB}');
  `);
  for (const m of MIGRATIONS) await db.exec(m);
});

describe("row-level security (M5 exit: a user can't read another user's rows)", () => {
  it("a user can create and read their own profile", async () => {
    await as(ALICE, profileSql, [ALICE, "2026-10-08T10:00:00Z"]);
    expect(await as(ALICE, "select user_id, program from public.profiles")).toEqual([{ user_id: ALICE, program: "3-day" }]);
  });

  it("another user sees nothing of it", async () => {
    expect(await as(BOB, "select * from public.profiles")).toEqual([]);
  });

  it("another user cannot create a row in someone else's name", async () => {
    await expect(as(BOB, profileSql, [ALICE, "2026-10-08T10:00:00Z"])).rejects.toThrow(/row-level security|duplicate key/);
    await expect(as(BOB, "insert into public.consents (id, user_id, consent_version, accepted_at) values (gen_random_uuid(), $1, 'v1', now())", [ALICE])).rejects.toThrow(/row-level security/);
  });

  it("another user cannot change or delete it", async () => {
    await as(BOB, "update public.profiles set months_training = 9 where user_id = $1", [ALICE]);
    await as(BOB, "delete from public.profiles where user_id = $1", [ALICE]).catch(() => undefined);
    expect(await as(ALICE, "select months_training from public.profiles")).toEqual([{ months_training: 3 }]);
  });

  it("signed-out visitors (anon) cannot read or write anything", async () => {
    await expect(as(null, "select * from public.profiles")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from public.consents")).rejects.toThrow(/permission denied/);
    await expect(as(null, profileSql, [BOB, "2026-10-08T10:00:00Z"])).rejects.toThrow(/permission denied/);
  });

  it("consents are private and append-only", async () => {
    const id = "aaaaaaaa-0000-0000-0000-000000000001";
    await as(ALICE, "insert into public.consents (id, user_id, consent_version, accepted_at) values ($1, $2, 'draft-1', '2026-10-08T10:00:00Z')", [id, ALICE]);
    expect(await as(BOB, "select * from public.consents")).toEqual([]);
    await expect(as(ALICE, "update public.consents set consent_version = 'x' where id = $1", [id])).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, "delete from public.consents where id = $1", [id])).rejects.toThrow(/permission denied/);
    expect(await as(ALICE, "select consent_version from public.consents")).toEqual([{ consent_version: "draft-1" }]);
  });

  it("retrying the same consent upload with the same id does not create a duplicate", async () => {
    const id = "aaaaaaaa-0000-0000-0000-000000000001";
    await as(ALICE, "insert into public.consents (id, user_id, consent_version, accepted_at) values ($1, $2, 'draft-1', '2026-10-08T10:00:00Z') on conflict (id) do nothing", [id, ALICE]);
    expect(await as(ALICE, "select count(*)::int as n from public.consents")).toEqual([{ n: 1 }]);
  });
});

describe("profile conflicts: newest write wins (DECISIONS S1)", () => {
  it("a newer update is applied", async () => {
    await as(ALICE, "update public.profiles set program = '4-day', updated_at = '2026-10-08T12:00:00Z' where user_id = $1", [ALICE]);
    expect(await as(ALICE, "select program from public.profiles")).toEqual([{ program: "4-day" }]);
  });

  it("a stale update from an offline phone is ignored", async () => {
    await as(ALICE, "update public.profiles set program = '3-day', months_training = 11, updated_at = '2026-10-08T11:00:00Z' where user_id = $1", [ALICE]);
    expect(await as(ALICE, "select program, months_training from public.profiles")).toEqual([{ program: "4-day", months_training: 3 }]);
  });

  it("values outside the allowed range are rejected", async () => {
    await expect(as(ALICE, "update public.profiles set months_training = 61, updated_at = '2026-10-08T13:00:00Z'")).rejects.toThrow(/check constraint/);
    await expect(as(ALICE, "update public.profiles set program = '5-day', updated_at = '2026-10-08T13:00:00Z'")).rejects.toThrow(/check constraint/);
  });
});

describe("account deletion", () => {
  it("removes the signed-in user and all of their rows, and nobody else's", async () => {
    await as(BOB, profileSql, [BOB, "2026-10-08T10:00:00Z"]);
    await as(ALICE, "select public.delete_my_account()");
    await db.exec("reset role");
    expect((await db.query("select id from auth.users")).rows).toEqual([{ id: BOB }]);
    expect((await db.query("select user_id from public.profiles")).rows).toEqual([{ user_id: BOB }]);
    expect((await db.query("select * from public.consents")).rows).toEqual([]);
  });

  it("is not available to signed-out visitors", async () => {
    await expect(as(null, "select public.delete_my_account()")).rejects.toThrow(/permission denied/);
  });

  it("does nothing for a caller with no user id", async () => {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false); set role authenticated;");
    await expect(db.query("select public.delete_my_account()")).rejects.toThrow(/not signed in/);
    await db.exec("reset role");
  });
});

const E1 = "eeeeeeee-0000-0000-0000-000000000001";
const eventSql = "insert into public.events (id, user_id, kind, occurred_at, data) values ($1, $2, 'session', '2026-10-08T10:00:00Z', '{\"slotKey\":\"A\"}')";
const ladderSql = "insert into public.ladders (user_id, exercise_id, loads_g, updated_at) values ($1, 'leg_press', '{5000,10000}', $2)";

describe("workout history and ladders (M6)", () => {
  beforeAll(async () => {
    await db.exec("insert into auth.users values ('33333333-3333-3333-3333-333333333333') on conflict do nothing");
  });
  const CARA = "33333333-3333-3333-3333-333333333333";

  it("a user can store and read their own workout and ladder", async () => {
    await as(CARA, eventSql, [E1, CARA]);
    await as(CARA, ladderSql, [CARA, "2026-10-08T10:00:00Z"]);
    expect(await as(CARA, "select id, kind from public.events")).toEqual([{ id: E1, kind: "session" }]);
    expect(await as(CARA, "select exercise_id, loads_g from public.ladders")).toEqual([{ exercise_id: "leg_press", loads_g: [5000, 10000] }]);
  });

  it("another user sees none of it and cannot write in their name", async () => {
    expect(await as(BOB, "select * from public.events")).toEqual([]);
    expect(await as(BOB, "select * from public.ladders")).toEqual([]);
    await expect(as(BOB, eventSql, ["eeeeeeee-0000-0000-0000-000000000002", CARA])).rejects.toThrow(/row-level security/);
    await expect(as(BOB, ladderSql, [CARA, "2026-10-08T10:00:00Z"])).rejects.toThrow(/row-level security/);
  });

  it("signed-out visitors get nothing", async () => {
    await expect(as(null, "select * from public.events")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from public.ladders")).rejects.toThrow(/permission denied/);
  });

  it("events are append-only and a retried upload creates no duplicate", async () => {
    await as(CARA, `${eventSql} on conflict (id) do nothing`, [E1, CARA]);
    expect(await as(CARA, "select count(*)::int as n from public.events")).toEqual([{ n: 1 }]);
    await expect(as(CARA, "update public.events set kind = 'pain_followup' where id = $1", [E1])).rejects.toThrow(/permission denied/);
    await expect(as(CARA, "delete from public.events where id = $1", [E1])).rejects.toThrow(/permission denied/);
  });

  it("only the allowed kinds are accepted", async () => {
    await expect(as(CARA, "insert into public.events (id, user_id, kind, occurred_at, data) values (gen_random_uuid(), $1, 'other', now(), '{}')", [CARA])).rejects.toThrow(/check constraint/);
  });

  it("a ladder keeps the newest write; an older one from an offline phone is ignored", async () => {
    await as(CARA, "update public.ladders set loads_g = '{5000,10000,15000}', updated_at = '2026-10-08T12:00:00Z' where exercise_id = 'leg_press'");
    await as(CARA, "update public.ladders set loads_g = '{1000}', updated_at = '2026-10-08T11:00:00Z' where exercise_id = 'leg_press'");
    expect(await as(CARA, "select loads_g from public.ladders")).toEqual([{ loads_g: [5000, 10000, 15000] }]);
  });

  it("a ladder needs at least one non-negative load; 0 (bodyweight) is allowed", async () => {
    await expect(as(CARA, "insert into public.ladders (user_id, exercise_id, loads_g, updated_at) values ($1, 'x', '{}', now())", [CARA])).rejects.toThrow(/check constraint/);
    await expect(as(CARA, "insert into public.ladders (user_id, exercise_id, loads_g, updated_at) values ($1, 'x', '{-5}', now())", [CARA])).rejects.toThrow(/check constraint/);
    await as(CARA, "insert into public.ladders (user_id, exercise_id, loads_g, updated_at) values ($1, 'back_extension_45', '{0,5000}', now())", [CARA]);
  });

  it("deleting the account removes workouts and ladders too", async () => {
    await as(CARA, "select public.delete_my_account()");
    await db.exec("reset role");
    expect((await db.query("select * from public.events")).rows).toEqual([]);
    expect((await db.query("select * from public.ladders")).rows).toEqual([]);
  });
});

describe("debrief_log (M8 request cap)", () => {
  const DAN = "44444444-4444-4444-4444-444444444444";
  const ERIN = "55555555-5555-5555-5555-555555555555";
  beforeAll(async () => {
    await db.exec(`insert into auth.users values ('${DAN}'), ('${ERIN}')`);
  });
  it("a user logs and counts only their own requests", async () => {
    await as(DAN, "insert into public.debrief_log default values");
    await as(DAN, "insert into public.debrief_log default values");
    expect(await as(DAN, "select count(*)::int as n from public.debrief_log")).toEqual([{ n: 2 }]);
    expect(await as(ERIN, "select count(*)::int as n from public.debrief_log")).toEqual([{ n: 0 }]);
  });
  it("cannot log in someone else's name, edit or delete, and anon is refused", async () => {
    await expect(as(ERIN, "insert into public.debrief_log (user_id) values ($1)", [DAN])).rejects.toThrow(/row-level security/);
    await expect(as(DAN, "update public.debrief_log set created_at = now()")).rejects.toThrow(/permission denied/);
    await expect(as(DAN, "delete from public.debrief_log")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from public.debrief_log")).rejects.toThrow(/permission denied/);
  });
});

describe("profile tailoring (plan tailoring column)", () => {
  const FAY = "66666666-6666-6666-6666-666666666666";
  const GUS = "77777777-7777-7777-7777-777777777777";
  beforeAll(async () => {
    await db.exec(`insert into auth.users values ('${FAY}'), ('${GUS}')`);
    await as(FAY, profileSql, [FAY, "2026-10-08T10:00:00Z"]);
  });
  it("a user saves their own plan and nobody else can read it", async () => {
    await as(FAY, "update public.profiles set tailoring = '{\"programId\":\"3-day\"}'::jsonb, updated_at = '2026-10-09T10:00:00Z'");
    expect(await as(FAY, "select tailoring->>'programId' as p from public.profiles")).toEqual([{ p: "3-day" }]);
    expect(await as(GUS, "select * from public.profiles")).toEqual([]);
  });
  it("only a small JSON object is accepted", async () => {
    await expect(as(FAY, "update public.profiles set tailoring = '[1]'::jsonb")).rejects.toThrow(/check constraint/);
    await expect(as(FAY, "update public.profiles set tailoring = $1::jsonb", [JSON.stringify({ x: "a".repeat(9000) })])).rejects.toThrow(/check constraint/);
  });
});
