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

export type BackendErrorKind = "offline" | "rate_limited" | "bad_code" | "invalid_email" | "other";

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
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<Session>;
  signOut(): Promise<void>;
  /** Deletes the account and every row linked to it, then signs out. */
  deleteAccount(): Promise<void>;
  /** Idempotent: the newest updated_at wins on the server. */
  pushProfile(row: ProfileRow): Promise<void>;
  /** Idempotent: a repeated id is ignored. */
  pushConsent(row: ConsentRow): Promise<void>;
  fetchProfile(): Promise<ProfileRow | null>;
}
