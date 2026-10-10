// Plan tailoring on the device (AI_COACH.md 4a). The plan that follows the user's answers is built here with no AI and no
// network. The AI step is optional: it needs an account and the user's agreement, it only chooses among the options the
// rules left, and its result is used only if every check passes (otherwise the rules plan stays).

import type { ProgramId } from "@liftly/catalog";
import { allowedOptions, buildTailoredPlan, tailorInput, type TailorAnswers, type TailoredPlan } from "@liftly/workout";
import { BackendError, type Backend, type ConsentRow, type Session } from "./backend";
import { newId } from "./account";
import type { LiftlyDb } from "./db";
import { enqueueConsent, flushOutbox } from "./sync";

/** Separate from the summary consent: tailoring sends different data, and is off until the user turns it on. */
export const TAILOR_CONSENT_VERSION = "ai-tailor-draft-1";
export const TAILOR_CONSENT_TITLE = "AI plan tailoring";

// DRAFT wording, like debrief.ts: not legal advice, and SAFETY.md section 6 still lists a legal review as open.
export const TAILOR_CONSENT_POINTS: readonly string[] = [
  "When you tailor your plan, an AI model can choose between the exercise options that fit your answers and write a short note about its choice. This is optional and off until you turn it on.",
  "To do that, Liftly sends whether your plan is 3 or 4 days, your months of training, whether you prefer machines or free weights, and the list of exercise options. No name, email or phone number is sent, and nothing you typed.",
  "The model is a free one run by a third party, reached through OpenRouter. Free models may keep what they are sent and may use it to improve themselves, so leave this off if you'd rather not.",
  "The AI only chooses from options Liftly has approved, and Liftly checks its choice. Liftly's own rules set every weight and rep. If the AI can't be used, a plan that follows your answers is used instead.",
  "You can turn this off at any time from the Account screen.",
];

const FLAG = "claudeTailor";
const TIMEOUT_MS = 65_000; // the function tries several models for up to ~55 s

export async function tailorAiOn(db: LiftlyDb): Promise<boolean> {
  return (await db.flags.get(FLAG))?.value === TAILOR_CONSENT_VERSION;
}

/** Turns AI plan tailoring on (recording the consent for the account) or off. */
export async function setTailorAi(db: LiftlyDb, backend: Backend, session: Session, on: boolean, now: Date): Promise<void> {
  if (!on) {
    await db.flags.put({ key: FLAG, value: "off" });
    return;
  }
  const row: ConsentRow = { id: newId(), user_id: session.userId, consent_version: TAILOR_CONSENT_VERSION, accepted_at: now.toISOString() };
  await enqueueConsent(db, row, now);
  await db.flags.put({ key: FLAG, value: TAILOR_CONSENT_VERSION });
  // The server checks this consent before it calls the AI, so upload it now if we can.
  await flushOutbox(db, backend, session.userId).catch(() => undefined);
}

/** The AI has a real choice to make only when the user stated a preference and some slot still has two or more options. */
export function aiHasChoice(programId: ProgramId, answers: TailorAnswers): boolean {
  return answers.preference !== "none" && allowedOptions(programId, answers).some((o) => o.allowed.length > 1);
}

export type AiPlanResult = { readonly ok: true; readonly plan: TailoredPlan } | { readonly ok: false; readonly reason: "offline" | "consent_required" | "rate_limited" | "invalid" | "failed" };

const withTimeout = <T>(p: Promise<T>): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new BackendError("offline", "Timed out")), TIMEOUT_MS))]);

/** Asks the AI to choose, then checks the answer. Never throws. */
export async function requestAiPlan(backend: Backend, programId: ProgramId, answers: TailorAnswers, monthsTraining: number | null, now: Date): Promise<AiPlanResult> {
  let raw: unknown;
  try {
    raw = await withTimeout(backend.requestTailor(tailorInput(programId, answers, monthsTraining)));
  } catch (e) {
    const kind = e instanceof BackendError ? e.kind : "other";
    if (kind === "offline") return { ok: false, reason: "offline" };
    if (kind === "consent_required") return { ok: false, reason: "consent_required" };
    if (kind === "rate_limited") return { ok: false, reason: "rate_limited" };
    return { ok: false, reason: "failed" };
  }
  const plan = buildTailoredPlan({ programId, answers, ai: raw, createdAt: now.toISOString() });
  return plan.source === "ai" ? { ok: true, plan } : { ok: false, reason: "invalid" };
}

export function aiFailureText(reason: Exclude<AiPlanResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "offline":
      return "You're offline, so the AI could not be asked. Your plan follows your answers.";
    case "consent_required":
      return "AI tailoring isn't allowed on your account yet. Turn it off and on again in Account.";
    case "rate_limited":
      return "The free AI model is busy. Your plan follows your answers; try again in a little while.";
    case "invalid":
      return "The AI's choice didn't pass Liftly's checks, so it wasn't used. Your plan follows your answers.";
    case "failed":
      return "The AI could not be reached. Your plan follows your answers.";
  }
}
