// The post-workout debrief (AI_COACH.md). The app builds a pseudonymous input block from the finished session, Claude
// writes 3 to 4 sentences, and `validateDebrief` decides whether the text may be shown. When Claude is unavailable or
// fails validation, `fallbackDebrief` gives fixed text per reason code. Nothing here calls Claude or the network, and
// nothing here decides a number: every figure comes from the engine's stored decisions and the logged sets.

import { exercise } from "@liftly/catalog";
import type { ReasonCode } from "@liftly/engine";
import { REP_RANGES } from "@liftly/engine";
import { personalRecords, weightHistory, weekStart } from "./progress";
import type { ExerciseRecord, SessionRecord } from "./types";

export const REASON_CODES: readonly ReasonCode[] = ["PAIN_SWAP", "DELOAD_MISS", "FAST_UP", "ADVANCE", "STALL_DELOAD", "HOLD_PUSH", "GAP_5", "GAP_10", "RECAL"];

export interface DebriefSet {
  readonly kg: number;
  readonly reps: number;
  readonly effort: string;
}

export interface DebriefInput {
  /** Pseudonymous: the account id, or "anonymous". Never a name, email or phone number. */
  readonly userId: string;
  readonly profile: { readonly monthsTraining: number; readonly programDays: 3 | 4; readonly sessionNumber: number; readonly weekNumber: number };
  readonly daysSinceLastSession: number;
  readonly today: readonly {
    readonly exercise: string;
    readonly type: "compound" | "isolation";
    readonly repRange: { readonly bottom: number; readonly top: number };
    readonly targetSets: number;
    readonly status: "done" | "stopped_pain" | "skipped";
    readonly sets: readonly DebriefSet[];
  }[];
  /** Up to the 3 exposures before today, newest first. */
  readonly history: readonly { readonly exercise: string; readonly exposures: readonly { readonly kg: number; readonly totalReps: number; readonly sets: number }[] }[];
  readonly decisions: readonly { readonly exercise: string; readonly previousKg: number; readonly nextKg: number; readonly nextTargetReps: number; readonly reasonCode: ReasonCode }[];
  readonly flags: {
    readonly personalRecords: readonly { readonly exercise: string; readonly kg: number; readonly reps: number }[];
    readonly stall: readonly string[];
    readonly gap: "GAP_5" | "GAP_10" | "RECAL" | null;
    /** Exercise and a coarse category only. */
    readonly pain: readonly { readonly exercise: string; readonly category: "mild" | "moderate" | "high" }[];
  };
  /** Optional free text from the user, passed as data. V1 has no screen that collects it. */
  readonly userNote: string | null;
}

export interface DebriefOutput {
  readonly debrief_text: string;
  readonly reason_codes_cited: readonly string[];
  readonly numbers_cited: readonly number[];
  readonly contains_pain_guidance: boolean;
  readonly units: "kg";
}

const painCategory = (severity: number): "mild" | "moderate" | "high" => (severity <= 3 ? "mild" : severity <= 6 ? "moderate" : "high");

const workSets = (er: ExerciseRecord) => er.sets.filter((s) => s.kind === "working");

