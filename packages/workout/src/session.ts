// Running a workout: the calibration ramp, working sets, effort taps, pain, and the decision after the session.
// Every function returns a new record; nothing is changed in place. Weights come from the engine and the ladder only.

import { exercise, type ProgramId, type SlotKey } from "@liftly/catalog";
import {
  daysBetween,
  decideNext,
  ENGINE_VERSION,
  MAX_RAMP_SETS,
  missThreshold,
  nextRampStep,
  recordSwapSession,
  reportPain as enginePain,
  REP_RANGES,
  seriousReasons,
  type Effort,
  type ExerciseType,
  type PainReport,
  type RampSet,
} from "@liftly/engine";
import { daysSinceLast, type PlannedExercise } from "./plan";
import { exerciseState, slotState } from "./state";
import type { ExerciseOutcome, ExerciseRecord, PainLocation, PainRecord, PlanState, SessionRecord, SetRecord, WorkoutContext } from "./types";

export type Step =
  | { readonly kind: "ramp"; readonly weightG: number; readonly targetReps: number; readonly rampNo: number; readonly maxRampSets: number }
  | { readonly kind: "working"; readonly weightG: number; readonly targetReps: number; readonly setNo: number; readonly totalSets: number; readonly missFloor: number; readonly firstExposure: boolean }
  | { readonly kind: "complete" }
  | { readonly kind: "stopped" };

function typeOf(id: string): ExerciseType {
  const t = exercise(id).type;
  if (t === null) throw new Error(`${id} has no class`);
  return t;
}

export const workingSets = (er: ExerciseRecord): readonly SetRecord[] => er.sets.filter((s) => s.kind === "working");

const rampSetsOf = (er: ExerciseRecord): RampSet[] =>
  er.sets.filter((s) => s.partOfRamp).map((s) => ({ weightG: s.weightG, reps: s.reps, effort: s.effort }));

function rampStep(er: ExerciseRecord) {
  return nextRampStep({
    exerciseType: typeOf(er.exerciseId),
    ladderG: er.ladderG,
    startG: er.rampStartG ?? er.prescription.weightG,
    rampSets: rampSetsOf(er),
    recalibration: er.prescription.decisionType === "recalibration",
  });
}

/** What the user should do next on this exercise. */
export function currentStep(er: ExerciseRecord): Step {
  if (er.status === "stopped_pain") return { kind: "stopped" };
  if (er.status === "done" || er.status === "skipped") return { kind: "complete" };
  const range = REP_RANGES[typeOf(er.exerciseId)];
  const logged = workingSets(er).length;

  if (er.prescription.kind === "calibration") {
    const step = rampStep(er);
    if (step.kind === "ramp") return { kind: "ramp", weightG: step.weightG, targetReps: step.targetReps, rampNo: er.sets.filter((s) => s.partOfRamp).length + 1, maxRampSets: MAX_RAMP_SETS };
    if (logged >= er.targetSets) return { kind: "complete" };
    // Ramp finished: the rest of the working sets at the weight it found. Its first exposure floor applies (C1).
    return { kind: "working", weightG: step.workingWeightG, targetReps: step.targetReps, setNo: logged + 1, totalSets: er.targetSets, missFloor: missThreshold(range, true), firstExposure: true };
  }
  if (logged >= er.targetSets) return { kind: "complete" };
  const weightG = er.workingWeightG ?? er.prescription.weightG;
  return { kind: "working", weightG, targetReps: er.prescription.targetReps, setNo: logged + 1, totalSets: er.targetSets, missFloor: missThreshold(range, er.prescription.firstExposure), firstExposure: er.prescription.firstExposure };
}

export function startSession(plan: readonly PlannedExercise[], args: { id: string; programId: ProgramId; slotKey: SlotKey; today: string; now: Date; state: PlanState }): SessionRecord {
  const exercises = plan
    .filter((p) => !p.paused)
    .map((p, i): ExerciseRecord => {
      if (p.exerciseId === null || p.prescription === null) throw new Error("Paused exercises are not part of a session");
      return {
        slotOrder: i + 1,
        exerciseId: p.exerciseId,
        slotExerciseId: p.slotExerciseId,
        swapExerciseId: p.swapId,
        targetSets: p.sets,
        prescription: p.prescription,
        ladderG: [...p.ladderG],
        rampStartG: null,
        workingWeightG: p.prescription.kind === "working" ? p.prescription.weightG : null,
        sets: [],
        status: "pending",
        pain: null,
        painStateAfter: null,
        slotPausedAfter: false,
        painBeforeCalibrated: false,
        outcome: null,
      };
    });
  return {
    id: args.id,
    programId: args.programId,
    slotKey: args.slotKey,
    date: args.today,
    startedAt: args.now.toISOString(),
    endedAt: null,
    completion: null,
    daysSinceLastSession: daysSinceLast(args.state, args.today),
    engineVersion: ENGINE_VERSION,
    exercises,
  };
}

