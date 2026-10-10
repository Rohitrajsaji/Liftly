import { createClient, FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { BackendError, type Backend, type ConsentRow, type EventRow, type LadderRow, type ProfileRow, type Session } from "./backend";

interface ErrorLike {
  readonly message?: string;
  readonly status?: number;
  readonly code?: string;
  readonly name?: string;
}

/** Turns a Supabase or network failure into one of the few cases the screens know how to explain. */
export function toBackendError(e: unknown, fallback: string): BackendError {
  if (e instanceof BackendError) return e;
  const err = (e ?? {}) as ErrorLike;
  const text = `${err.message ?? ""} ${err.code ?? ""}`.toLowerCase();
  if (typeof navigator !== "undefined" && !navigator.onLine) return new BackendError("offline", "No connection");
  if (err.status === 0 || err.name === "AuthRetryableFetchError" || /failed to fetch|network|load failed/.test(text)) {
    return new BackendError("offline", "No connection");
  }
  if (/invalid_credentials|invalid login credentials/.test(text)) return new BackendError("bad_password", "Wrong email or password");
  if (/user_already_exists|already registered|already been registered/.test(text)) return new BackendError("exists", "Account exists");
  if (/weak_password|password should be|password is too/.test(text)) return new BackendError("weak_password", "Password too weak");
  if (/email_not_confirmed|not confirmed/.test(text)) return new BackendError("confirm_required", "Email not confirmed");
  if (err.status === 429 || /rate limit|over_email_send_rate_limit|too many/.test(text)) return new BackendError("rate_limited", "Too many requests");
  if (/email/.test(text) && /invalid|valid/.test(text)) return new BackendError("invalid_email", "Email not accepted");
  return new BackendError("other", err.message ?? fallback);
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const client: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "implicit" },
  });

  const fail = (e: unknown, fallback: string): never => {
    throw toBackendError(e, fallback);
  };
  const toSession = (u: { id: string; email?: string | undefined } | null | undefined): Session | null =>
    u === null || u === undefined ? null : { userId: u.id, email: u.email ?? "" };

  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) return fail(error, "Could not read the session");
      return toSession(data.session?.user);
    },
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) return fail(error, "Could not create the account");
      // With "Confirm email" switched on in Supabase there is a user but no session yet.
      if (data.session === null) return fail(new BackendError("confirm_required", "Email not confirmed"), "Could not sign in");
      const session = toSession(data.session.user);
      if (session === null) return fail(new Error("No session returned"), "Could not sign in");
      return session;
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return fail(error, "Could not sign in");
      const session = toSession(data.session?.user ?? data.user);
      if (session === null) return fail(new Error("No session returned"), "Could not sign in");
      return session;
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) fail(error, "Could not sign out");
    },
    async deleteAccount() {
      const { error } = await client.rpc("delete_my_account");
      if (error) fail(error, "Could not delete the account");
      await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    },
    async pushProfile(row: ProfileRow) {
      const { error } = await client.from("profiles").upsert(row, { onConflict: "user_id" });
      if (error) fail(error, "Could not save the profile");
    },
    async pushConsent(row: ConsentRow) {
      const { error } = await client.from("consents").upsert(row, { onConflict: "id", ignoreDuplicates: true });
      if (error) fail(error, "Could not save the consent");
    },
    async fetchProfile() {
      const { data, error } = await client.from("profiles").select("user_id, months_training, program, start_date, updated_at").maybeSingle();
      if (error) return fail(error, "Could not load the profile");
      return (data as ProfileRow | null) ?? null;
    },
    async pushEvent(row: EventRow) {
      const { error } = await client.from("events").upsert(row, { onConflict: "id", ignoreDuplicates: true });
      if (error) fail(error, "Could not save the workout");
    },
    async pushLadder(row: LadderRow) {
      const { error } = await client.from("ladders").upsert(row, { onConflict: "user_id,exercise_id" });
      if (error) fail(error, "Could not save the gym weights");
    },
    async fetchEvents() {
      const { data, error } = await client.from("events").select("id, user_id, kind, occurred_at, data").order("occurred_at", { ascending: true });
      if (error) return fail(error, "Could not load workouts");
      return (data ?? []) as EventRow[];
    },
    async requestDebrief(input: unknown) {
      const { data, error } = await client.functions.invoke("debrief", { body: { input } });
      if (error) {
        if (error instanceof FunctionsFetchError) return fail(new BackendError("offline", "No connection"), "Could not reach the AI model");
        if (error instanceof FunctionsHttpError) {
          const status = (error.context as Response).status;
          if (status === 403) return fail(new BackendError("consent_required", "AI summaries are not turned on"), "Not allowed");
          if (status === 429) return fail(new BackendError("rate_limited", "Too many requests"), "Too many requests");
        }
        return fail(error, "Could not get the summary");
      }
      return data as unknown;
    },
    async fetchLadders() {
      const { data, error } = await client.from("ladders").select("user_id, exercise_id, loads_g, updated_at");
      if (error) return fail(error, "Could not load gym weights");
      return (data ?? []) as LadderRow[];
    },
  };
}
