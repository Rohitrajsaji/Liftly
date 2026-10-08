// Shared building blocks. Every control is at least 56 px tall: large targets for gym use (UX §2, §10).

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { readonly variant?: "primary" | "secondary" };

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  const look =
    variant === "primary"
      ? "bg-accent text-accent-ink disabled:opacity-40"
      : "border-2 border-line bg-surface text-ink disabled:opacity-40";
  return <button type="button" className={`min-h-14 w-full rounded-xl px-5 text-lg font-semibold ${look} ${className}`} {...rest} />;
}

export function Screen({ title, children, actions }: { readonly title: string; readonly children: ReactNode; readonly actions?: ReactNode }) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <h1 tabIndex={-1} className="text-3xl font-bold leading-tight outline-none" data-screen-title>
        {title}
      </h1>
      <div className="flex flex-1 flex-col gap-5">{children}</div>
      {actions !== undefined && <div className="sticky bottom-0 flex flex-col gap-3 bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{actions}</div>}
    </section>
  );
}

export function Note({ tone = "info", children }: { readonly tone?: "info" | "warn"; readonly children: ReactNode }) {
  const look = tone === "warn" ? "bg-warn-soft text-warn-ink" : "bg-accent-soft text-ink";
  return <p className={`rounded-xl p-4 text-base ${look}`}>{children}</p>;
}
