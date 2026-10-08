/** Grams to a kilogram string without trailing zeros: 7500 is "7.5", 10000 is "10", 0 is "0". */
export function formatKg(g: number): string {
  const kg = g / 1000;
  return Number.isInteger(kg) ? String(kg) : String(Number(kg.toFixed(3)));
}

export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}

/** "m:ss" for a duration in seconds. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
