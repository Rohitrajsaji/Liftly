// Liftly's visual character: dot-matrix numerals, a dotted rest ring and a small dotted face. Everything is drawn as
// SVG dots, so it needs no font file and works offline. The real text stays in the page (visually hidden) so screen
// readers and tests read the same words.

import type { ReactNode } from "react";

// 5 x 7 dot-matrix glyphs. "#" is a lit dot.
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  ":": [".....", "..#..", "..#..", ".....", "..#..", "..#..", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "×": [".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "....."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

/** Dot-matrix text. `cell` is the width of one dot in px. Unknown characters are left blank. */
export function DotText({ text, cell = 6, className = "", unlit = true }: { readonly text: string; readonly cell?: number; readonly className?: string; readonly unlit?: boolean }) {
  const chars = [...text];
  const colW = 6; // 5 dot columns and one blank
  const width = chars.length * colW * cell;
  const height = 7 * cell;
  const dots: ReactNode[] = [];
  chars.forEach((ch, ci) => {
    const g = GLYPHS[ch] ?? GLYPHS[" "];
    g?.forEach((row, y) => {
      [...row].forEach((c, x) => {
        const lit = c === "#";
        if (!lit && !unlit) return;
        dots.push(<circle key={`${ci}-${x}-${y}`} cx={(ci * colW + x + 0.5) * cell} cy={(y + 0.5) * cell} r={cell * 0.36} opacity={lit ? 1 : 0.06} />);
      });
    });
  });
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className="sr-only">{text}</span>
      <svg aria-hidden="true" width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="currentColor" className="shrink-0">
        {dots}
      </svg>
    </span>
  );
}

/** A ring of dots that fills as time passes. `mark` (0 to 1) is where the suggested rest begins. */
export function DotRing({ progress, mark, ready, children, size = 176 }: { readonly progress: number; readonly mark: number; readonly ready: boolean; readonly children?: ReactNode; readonly size?: number }) {
  const n = 60;
  const r = size / 2 - 8;
  const lit = Math.round(Math.min(1, Math.max(0, progress)) * n);
  const markAt = Math.round(mark * n);
  return (
    <div className="relative mx-auto grid place-items-center" style={{ width: size, height: size }}>
      <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const on = i < lit;
          const isMark = i === markAt;
          return <circle key={i} cx={size / 2 + Math.cos(a) * r} cy={size / 2 + Math.sin(a) * r} r={isMark ? 4 : 2.6} fill={on ? (ready ? "var(--color-accent)" : "var(--color-ink)") : isMark ? "var(--color-accent)" : "var(--color-line)"} />;
        })}
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

export type Mood = "ready" | "calm" | "stop" | "happy";

/** A small dotted face. Calm and friendly, never alarming: the eyes are the one orange detail. */
export function DotFace({ mood = "ready", size = 88, className = "" }: { readonly mood?: Mood; readonly size?: number; readonly className?: string }) {
  const c = size / 2;
  const ring = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    return <circle key={i} cx={c + Math.cos(a) * (c - 5)} cy={c + Math.sin(a) * (c - 5)} r={1.8} fill="currentColor" opacity={0.55} />;
  });
  const eye = (x: number) => <circle cx={c + x} cy={c - size * 0.08} r={size * 0.05} fill="var(--color-accent)" />;
  const mouth = (): ReactNode => {
    const pts: [number, number][] = [];
    for (let i = -3; i <= 3; i++) {
      const t = i / 3;
      const curve = mood === "stop" ? 0 : mood === "calm" ? 0.2 : mood === "happy" ? 1.3 : 0.7;
      pts.push([c + t * size * 0.16, c + size * 0.2 + (t * t - 1) * -curve * size * 0.04]);
    }
    return pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.6} fill="currentColor" opacity={0.8} />);
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      {ring}
      {eye(-size * 0.16)}
      {eye(size * 0.16)}
      {mouth()}
    </svg>
  );
}

/** Four dots for the effort scale: 1 lit is Easy, 4 lit is Failed. Decorative; the label carries the meaning. */
export function EffortDots({ level }: { readonly level: 1 | 2 | 3 | 4 }) {
  return (
    <span aria-hidden="true" className="flex gap-1">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`size-2 rounded-full ${i <= level ? "bg-accent" : "bg-line"}`} />
      ))}
    </span>
  );
}

/** One dot per exercise of a workout: lit for done. */
export function ProgressDots({ done, total }: { readonly done: number; readonly total: number }) {
  return (
    <span aria-hidden="true" className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`size-2.5 rounded-full ${i < done ? "bg-accent" : "bg-line"}`} />
      ))}
    </span>
  );
}
