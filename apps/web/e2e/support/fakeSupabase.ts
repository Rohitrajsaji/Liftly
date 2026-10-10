// A stand-in for Supabase that the browser tests can drive. It answers the requests the real supabase-js client makes
// (email + password sign-up and sign-in, session, profile and consent rows, delete-my-account) and keeps rows with the same rules as the real
// migration: client-made consent ids are unique, the newest profile update wins, and every call needs a signed-in token.
import type { BrowserContext, Route } from "@playwright/test";

export const SUPABASE_HOST = "https://liftly-test.supabase.co";

interface Profile {
  user_id: string;
  months_training: number;
  program: string;
  start_date: string;
  updated_at: string;
}
interface Consent {
  id: string;
  user_id: string;
  consent_version: string;
  accepted_at: string;
}

interface EventRow {
  id: string;
  user_id: string;
  kind: string;
  occurred_at: string;
  data: unknown;
}
interface LadderRow {
  user_id: string;
  exercise_id: string;
  loads_g: number[];
  updated_at: string;
}

export class FakeSupabase {
  events = new Map<string, EventRow>();
  ladders = new Map<string, LadderRow>();
  eventWrites = 0;
  users = new Map<string, string>(); // email -> user id
  profiles = new Map<string, Profile>();
  consents = new Map<string, Consent>();
  passwords = new Map<string, string>(); // email -> password
  signUps: string[] = [];
  /** Every REST (data) call, so tests can prove nothing was uploaded before sign-in. */
  restCalls: string[] = [];
  profileWrites = 0;
  /** The debrief function: "ok" returns a valid summary, "invalid" an unusable one, "down" a server error. */
  debriefMode: "ok" | "invalid" | "down" = "ok";
  debriefCalls = 0;
  rpcCalls: string[] = [];
  /** When true every request fails like a dropped connection. */
  offline = false;
  /** When set, the next sign-up is refused as rate limited. */
  rateLimitNext = false;

  private idFor(email: string): string {
    let id = this.users.get(email);
    if (id === undefined) {
      id = `00000000-0000-4000-8000-${String(this.users.size + 1).padStart(12, "0")}`;
      this.users.set(email, id);
    }
    return id;
  }

  private emailOf(id: string): string {
    return [...this.users].find(([, v]) => v === id)?.[0] ?? "";
  }

