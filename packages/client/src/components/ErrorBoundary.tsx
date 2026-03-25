import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("React error boundary caught:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
          <div className="rounded-3xl bg-[var(--color-surface)] p-8 text-center shadow-card" role="alert">
            <p className="text-4xl" data-emoji>&#128533;</p>
            <h1 className="mt-4 font-display text-xl font-bold text-[var(--color-text)]">Something went wrong</h1>
            <p className="mt-2 text-[var(--color-text-muted)]">An unexpected error occurred.</p>
            <button
              onClick={this.handleRetry}
              className="mt-6 rounded-full bg-[var(--color-amber-500)] px-6 py-3 font-display font-bold text-white shadow-card"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
