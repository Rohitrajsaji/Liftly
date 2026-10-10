// Shared building blocks. Every control is at least 56 px tall (text is small, targets are not): large targets for gym use (UX §2, §10).

import { createContext, useContext, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { readonly variant?: "primary" | "secondary" };

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  const look =
    variant === "primary"
      ? "bg-accent text-accent-ink shadow-[6px_6px_12px_var(--shadow-dark),-6px_-6px_12px_var(--shadow-light)] active:shadow-[inset_3px_3px_6px_rgb(0_0_0/0.35)] disabled:opacity-40"
      : "raised text-ink disabled:opacity-40";
  return <button type="button" className={`min-h-14 w-full rounded-full px-5 text-base font-medium ${look} ${className}`} {...rest} />;
}

/** A text link styled action. No side padding, so it lines up with the content edge like every card and heading. */
export function LinkButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`min-h-12 text-base font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent ${className}`} {...rest} />;
}

/** Which way the current screen arrived: forward from the right, back from the left, or a cross-fade between tabs. */
export type MotionDir = "forward" | "back" | "fade";
export const MotionContext = createContext<MotionDir>("forward");

const MOTION_CLASS: Record<MotionDir, string> = { forward: "screen-fwd", back: "screen-back", fade: "screen-fade" };

export function Screen({
  title,
  children,
  actions,
  eyebrow,
  flow = false,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
  /** Small label above the title, like "Saturday 10 Oct". */
  readonly eyebrow?: string;
  /** Actions follow the content instead of sticking to the bottom (used where they would cover the main buttons). */
  readonly flow?: boolean;
}) {
  const dir = useContext(MotionContext);
  return (
    <section className={`${MOTION_CLASS[dir]} flex flex-1 flex-col gap-5`}>
      <div className="flex flex-col gap-1">
        {eyebrow !== undefined && <p className="eyebrow">{eyebrow}</p>}
        <h1 tabIndex={-1} className="text-2xl font-semibold leading-snug outline-none" data-screen-title>
          {title}
        </h1>
      </div>
      <div className="flex flex-1 flex-col gap-5">{children}</div>
      {actions !== undefined &&
        (flow ? (
          <div className="flex flex-col gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">{actions}</div>
        ) : (
          // Sticks to the bottom across the full width, with a soft fade above it so cards slide under it instead of being cut.
          <div className="pointer-events-none sticky bottom-0 z-10 -mx-4 mt-auto bg-gradient-to-t from-bg from-70% to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
            <div className="pointer-events-auto flex flex-col gap-3">{actions}</div>
          </div>
        ))}
    </section>
  );
}

export function Note({ tone = "info", children }: { readonly tone?: "info" | "warn"; readonly children: ReactNode }) {
  const look = tone === "warn" ? "bg-warn-soft text-warn-ink" : "pressed text-ink";
  return <p className={`rounded-3xl p-4 text-[15px] leading-relaxed ${look}`}>{children}</p>;
}
