// What the app needs from the server, as an interface. The Supabase client implements it (supabaseBackend.ts);
// tests use fakes. Keeps sign-in, sync and the screens free of any Supabase types.

export interface Session {
  readonly userId: string;
  readonly email: string;
}

/** Server shape of the profile (supabase/migrations/0001_accounts.sql). */
export interface ProfileRow {
  readonly user_id: string;
  readonly months_training: number;
  readonly program: "3-day" | "4-day";
  readonly start_date: string;
  readonly updated_at: string;
}

export interface ConsentRow {
  readonly id: string;
  readonly user_id: string;
  readonly consent_version: string;
  readonly accepted_at: string;
}

/** One fact that builds the training plan (supabase/migrations/0002_workouts.sql). `data` is the PlanEvent. */
export interface EventRow {
  readonly id: string;
  readonly user_id: string;
  readonly kind: "session" | "pain_followup";
  readonly occurred_at: string;
  readonly data: unknown;
}

export interface LadderRow {
  readonly user_id: string;
  readonly exercise_id: string;
  readonly loads_g: readonly number[];
  readonly updated_at: string;
}

export type BackendErrorKind = "offline" | "rate_limited" | "bad_password" | "exists" | "weak_password" | "confirm_required" | "invalid_email" | "other";

export class BackendError extends Error {
  constructor(
    readonly kind: BackendErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

export interface Backend {
  /** The signed-in user, read from the device (works offline). */
  getSession(): Promise<Session | null>;
  /** Creates the account and signs in. Throws "exists" when the email already has an account. */
  signUp(email: string, password: string): Promise<Session>;
  /** Throws "bad_password" for a wrong email or password. */
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  /** Deletes the account and every row linked to it, then signs out. */
  deleteAccount(): Promise<void>;
  /** Idempotent: the newest updated_at wins on the server. */
  pushProfile(row: ProfileRow): Promise<void>;
  /** Idempotent: a repeated id is ignored. */
  pushConsent(row: ConsentRow): Promise<void>;
  fetchProfile(): Promise<ProfileRow | null>;
  /** Idempotent: a repeated id is ignored. */
  pushEvent(row: EventRow): Promise<void>;
  /** Idempotent: the newest updated_at wins on the server. */
  pushLadder(row: LadderRow): Promise<void>;
  fetchEvents(): Promise<EventRow[]>;
  fetchLadders(): Promise<LadderRow[]>;
}