function replaceExercise(s: SessionRecord, index: number, er: ExerciseRecord): SessionRecord {
  return { ...s, exercises: s.exercises.map((e, i) => (i === index ? er : e)) };
}

function exerciseAt(s: SessionRecord, index: number): ExerciseRecord {
  const er = s.exercises[index];
  if (er === undefined) throw new Error(`No exercise at ${index}`);
  return er;
}

function checkReps(reps: number): void {
  if (!Number.isInteger(reps) || reps < 0 || reps > 100) throw new Error(`Reps must be a whole number from 0 to 100: ${reps}`);
}

/**
 * Logs the next set on an exercise. The weight is the one the engine set: nothing about a set changes the weight.
 * During the ramp: Good ends it and is working set 1; Hard or Failed makes the previous step the working weight;
 * Easy moves up one step, at most five ramp sets.
 */
export function logSet(s: SessionRecord, index: number, args: { reps: number; effort: Effort; now: Date }): SessionRecord {
  checkReps(args.reps);
  const er = exerciseAt(s, index);
  const step = currentStep(er);
  if (step.kind === "complete" || step.kind === "stopped") throw new Error(`${er.exerciseId} has no more sets to log`);
  const loggedAt = args.now.toISOString();

  let set: SetRecord;
  if (step.kind === "ramp") {
    // A Good ramp set is the first working set; every other ramp set is not counted in volume.
    set = { kind: args.effort === "good" ? "working" : "ramp", partOfRamp: true, weightG: step.weightG, reps: args.reps, effort: args.effort, loggedAt };
  } else {
    set = { kind: "working", partOfRamp: false, weightG: step.weightG, reps: args.reps, effort: args.effort, loggedAt };
  }
  let next: ExerciseRecord = { ...er, sets: [...er.sets, set], status: "in_progress" };
  if (er.prescription.kind === "calibration") {
    const after = rampStep(next);
    if (after.kind === "done") next = { ...next, workingWeightG: after.workingWeightG };
  }
  if (currentStep(next).kind === "complete") next = { ...next, status: "done" };
  return replaceExercise(s, index, next);
}

/** Takes the last set back, so it can be logged again (the one-tap fix for a wrong tap). */
export function undoLastSet(s: SessionRecord, index: number): SessionRecord {
  const er = exerciseAt(s, index);
  if (er.sets.length === 0 || er.status === "stopped_pain") return s;
  const sets = er.sets.slice(0, -1);
  let next: ExerciseRecord = { ...er, sets, status: sets.length === 0 ? "pending" : "in_progress", outcome: null };
  if (er.prescription.kind === "calibration") {
    const after = rampStep(next);
    next = { ...next, workingWeightG: after.kind === "done" ? after.workingWeightG : null };
  }
  return replaceExercise(s, index, next);
}

/** Corrects reps or effort on a working set that is not part of the ramp. */
export function updateWorkingSet(s: SessionRecord, index: number, setIndex: number, patch: { reps?: number; effort?: Effort }): SessionRecord {
  const er = exerciseAt(s, index);
  const old = er.sets[setIndex];
  if (old === undefined) throw new Error(`No set ${setIndex}`);
  if (old.partOfRamp) throw new Error("Ramp sets cannot be edited; take the last set back and log it again");
  if (patch.reps !== undefined) checkReps(patch.reps);
  const updated: SetRecord = { ...old, ...(patch.reps !== undefined ? { reps: patch.reps } : {}), ...(patch.effort !== undefined ? { effort: patch.effort } : {}) };
  return replaceExercise(s, index, { ...er, sets: er.sets.map((x, i) => (i === setIndex ? updated : x)) });
}

/**
 * Picks a different ladder step before any set of the exercise is logged. Working exercise: the weight for every set.
 * Calibration: where the ramp starts (after 28 days away it can only be lower than the engine's start).
 * No weight changes once the first set is logged (PROGRESSION_ENGINE section 10).
 */
export function chooseWeight(s: SessionRecord, index: number, weightG: number): SessionRecord {
  const er = exerciseAt(s, index);
  if (er.sets.length > 0) throw new Error("The weight can't change during a workout");
  if (!er.ladderG.includes(weightG)) throw new Error("Pick a weight from your gym's list");
  if (er.prescription.kind === "calibration") {
    if (er.prescription.decisionType === "recalibration" && weightG > er.prescription.weightG) throw new Error("After a long break, start at or below half your last weight");
    return replaceExercise(s, index, { ...er, rampStartG: weightG });
  }
  return replaceExercise(s, index, { ...er, workingWeightG: weightG });
}

/** The user ends this exercise early (always allowed). */
export function endExercise(s: SessionRecord, index: number): SessionRecord {
  const er = exerciseAt(s, index);
  if (er.status === "stopped_pain") return s;
  return replaceExercise(s, index, { ...er, status: er.sets.length > 0 ? "done" : "skipped" });
}

