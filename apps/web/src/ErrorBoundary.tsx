// A last safety net: if a screen crashes, the person sees a calm message and a way out instead of a blank page.
// Workouts are saved to the phone as they are logged, so reloading loses nothing.

import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ readonly children: ReactNode }, { readonly failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Liftly crashed", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4" role="alert">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-base text-muted">Your workouts are saved on this phone. Reload to carry on.</p>
        <button type="button" onClick={() => window.location.reload()} className="min-h-14 w-full rounded-full bg-accent px-5 text-base font-medium text-accent-ink">
          Reload Liftly
        </button>
      </main>
    );
  }
}
