// Shared building blocks. Every control is at least 56 px tall (text is small, targets are not): large targets for gym use (UX §2, §10).

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { readonly variant?: "primary" | "secondary" };

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  const look =
    variant === "primary"
      ? "bg-accent text-accent-ink shadow-[6px_6px_12px_var(--shadow-dark),-6px_-6px_12px_var(--shadow-light)] active:shadow-[inset_3px_3px_6px_rgb(0_0_0/0.35)] disabled:opacity-40"
      : "raised text-ink disabled:opacity-40";
  return <button type="button" className={`min-h-14 w-full rounded-full px-5 text-base font-medium ${look} ${className}`} {...rest} />;
}

export function Screen({ title, children, actions, eyebrow, flow = false }: { readonly title: string; readonly children: ReactNode; readonly actions?: ReactNode; /** Small mono label above the title, like "TODAY". */ readonly eyebrow?: string; /** Actions follow the content instead of sticking to the bottom (used where they would cover the main buttons). */ readonly flow?: boolean }) {
  return (
    <section className="screen-in flex flex-1 flex-col gap-5">
      {eyebrow !== undefined && <p className="eyebrow -mb-3">{eyebrow}</p>}
      <h1 tabIndex={-1} className="text-2xl font-semibold leading-snug outline-none" data-screen-title>
        {title}
      </h1>
      <div className="flex flex-1 flex-col gap-5">{children}</div>
      {actions !== undefined && <div className={`flex flex-col gap-3 bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 ${flow ? "" : "sticky bottom-0"}`}>{actions}</div>}
    </section>
  );
}

export function Note({ tone = "info", children }: { readonly tone?: "info" | "warn"; readonly children: ReactNode }) {
  const look = tone === "warn" ? "bg-warn-soft text-warn-ink" : "pressed text-ink";
  return <p className={`rounded-3xl p-4 text-[15px] leading-relaxed ${look}`}>{children}</p>;
}