/** Builds the input block for the session that just finished. `sessions` are all finished sessions, oldest first, including this one. */
export function buildDebriefInput(args: {
  readonly session: SessionRecord;
  readonly sessions: readonly SessionRecord[];
  readonly monthsTraining: number;
  readonly startDate: string;
  readonly userId: string | null;
}): DebriefInput {
  const { session, sessions } = args;
  const before = sessions.filter((s) => s.id !== session.id && (s.date < session.date || (s.date === session.date && s.startedAt < session.startedAt)));
  const history = weightHistory(before);
  const ex = session.exercises.filter((e) => e.status !== "skipped" || e.sets.length > 0);
  const done = ex.filter((e) => e.status === "done");
  const weeks = Math.floor((Date.parse(weekStart(session.date)) - Date.parse(weekStart(args.startDate))) / (7 * 86_400_000)) + 1;

  const decisions = done.flatMap((e) => {
    const d = e.outcome?.decision ?? null;
    return d === null ? [] : [{ exercise: exercise(e.exerciseId).name, previousKg: d.previousG / 1000, nextKg: d.nextG / 1000, nextTargetReps: d.nextTargetReps, reasonCode: d.reasonCode }];
  });

  const prsBefore = new Map(personalRecords(before).map((p) => [p.exerciseId, p]));
  const prsNow = personalRecords([...before, session]);
  const todayIds = new Set(done.map((e) => e.exerciseId));
  const prs = prsNow
    .filter((p) => todayIds.has(p.exerciseId) && p.date === session.date)
    .filter((p) => {
      const old = prsBefore.get(p.exerciseId);
      return old !== undefined && (p.weightG > old.weightG || (p.weightG === old.weightG && p.reps > old.reps));
    })
    .map((p) => ({ exercise: exercise(p.exerciseId).name, kg: p.weightG / 1000, reps: p.reps }));

  const gapCodes = done.map((e) => e.prescription.gapAdjustment).filter((g): g is "GAP_5" | "GAP_10" | "RECAL" => g !== "none");

  return {
    userId: args.userId ?? "anonymous",
    profile: { monthsTraining: args.monthsTraining, programDays: session.programId === "4-day" ? 4 : 3, sessionNumber: before.length + 1, weekNumber: Math.max(1, weeks) },
    daysSinceLastSession: session.daysSinceLastSession,
    today: ex.map((e) => {
      const type = exercise(e.exerciseId).type ?? "compound";
      return {
        exercise: exercise(e.exerciseId).name,
        type,
        repRange: { bottom: REP_RANGES[type].bottom, top: REP_RANGES[type].top },
        targetSets: e.targetSets,
        status: e.status === "done" || e.status === "stopped_pain" ? e.status : "skipped",
        sets: workSets(e).map((s) => ({ kg: s.weightG / 1000, reps: s.reps, effort: s.effort })),
      };
    }),
    history: done.flatMap((e) => {
      const past = (history[e.exerciseId] ?? []).slice(-3).reverse();
      return past.length === 0 ? [] : [{ exercise: exercise(e.exerciseId).name, exposures: past.map((p) => ({ kg: p.weightG / 1000, totalReps: p.totalReps, sets: p.sets })) }];
    }),
    decisions,
    flags: {
      personalRecords: prs,
      stall: done.filter((e) => e.outcome?.decision?.reasonCode === "STALL_DELOAD").map((e) => exercise(e.exerciseId).name),
      gap: gapCodes[0] ?? null,
      pain: ex.flatMap((e) => (e.pain === null ? [] : [{ exercise: exercise(e.exerciseId).name, category: painCategory(e.pain.severity) }])),
    },
    userNote: null,
  };
}

// ---------- Validation (AI_COACH.md section 7) ----------

export const DEBRIEF_MAX_WORDS = 90; // [ASSUMPTION] maximum word count, as AI_COACH.md leaves it to be set.

const FORBIDDEN =
  /\b(pain\w*|hurt\w*|sore\w*|ache\w*|injur\w*|diagnos\w*|strain\w*|sprain\w*|tendon\w*|tendin\w*|ligament\w*|inflam\w*|arthrit\w*|medic\w*|medicine\w*|doctor\w*|physio\w*|rehab\w*|therap\w*|treat\w*|supplement\w*|creatine|protein|diet|calorie\w*|lbs?|pounds?|push(ing)? through|train(ing)? through)\b/i;

