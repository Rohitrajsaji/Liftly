// Smoke test against a real Supabase project: pnpm --filter @liftly/web smoke
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from .env.local. Uses only the publishable key.
// Part 1 needs no sign-in. Part 2 (optional) signs in two test emails with real codes: pass SMOKE_EMAIL_A and
// SMOKE_EMAIL_B. It creates and then deletes its own test accounts.
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (apps/web/.env.local)");

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ${detail}`}`);
  if (!ok) failed += 1;
};
const fresh = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Part 1: signed out.
const anon = fresh();
for (const table of ["profiles", "consents", "events", "ladders"]) {
  const { data, error } = await anon.from(table).select("*");
  // Either a permission error, or no rows at all. "relation does not exist" means the migration was not run.
  const missing = /does not exist|schema cache/i.test(error?.message ?? "");
  check(`${table}: table exists (migration ran)`, !missing, error?.message);
  check(`${table}: signed-out read returns nothing`, error !== null || (data ?? []).length === 0, JSON.stringify(data));
  const zero = "00000000-0000-0000-0000-000000000000";
  const rows = { events: { id: crypto.randomUUID(), user_id: zero, kind: "session", occurred_at: new Date().toISOString(), data: {} }, ladders: { user_id: zero, exercise_id: "leg_press", loads_g: [10000, 20000], updated_at: new Date().toISOString() } };
  const w = await anon.from(table).insert(rows[table] ?? (table === "profiles" ? { user_id: "00000000-0000-0000-0000-000000000000", months_training: 1, program: "3-day", start_date: "2026-01-01", updated_at: new Date().toISOString() } : { id: crypto.randomUUID(), user_id: "00000000-0000-0000-0000-000000000000", consent_version: "smoke", accepted_at: new Date().toISOString() }));
  check(`${table}: signed-out write is refused`, w.error !== null);
}
const del = await anon.rpc("delete_my_account");
check("delete_my_account: refused when signed out", del.error !== null);

// Part 2: two real accounts.
const emailA = process.env.SMOKE_EMAIL_A;
const emailB = process.env.SMOKE_EMAIL_B;
if (emailA && emailB) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const signIn = async (email) => {
    const c = fresh();
    const sent = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    check(`${email}: code sent`, sent.error === null, sent.error?.message);
    const code = (await rl.question(`Code emailed to ${email}: `)).trim();
    const v = await c.auth.verifyOtp({ email, token: code, type: "email" });
    check(`${email}: signed in with the code`, v.error === null && v.data.user !== null, v.error?.message);
    return { c, id: v.data.user?.id };
  };
  const a = await signIn(emailA);
  const b = await signIn(emailB);
  const now = new Date().toISOString();
  const consentId = crypto.randomUUID();
  const up = await a.c.from("profiles").upsert({ user_id: a.id, months_training: 4, program: "4-day", start_date: "2026-10-08", updated_at: now }, { onConflict: "user_id" });
  check("A: saves a profile", up.error === null, up.error?.message);
  for (let i = 0; i < 2; i++) {
    const r = await a.c.from("consents").upsert({ id: consentId, user_id: a.id, consent_version: "smoke", accepted_at: now }, { onConflict: "id", ignoreDuplicates: true });
    check(`A: saves a consent (attempt ${i + 1}, same id)`, r.error === null, r.error?.message);
  }
  const mine = await a.c.from("consents").select("*");
  check("A: the repeated consent is stored once", (mine.data ?? []).length === 1, JSON.stringify(mine.data));
  const stale = await a.c.from("profiles").upsert({ user_id: a.id, months_training: 9, program: "3-day", start_date: "2026-10-08", updated_at: "2020-01-01T00:00:00Z" }, { onConflict: "user_id" });
  const after = await a.c.from("profiles").select("program, months_training").single();
  check("A: an older update is ignored", stale.error === null && after.data?.program === "4-day" && after.data?.months_training === 4, JSON.stringify(after.data));
  check("B: cannot see A's profile", ((await b.c.from("profiles").select("*")).data ?? []).length === 0);
  check("B: cannot see A's consent", ((await b.c.from("consents").select("*")).data ?? []).length === 0);
  const forged = await b.c.from("profiles").insert({ user_id: a.id, months_training: 1, program: "3-day", start_date: "2026-10-08", updated_at: now });
  check("B: cannot write a row as A", forged.error !== null);
  const edit = await b.c.from("profiles").update({ months_training: 12, updated_at: new Date().toISOString() }).eq("user_id", a.id).select();
  check("B: cannot change A's row", (edit.data ?? []).length === 0);
  const delB = await b.c.rpc("delete_my_account");
  check("B: deletes own account", delB.error === null, delB.error?.message);
  check("A: still has their profile after B was deleted", ((await a.c.from("profiles").select("*")).data ?? []).length === 1);
  const delA = await a.c.rpc("delete_my_account");
  check("A: deletes own account", delA.error === null, delA.error?.message);
  const gone = await fresh().auth.signInWithOtp({ email: emailA, options: { shouldCreateUser: false } });
  check("A: account no longer exists", gone.error !== null);
  rl.close();
} else {
  console.log("SKIP  part 2 (two real accounts): set SMOKE_EMAIL_A and SMOKE_EMAIL_B to run it");
}
console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
