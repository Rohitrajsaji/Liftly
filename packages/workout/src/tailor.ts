// Plan tailoring (AI_COACH.md 4a, PROGRAMS.md 3b). Pure: the app builds a rules plan that honours the user's answers with
// no AI, and an AI result is accepted only if every check passes. Nothing here sets a weight, rep or set count; a tailored
// plan only changes which approved exercise fills each slot.

import { EXERCISES, exercise, MENUS, PROGRAMS, swapFor, type Equipment, type Program, type ProgramId, type SlotKey } from "@liftly/catalog";
import { FORBIDDEN_WORDING } from "./debrief";

export const TAILOR_SPEC_VERSION = "1.2";
export const EXPLANATION_MAX_WORDS = 60;

export type Preference = "none" | "machines" | "free_weights";

export interface TailorAnswers {
  /** Equipment the user's gym does not have. */
  readonly unavailable: readonly Equipment[];
  readonly preference: Preference;
  /** Exercise ids the user would rather not do. */
  readonly avoid: readonly string[];
}

export const NO_ANSWERS: TailorAnswers = { unavailable: [], preference: "none", avoid: [] };

export interface TailorPick {
  readonly slotKey: SlotKey;
  readonly order: number;
  readonly exerciseId: string;
  /** The exercise used after a pain report (the slot's swap). */
  readonly swapId: string;
}

export interface TailoredPlan {
  readonly programId: ProgramId;
  readonly answers: TailorAnswers;
  readonly picks: readonly TailorPick[];
  readonly source: "ai" | "rules" | "fixed";
  readonly explanation: string;
  /** Slot labels (like "A1") that kept the fixed exercise because no allowed option was left. */
  readonly keptFixed: readonly string[];
  readonly specVersion: string;
  readonly createdAt: string;
}

export const slotLabel = (slotKey: SlotKey, order: number): string => `${slotKey}${programSep(slotKey)}${order}`;
// 3-day slots are single letters (A1), 4-day slots are two characters (U1-1).
function programSep(slotKey: SlotKey): string {
  return slotKey.length > 1 ? "-" : "";
}

const PREFERRED: Readonly<Record<Preference, readonly Equipment[]>> = {
  none: [],
  machines: ["machine", "cable"],
  free_weights: ["dumbbell", "bodyweight"],
};

export const FIXED_EXPLANATION = "This plan follows your answers. Each exercise comes from the approved options for its place in the plan, and Liftly sets every weight and rep from your logged workouts.";
export const FIXED_PLAN_EXPLANATION = "This is the standard plan.";

export interface SlotOptions {
  readonly slotKey: SlotKey;
  readonly order: number;
  readonly label: string;
  readonly fixedId: string;
  /** The whole menu, fixed exercise first. */
  readonly menu: readonly string[];
  /** The menu minus avoided exercises and missing equipment, in menu order. */
  readonly allowed: readonly string[];
}

const equipmentOk = (id: string, answers: TailorAnswers): boolean => {
  const e = exercise(id).equipment;
  return e === null || !answers.unavailable.includes(e);
};

/** The options for every slot row, with the user's answers applied. */
export function allowedOptions(programId: ProgramId, answers: TailorAnswers): SlotOptions[] {
  const out: SlotOptions[] = [];
  for (const slot of PROGRAMS[programId].slots) {
    for (const row of slot.exercises) {
      const menu = MENUS[programId].find((m) => m.slotKey === slot.key && m.order === row.order)?.options ?? [row.exerciseId];
      out.push({
        slotKey: slot.key,
        order: row.order,
        label: slotLabel(slot.key, row.order),
        fixedId: row.exerciseId,
        menu,
        allowed: menu.filter((id) => !answers.avoid.includes(id) && equipmentOk(id, answers)),
      });
    }
  }
  return out;
}

/** The exercises the user may avoid: those whose slot has another option. */
export function avoidableExercises(programId: ProgramId): string[] {
  const ids = new Set<string>();
  for (const s of allowedOptions(programId, NO_ANSWERS)) if (s.menu.length > 1) for (const id of s.menu) ids.add(id);
  return [...ids];
}

type IdPick = { readonly slotKey: SlotKey; readonly order: number; readonly exerciseId: string };

/**
 * Each slot's swap (the exercise used after a pain report): the fixed plan's approved swap when it still fits, otherwise
 * another menu option. It never repeats an exercise in the workout; avoided exercises and missing equipment come last.
 */
