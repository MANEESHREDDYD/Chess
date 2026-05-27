import type { ReactNode } from 'react';

type PieceCode = 'wP' | 'wN' | 'wB' | 'wR' | 'wQ' | 'wK' | 'bP' | 'bN' | 'bB' | 'bR' | 'bQ' | 'bK';

export function pieceIcon(piece: PieceCode): ReactNode {
  const fill = piece.startsWith('w') ? 'currentColor' : 'none';
  const stroke = 'currentColor';
  const common = { fill, stroke, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (piece) {
    case 'wP':
    case 'bP':
      return (
        <svg viewBox="0 0 48 48" role="img" aria-label="pawn icon">
          <circle cx="24" cy="15" r="8" {...common} />
          <path d="M16 34c2-7 6-10 8-10s6 3 8 10" {...common} />
          <path d="M14 36h20" {...common} />
        </svg>
      );
    case 'wN':
    case 'bN':
      return (
        <svg viewBox="0 0 48 48" role="img" aria-label="knight icon">
          <path d="M17 36h18l-2-8-5-3 1-8-6-8-8 8 3 5-2 7z" {...common} />
          <path d="M20 20c2-1 4-1 6 0" {...common} />
        </svg>
      );
    case 'wB':
    case 'bB':
      return (
        <svg viewBox="0 0 48 48" role="img" aria-label="bishop icon">
          <path d="M24 8c-5 4-7 9-7 14 0 7 4 11 4 11h6s4-4 4-11c0-5-2-10-7-14Z" {...common} />
          <path d="M19 36h10" {...common} />
          <path d="M24 14l3 3" {...common} />
        </svg>
      );
    case 'wR':
    case 'bR':
      return (
        <svg viewBox="0 0 48 48" role="img" aria-label="rook icon">
          <path d="M14 16h20v6H14z" {...common} />
          <path d="M16 22h16l-1 14H17z" {...common} />
          <path d="M14 40h20" {...common} />
        </svg>
      );
    case 'wQ':
    case 'bQ':
      return (
        <svg viewBox="0 0 48 48" role="img" aria-label="queen icon">
          <path d="M12 18l6 6 6-8 6 8 6-6-4 16H16z" {...common} />
          <path d="M16 40h16" {...common} />
        </svg>
      );
    case 'wK':
    case 'bK':
      return (
        <svg viewBox="0 0 48 48" role="img" aria-label="king icon">
          <path d="M24 10v10" {...common} />
          <path d="M19 15h10" {...common} />
          <path d="M18 20h12l3 16H15z" {...common} />
          <path d="M16 40h16" {...common} />
        </svg>
      );
    default:
      return null;
  }
}
