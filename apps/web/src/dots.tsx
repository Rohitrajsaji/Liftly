// Small progress visuals. Plain shapes only: a thin bar and a row of dots.

/** A thin bar. `mark` (0 to 1) draws a tick where the suggested rest begins. */
export function Bar({ value, mark, accent }: { readonly value: number; readonly mark?: number; readonly accent: boolean }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div aria-hidden="true" className="pressed relative h-3 rounded-full">
      <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${accent ? "bg-accent" : "bg-ink"}`} style={{ width: `${pct}%` }} />
      {mark !== undefined && <div className="absolute top-[-3px] h-[18px] w-0.5 bg-ink/50" style={{ left: `${Math.round(mark * 100)}%` }} />}
    </div>
  );
}

/** One dot per exercise of a workout: filled for done. */
export function ProgressDots({ done, total }: { readonly done: number; readonly total: number }) {
  return (
    <span aria-hidden="true" className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`size-3 rounded-full transition-colors duration-300 ${i < done ? "bg-accent" : "pressed"}`} />
      ))}
    </span>
  );
}