  private session(userId: string) {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const email = this.emailOf(userId);
    const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: userId, email, role: "authenticated", aud: "authenticated", exp })}.sig`;
    return {
      access_token: token,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: exp,
      refresh_token: `refresh-${userId}`,
      user: { id: userId, aud: "authenticated", role: "authenticated", email, email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    };
  }

  private userFrom(route: Route): string | null {
    const auth = route.request().headers()["authorization"] ?? "";
    const m = auth.match(/^Bearer (.+)$/);
    if (!m?.[1]) return null;
    try {
      const payload = JSON.parse(Buffer.from(m[1].split(".")[1] ?? "", "base64url").toString()) as { sub?: string; role?: string };
      return payload.role === "authenticated" && payload.sub !== undefined && this.emailOf(payload.sub) !== "" ? payload.sub : null;
    } catch {
      return null;
    }
  }

  async install(context: BrowserContext): Promise<void> {
    await context.route(`${SUPABASE_HOST}/**`, (route) => this.handle(route));
  }

  private cors(route: Route): Record<string, string> {
    const req = route.request().headers();
    return {
      "access-control-allow-origin": req["origin"] ?? "*",
      "access-control-allow-headers": req["access-control-request-headers"] ?? "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-expose-headers": "*",
    };
  }

  private json(route: Route, status: number, body: unknown) {
    return route.fulfill({ status, headers: { ...this.cors(route), "content-type": "application/json" }, body: body === null ? "" : JSON.stringify(body) });
  }

  private async handle(route: Route): Promise<void> {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: this.cors(route) });
    if (this.offline) return route.abort("internetdisconnected");

    const url = new URL(req.url());
    const path = url.pathname;
    const body = (): Record<string, unknown> => {
      try {
        return JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
      } catch {
        return {};
      }
    };

    if (path === "/auth/v1/signup") {
      if (this.rateLimitNext) {
        this.rateLimitNext = false;
        return this.json(route, 429, { code: 429, error_code: "over_request_rate_limit", msg: "rate limit exceeded" });
      }
      const { email, password } = body() as { email?: string; password?: string };
      if (email === undefined || password === undefined) return this.json(route, 400, { code: 400, error_code: "validation_failed", msg: "missing" });
      if (password.length < 8) return this.json(route, 422, { code: 422, error_code: "weak_password", msg: "Password should be at least 8 characters." });
      if (this.passwords.has(email)) return this.json(route, 422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
      this.passwords.set(email, password);
      this.signUps.push(email);
      return this.json(route, 200, this.session(this.idFor(email)));
    }
    if (path === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const { email, password } = body() as { email?: string; password?: string };
        if (email === undefined || this.passwords.get(email) !== password) {
          return this.json(route, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        }
        return this.json(route, 200, this.session(this.idFor(email)));
      }
      const refresh = String(body()["refresh_token"] ?? "").replace("refresh-", "");
      return this.json(route, 200, this.session(refresh));
    }
    if (path === "/auth/v1/user") {
      const id = this.userFrom(route);
      return id === null ? this.json(route, 401, { code: 401, msg: "invalid JWT" }) : this.json(route, 200, this.session(id).user);
    }
    if (path === "/auth/v1/logout") return this.json(route, 204, null);

    if (path === "/functions/v1/debrief") {
      const userId = this.userFrom(route);
      if (userId === null) return this.json(route, 401, { error: "sign in" });
      if (![...this.consents.values()].some((c) => c.user_id === userId && c.consent_version === "ai-debrief-draft-2")) return this.json(route, 403, { error: "consent" });
      this.debriefCalls += 1;
      if (this.debriefMode === "down") return this.json(route, 502, { error: "upstream" });
      const input = (body()["input"] ?? {}) as { profile?: { sessionNumber?: number } };
      if (this.debriefMode === "invalid") return this.json(route, 200, { debrief_text: "Lift 999 kg next time. Do it. Now.", reason_codes_cited: [], numbers_cited: [999], contains_pain_guidance: false, units: "kg" });
      const n = input.profile?.sessionNumber ?? 1;
      return this.json(route, 200, {
        debrief_text: `You finished session ${n} of your plan. Every target you see comes from your own logged sets. Keep your rest breaks steady so the next one feels strong.`,
        reason_codes_cited: [],
        numbers_cited: [n],
        contains_pain_guidance: false,
        units: "kg",
      });
    }

    if (path.startsWith("/rest/v1/")) {
      this.restCalls.push(`${req.method()} ${path}`);
      const userId = this.userFrom(route);
      if (userId === null) return this.json(route, 401, { message: "JWT required", code: "PGRST301" });

      if (path === "/rest/v1/rpc/delete_my_account") {
        this.rpcCalls.push(userId);
        this.profiles.delete(userId);
        for (const [id, c] of this.consents) if (c.user_id === userId) this.consents.delete(id);
        for (const [id, e] of this.events) if (e.user_id === userId) this.events.delete(id);
        for (const [k, l] of this.ladders) if (l.user_id === userId) this.ladders.delete(k);
        { const gone = this.emailOf(userId); this.users.delete(gone); this.passwords.delete(gone); }
        return this.json(route, 204, null);
      }
      if (path === "/rest/v1/profiles") {
        if (req.method() === "GET") {
          const mine = this.profiles.get(userId);
          return this.json(route, 200, mine === undefined ? [] : [mine]);
        }
        const row = body() as unknown as Profile;
        if (row.user_id !== userId) return this.json(route, 403, { code: "42501", message: "new row violates row-level security policy" });
        this.profileWrites += 1;
        const old = this.profiles.get(userId);
        if (old === undefined || Date.parse(row.updated_at) >= Date.parse(old.updated_at)) this.profiles.set(userId, row);
        return this.json(route, 201, null);
      }
      if (path === "/rest/v1/consents") {
        if (req.method() === "GET") return this.json(route, 200, [...this.consents.values()].filter((c) => c.user_id === userId));
        const row = body() as unknown as Consent;
        if (row.user_id !== userId) return this.json(route, 403, { code: "42501", message: "new row violates row-level security policy" });
        if (!this.consents.has(row.id)) this.consents.set(row.id, row);
        return this.json(route, 201, null);
      }
      if (path === "/rest/v1/events") {
        if (req.method() === "GET") return this.json(route, 200, [...this.events.values()].filter((e) => e.user_id === userId));
        const row = body() as unknown as EventRow;
        if (row.user_id !== userId) return this.json(route, 403, { code: "42501", message: "new row violates row-level security policy" });
        this.eventWrites += 1;
        if (!this.events.has(row.id)) this.events.set(row.id, row);
        return this.json(route, 201, null);
      }
      if (path === "/rest/v1/ladders") {
        if (req.method() === "GET") return this.json(route, 200, [...this.ladders.values()].filter((l) => l.user_id === userId));
        const row = body() as unknown as LadderRow;
        if (row.user_id !== userId) return this.json(route, 403, { code: "42501", message: "new row violates row-level security policy" });
        const key = `${row.user_id}/${row.exercise_id}`;
        const old = this.ladders.get(key);
        if (old === undefined || Date.parse(row.updated_at) >= Date.parse(old.updated_at)) this.ladders.set(key, row);
        return this.json(route, 201, null);
      }
    }
    return this.json(route, 404, { message: `unhandled ${req.method()} ${path}` });
  }
}
