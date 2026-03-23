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

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
            <p className="mt-2 text-gray-600">Please reload the page to try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
