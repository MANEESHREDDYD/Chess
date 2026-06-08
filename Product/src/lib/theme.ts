export type ThemeId = 'standard' | string;

export type PieceKey =
  | 'wP'
  | 'wR'
  | 'wN'
  | 'wB'
  | 'wQ'
  | 'wK'
  | 'bP'
  | 'bR'
  | 'bN'
  | 'bB'
  | 'bQ'
  | 'bK';

export interface ThemeManifest {
  id: string;
  name: string;
  pieces: Record<PieceKey, string>;
  board: {
    lightSquare: string;
    darkSquare: string;
    background: string;
  };
  fx?: {
    capture?: {
      dir: string;
      frames: number;
      fps: number;
    };
  };
}

const THEME_ROOT = '/themes';

export function getThemeManifestUrl(themeId: string): string {
  return `${THEME_ROOT}/${themeId}/theme.json`;
}

export function getThemeAssetUrl(themeId: string, assetPath: string): string {
  if (assetPath.startsWith('data:') || assetPath.startsWith('http')) {
    return assetPath;
  }
  return `${THEME_ROOT}/${themeId}/${assetPath}`;
}

export async function loadThemeManifest(themeId: ThemeId): Promise<ThemeManifest | null> {
  if (themeId === 'standard') return null;

  if (themeId === 'mahabharata') {
    const { mahabharataManifest } = await import('../theme/mahabharataTheme');
    return mahabharataManifest;
  }

  const response = await fetch(getThemeManifestUrl(themeId));
  if (!response.ok) {
    throw new Error(`Failed to load theme manifest for ${themeId}: ${response.status}`);
  }

  return (await response.json()) as ThemeManifest;
}

export function isStandardTheme(themeId: ThemeId): themeId is 'standard' {
  return themeId === 'standard';
}