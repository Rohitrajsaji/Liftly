// Supabase settings come from the build environment. Both values are public by design (the publishable key only
// opens what row-level security allows). With neither set, the app runs without accounts.

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE: { readonly url: string; readonly key: string } | null =
  typeof url === "string" && url !== "" && typeof key === "string" && key !== "" ? { url, key } : null;