/** Every number the input contains (values, and digits inside exercise names), plus counts of sets. */
export function allowedNumbers(input: DebriefInput): Set<number> {
  const out = new Set<number>();
  const walk = (v: unknown, key = ""): void => {
    if (typeof v === "number") out.add(v);
    else if (typeof v === "string") {
      if (key !== "userId") for (const m of v.match(/\d+(?:\.\d+)?/g) ?? []) out.add(Number(m));
    } else if (Array.isArray(v)) {
      out.add(v.length);
      for (const x of v) walk(x, key);
    } else if (v !== null && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk({ ...input, userNote: null });
  for (const e of input.today) {
    out.add(e.sets.length);
    out.add(e.sets.reduce((n, s) => n + s.reps, 0));
  }
  out.add(input.today.filter((e) => e.status === "done").length);
  return out;
}

export const numbersIn = (text: string): number[] => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

export type DebriefCheck = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: string };

/** Decides whether Claude's output may be shown. Any failure means the fixed fallback is shown instead. */
export function validateDebrief(raw: unknown, input: DebriefInput): DebriefCheck {
  if (raw === null || typeof raw !== "object") return { ok: false, reason: "not an object" };
  const o = raw as Record<string, unknown>;
  const text = o["debrief_text"];
  if (typeof text !== "string" || text.trim() === "") return { ok: false, reason: "no text" };
  if (o["units"] !== "kg") return { ok: false, reason: "units are not kg" };
  if (o["contains_pain_guidance"] !== false) return { ok: false, reason: "pain guidance claimed" };
  const cited = o["reason_codes_cited"];
  if (!Array.isArray(cited) || cited.some((c) => typeof c !== "string")) return { ok: false, reason: "reason codes malformed" };
  const inputCodes = new Set<string>(input.decisions.map((d) => d.reasonCode));
  if (input.flags.gap !== null) inputCodes.add(input.flags.gap);
  const unknownCode = (cited as string[]).find((c) => !inputCodes.has(c));
  if (unknownCode !== undefined) return { ok: false, reason: `reason code not in input: ${unknownCode}` };
  const printed = REASON_CODES.find((c) => new RegExp(`\\b${c}\\b`).test(text) && !inputCodes.has(c));
  if (printed !== undefined) return { ok: false, reason: `reason code not in input: ${printed}` };
  const nums = o["numbers_cited"];
  if (!Array.isArray(nums) || nums.some((n) => typeof n !== "number")) return { ok: false, reason: "numbers malformed" };

  const allowed = allowedNumbers(input);
  const stray = [...numbersIn(text), ...(nums as number[])].find((n) => !allowed.has(n));
  if (stray !== undefined) return { ok: false, reason: `number not in input: ${stray}` };
  if (FORBIDDEN.test(text)) return { ok: false, reason: "forbidden term" };

  const sentences = text.trim().split(/(?<=[.!?])\s+/).filter((s) => s !== "");
  if (sentences.length < 3 || sentences.length > 4) return { ok: false, reason: `${sentences.length} sentences` };
  if (text.trim().split(/\s+/).length > DEBRIEF_MAX_WORDS) return { ok: false, reason: "too long" };
  return { ok: true, text: text.trim() };
}

// ---------- Fixed fallback (AI_COACH.md section 9; wording is an ASSUMPTION until approved) ----------

export const DEBRIEF_FALLBACK: Readonly<Record<ReasonCode, string>> = {
  PAIN_SWAP: "One exercise changes next session.",
  DELOAD_MISS: "Where sets fell short, the weight steps down next time so you can build back up.",
  FAST_UP: "Where every set felt Easy at the top of the range, the weight goes up two steps next time.",
  ADVANCE: "Where you reached the top of the range, the weight goes up one step next time.",
  STALL_DELOAD: "Where the reps stopped climbing, the weight steps down a little to get you moving again.",
  HOLD_PUSH: "Where you stayed in the range, keep the same weight and aim for one more rep.",
  GAP_5: "Because of the break, the weight is a step lighter to ease you back in.",
  GAP_10: "Because of the break, the weight is lighter to ease you back in.",
  RECAL: "Because it has been a while, you will find your starting weight again.",
};

const FALLBACK_OPENING = "Workout saved. Well done for getting it done.";
const FALLBACK_CLOSING = "Your next targets are shown with each exercise.";

/** Fixed text for this session's reason codes. Mentions no numbers, so it cannot disagree with the engine. */
export function fallbackDebrief(input: DebriefInput): string {
  const codes = [...new Set(input.decisions.map((d) => d.reasonCode))].filter((c) => c !== "PAIN_SWAP");
  if (input.flags.gap !== null && !codes.includes(input.flags.gap)) codes.unshift(input.flags.gap);
  return [FALLBACK_OPENING, ...codes.slice(0, 3).map((c) => DEBRIEF_FALLBACK[c]), FALLBACK_CLOSING].join(" ");
}