function withSwaps(programId: ProgramId, answers: TailorAnswers, picks: readonly IdPick[]): TailorPick[] {
  const options = allowedOptions(programId, answers);
  return picks.map((p) => {
    const opt = options.find((o) => o.slotKey === p.slotKey && o.order === p.order);
    const inWorkout = new Set(picks.filter((x) => x.slotKey === p.slotKey).map((x) => x.exerciseId));
    const fixedSwap = swapFor(programId, opt?.fixedId ?? p.exerciseId);
    const candidates = [fixedSwap, ...(opt?.menu ?? [])];
    const fresh = (id: string) => id !== p.exerciseId && !inWorkout.has(id);
    const suits = (id: string) => !answers.avoid.includes(id) && equipmentOk(id, answers);
    const swapId = candidates.find((id) => fresh(id) && suits(id)) ?? candidates.find(fresh) ?? fixedSwap;
    return { slotKey: p.slotKey, order: p.order, exerciseId: p.exerciseId, swapId };
  });
}

export function fixedPicks(programId: ProgramId): TailorPick[] {
  const ids: IdPick[] = [];
  for (const s of PROGRAMS[programId].slots) for (const r of s.exercises) ids.push({ slotKey: s.key, order: r.order, exerciseId: r.exerciseId });
  // The fixed plan keeps each row's own approved swap.
  return ids.map((p) => ({ ...p, swapId: swapFor(programId, p.exerciseId) }));
}

/**
 * The plan that follows the answers with no AI: on each slot the first allowed option, preferred equipment first, never
 * repeating an exercise in a workout. A slot with nothing allowed keeps the fixed exercise and is reported.
 */
export function rulesPicks(programId: ProgramId, answers: TailorAnswers): { picks: TailorPick[]; keptFixed: string[] } {
  const picks: IdPick[] = [];
  const keptFixed: string[] = [];
  const preferred = PREFERRED[answers.preference];
  for (const o of allowedOptions(programId, answers)) {
    const used = new Set(picks.filter((p) => p.slotKey === o.slotKey).map((p) => p.exerciseId));
    const rank = (id: string): number => (preferred.includes(exercise(id).equipment as Equipment) ? 0 : 1);
    const ordered = [...o.allowed].sort((a, b) => rank(a) - rank(b));
    let choice = ordered.find((id) => !used.has(id));
    if (choice === undefined) {
      // Relax step by step: ignore missing equipment, then the avoid list, then keep the fixed exercise.
      keptFixed.push(o.label);
      choice = o.menu.find((id) => !used.has(id) && !answers.avoid.includes(id)) ?? o.menu.find((id) => !used.has(id)) ?? o.fixedId;
    }
    picks.push({ slotKey: o.slotKey, order: o.order, exerciseId: choice });
  }
  return { picks: withSwaps(programId, answers, picks), keptFixed };
}

/** What the AI is given: only slots that still have a real choice, with names, and the preference. No free text. */
export function tailorInput(programId: ProgramId, answers: TailorAnswers, monthsTraining: number | null) {
  return {
    program_days: PROGRAMS[programId].sessionsPerWeek,
    months_training: monthsTraining,
    preference: answers.preference,
    slots: allowedOptions(programId, answers)
      .filter((o) => o.allowed.length > 1)
      .map((o) => ({ slot_key: o.slotKey, order: o.order, options: o.allowed.map((id) => ({ id, name: exercise(id).name, equipment: exercise(id).equipment })) })),
  };
}

export type PicksCheck = { readonly ok: true; readonly picks: TailorPick[] } | { readonly ok: false; readonly reason: string };

