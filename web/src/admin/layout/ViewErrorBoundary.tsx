import { Component, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AdminIcon } from "../icons";

type BoundaryProps = { children: ReactNode; onError: (error: Error) => void };

class Boundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
    this.props.onError(error);
  }

  render(): ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/**
 * View-level error boundary (legacy `app.js` rendered the same markup when a
 * view threw). The retry button re-navigates to the current route.
 */
export function ViewErrorBoundary({ children }: { children: ReactNode }): JSX.Element {
  const navigate = useNavigate();
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <div className="empty">
        <AdminIcon name="alert" size={30} />
        <b>页面载入失败</b>
        <p>{error.message}</p>
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          id="retry"
          onClick={() => {
            setError(null);
            navigate(0);
          }}
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <Boundary
      onError={(caught) => {
        setError(caught);
      }}
    >
      {children}
    </Boundary>
  );
}