export interface PainInput {
  readonly id: string;
  readonly location: PainLocation;
  readonly severity: number;
  readonly atRestOrNight: boolean;
  readonly numbnessTinglingSwellingInstability: boolean;
}

export interface PainResult {
  readonly session: SessionRecord;
  readonly showProfessionalHelp: boolean;
  readonly record: PainRecord;
}

/**
 * Pain on an exercise stops it for the session and freezes its progression. On an original exercise, the next
 * exposure uses the swap with a ramp. On a swap there is nothing approved to move to, so the slot pauses.
 */
export function reportPain(s: SessionRecord, index: number, state: PlanState, ctx: WorkoutContext, args: { pain: PainInput; now: Date }): PainResult {
  const er = exerciseAt(s, index);
  if (!Number.isInteger(args.pain.severity) || args.pain.severity < 0 || args.pain.severity > 10) throw new Error("Severity is 0 to 10");
  const slot = slotState(state, er.slotExerciseId);
  const onSwap = er.exerciseId !== er.slotExerciseId;
  const day = Math.max(0, daysBetween(ctx.startDate, s.date));
  const report: PainReport = {
    day,
    severity: args.pain.severity,
    atRestOrNight: args.pain.atRestOrNight,
    presentAfter24h: null,
    numbnessTinglingSwellingInstability: args.pain.numbnessTinglingSwellingInstability,
  };
  const lastSet = er.sets.at(-1);
  const knownWeight = er.workingWeightG ?? lastSet?.weightG ?? er.rampStartG ?? er.prescription.weightG;
  const beforeCalibrated = er.workingWeightG === null;

  let painStateAfter = slot.pain;
  let paused = false;
  let reasons;
  if (onSwap) {
    reasons = seriousReasons(report, []);
    painStateAfter = recordSwapSession(slot.pain, true).state;
    paused = true;
  } else {
    const out = enginePain(slot.pain, report, knownWeight);
    painStateAfter = out.state;
    reasons = out.seriousReasons;
  }
  const record: PainRecord = {
    id: args.pain.id,
    reportedAt: args.now.toISOString(),
    exerciseId: er.exerciseId,
    location: args.pain.location,
    severity: args.pain.severity,
    atRestOrNight: args.pain.atRestOrNight,
    numbnessTinglingSwellingInstability: args.pain.numbnessTinglingSwellingInstability,
    seriousReasons: reasons,
    showedProfessionalHelp: reasons.length > 0,
    onSwap,
  };
  const next: ExerciseRecord = {
    ...er,
    status: "stopped_pain",
    pain: record,
    painStateAfter,
    slotPausedAfter: paused,
    painBeforeCalibrated: beforeCalibrated,
    workingWeightG: er.workingWeightG ?? knownWeight,
  };
  return { session: replaceExercise(s, index, next), showProfessionalHelp: record.showedProfessionalHelp, record };
}

function outcomeFor(er: ExerciseRecord, s: SessionRecord, state: PlanState): ExerciseOutcome {
  const type = typeOf(er.exerciseId);
  const ex = exerciseState(state, er.exerciseId);
  const working = workingSets(er);
  const calibration = er.prescription.kind === "calibration";
  const ramp = calibration ? rampStep(er) : null;
  const calibratedWeightG = ramp !== null && ramp.kind === "done" ? ramp.workingWeightG : null;
  const painReported = er.pain !== null;
  if (working.length === 0 && !painReported) return { decision: null, calibratedWeightG };

  const weightG = er.workingWeightG ?? calibratedWeightG ?? er.sets.at(-1)?.weightG ?? er.prescription.weightG;
  const firstSession = ex.firstSessionDate ?? s.date;
  const decision = decideNext({
    exerciseType: type,
    ladderG: er.ladderG,
    workingWeightG: weightG,
    sets: working.map((w) => ({ reps: w.reps, effort: w.effort })),
    firstExposure: calibration ? true : er.prescription.firstExposure,
    painReported,
    daysSinceFirstSession: Math.max(0, daysBetween(firstSession, s.date)),
    daysSinceLastSession: s.daysSinceLastSession,
    priorExposures: ex.exposures,
  });
  return { decision, calibratedWeightG };
}

/** Ends the workout and runs the engine on every exercise that was done. The new targets apply from the next session. */
export function finishSession(s: SessionRecord, state: PlanState, now: Date): SessionRecord {
  const exercises = s.exercises.map((er): ExerciseRecord => {
    const status = er.status === "pending" ? "skipped" : er.status === "in_progress" ? "done" : er.status;
    const closed = { ...er, status } as ExerciseRecord;
    return status === "skipped" ? closed : { ...closed, outcome: outcomeFor(closed, s, state) };
  });
  const full = exercises.every((e) => e.status === "done");
  return { ...s, exercises, endedAt: now.toISOString(), completion: full ? "full" : "partial" };
}