/** Checks an AI result's picks (T-05 to T-07). Slots with one allowed option need no pick; the app fills them. */
export function validateAiPicks(programId: ProgramId, answers: TailorAnswers, raw: unknown): PicksCheck {
  const list = (raw as { picks?: unknown } | null)?.picks;
  if (!Array.isArray(list)) return { ok: false, reason: "no picks" };
  const options = allowedOptions(programId, answers);
  const chosen = new Map<string, string>();
  for (const item of list) {
    const o = item as { slot_key?: unknown; order?: unknown; exercise_id?: unknown };
    if (typeof o.slot_key !== "string" || typeof o.order !== "number" || typeof o.exercise_id !== "string") return { ok: false, reason: "malformed pick" };
    const opt = options.find((x) => x.slotKey === o.slot_key && x.order === o.order);
    if (opt === undefined) return { ok: false, reason: `unknown slot ${o.slot_key} ${o.order}` };
    if (chosen.has(opt.label)) return { ok: false, reason: `two picks for ${opt.label}` };
    if (!opt.allowed.includes(o.exercise_id)) return { ok: false, reason: `${o.exercise_id} is not an allowed option for ${opt.label}` };
    chosen.set(opt.label, o.exercise_id);
  }
  const picks: IdPick[] = [];
  for (const opt of options) {
    const id = chosen.get(opt.label) ?? (opt.allowed.length === 1 ? opt.allowed[0] : opt.allowed.length === 0 ? opt.fixedId : undefined);
    if (id === undefined) return { ok: false, reason: `no pick for ${opt.label}` };
    picks.push({ slotKey: opt.slotKey, order: opt.order, exerciseId: id });
  }
  const seen = new Set<string>();
  for (const p of picks) {
    const key = `${p.slotKey}|${p.exerciseId}`;
    if (seen.has(key)) return { ok: false, reason: `${p.exerciseId} repeats in workout ${p.slotKey}` };
    seen.add(key);
  }
  return { ok: true, picks: withSwaps(programId, answers, picks) };
}

export type ExplanationCheck = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: string };

/** Checks the AI's explanation (T-08): short, no digits, no medical wording, names only exercises in or offered to the plan. */
export function validateExplanation(raw: unknown, programId: ProgramId, answers: TailorAnswers, picks: readonly TailorPick[]): ExplanationCheck {
  if (typeof raw !== "string") return { ok: false, reason: "not text" };
  const text = raw.trim();
  if (text === "") return { ok: false, reason: "empty" };
  if (text.split(/\s+/).length > EXPLANATION_MAX_WORDS) return { ok: false, reason: "too long" };
  if (/\d/.test(text)) return { ok: false, reason: "contains a number" };
  if (FORBIDDEN_WORDING.test(text)) return { ok: false, reason: "forbidden wording" };
  const known = new Set<string>(picks.map((p) => p.exerciseId));
  for (const o of allowedOptions(programId, answers)) {
    known.add(o.fixedId);
    for (const id of o.menu) known.add(id);
  }
  const lower = text.toLowerCase();
  for (const e of Object.values(EXERCISES)) if (lower.includes(e.name.toLowerCase()) && !known.has(e.id)) return { ok: false, reason: `names ${e.name}, which is not offered` };
  return { ok: true, text };
}

/** The plan for the preview and for workouts: the program with this plan's exercises and swaps in place. */
export function tailoredProgram(programId: ProgramId, picks: readonly TailorPick[]): Program {
  const base = PROGRAMS[programId];
  return {
    ...base,
    slots: base.slots.map((s) => ({
      ...s,
      exercises: s.exercises.map((r) => {
        const p = picks.find((x) => x.slotKey === s.key && x.order === r.order);
        return p === undefined ? r : { ...r, exerciseId: p.exerciseId, swapId: p.swapId };
      }),
    })),
  };
}

/** The plan to use now: the AI's if it passed, otherwise the rules plan, with a fixed or validated explanation. */
export function buildTailoredPlan(args: { programId: ProgramId; answers: TailorAnswers; ai: unknown | null; createdAt: string }): TailoredPlan {
  const { programId, answers, ai, createdAt } = args;
  const rules = rulesPicks(programId, answers);
  const base = { programId, answers, specVersion: TAILOR_SPEC_VERSION, createdAt };
  const aiPicks = ai === null ? null : validateAiPicks(programId, answers, ai);
  if (aiPicks?.ok === true) {
    const ex = validateExplanation((ai as { explanation_text?: unknown }).explanation_text, programId, answers, aiPicks.picks);
    return { ...base, picks: aiPicks.picks, source: "ai", explanation: ex.ok ? ex.text : FIXED_EXPLANATION, keptFixed: rules.keptFixed };
  }
  return { ...base, picks: rules.picks, source: "rules", explanation: FIXED_EXPLANATION, keptFixed: rules.keptFixed };
}

/** True when the answers change nothing, so the standard plan applies as is. */
export function isStandardPlan(plan: TailoredPlan): boolean {
  const fixed = fixedPicks(plan.programId);
  return plan.picks.every((p) => fixed.some((f) => f.slotKey === p.slotKey && f.order === p.order && f.exerciseId === p.exerciseId));
}
