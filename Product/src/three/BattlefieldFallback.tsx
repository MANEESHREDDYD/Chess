import { Component, type ReactNode } from 'react';

type BattlefieldFallbackProps = {
  reason: 'no-webgl' | 'reduced-motion' | 'load-error' | null;
  /** The stable 2D board (BoardView) — always rendered as the fallback. */
  children: ReactNode;
};

const REASON_LABEL: Record<NonNullable<BattlefieldFallbackProps['reason']>, string> = {
  'no-webgl': '3D battlefield unavailable (WebGL not supported) — using the 2D board.',
  'reduced-motion': '3D battlefield disabled by your reduced-motion preference.',
  'load-error': '3D battlefield failed to load — using the 2D board.',
};

/**
 * Wraps the stable 2D board with a quiet notice when the user requested 3D
 * but it cannot run. The 2D board is always the safe path.
 */
export function BattlefieldFallback({ reason, children }: BattlefieldFallbackProps) {
  return (
    <div className="battlefield-fallback" data-qa="battlefield-fallback" data-reason={reason ?? ''}>
      {reason ? (
        <p className="battlefield-fallback__notice" role="status">
          {REASON_LABEL[reason]}
        </p>
      ) : null}
      {children}
    </div>
  );
}

type BoundaryProps = { fallback: ReactNode; children: ReactNode };
type BoundaryState = { failed: boolean };

/**
 * Catches lazy-chunk/WebGL initialization crashes from the 3D scene and
 * renders the provided 2D fallback instead. The board must never go blank.
 */
export class BattlefieldErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
