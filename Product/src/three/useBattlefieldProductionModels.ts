import { useEffect, useState } from 'react';
import { allBattlefieldModelUrls } from './battlefieldModelSlots';

export type BattlefieldProductionModelStatus = {
  checked: boolean;
  availableUrls: ReadonlySet<string>;
  detectedUrls: ReadonlySet<string>;
  missingUrls: string[];
  mode: 'production-glb' | 'procedural-fallback';
};

const emptySet = new Set<string>();

export function useBattlefieldProductionModels(): BattlefieldProductionModelStatus {
  const [status, setStatus] = useState<BattlefieldProductionModelStatus>({
    checked: false,
    availableUrls: emptySet,
    detectedUrls: emptySet,
    missingUrls: allBattlefieldModelUrls(),
    mode: 'procedural-fallback',
  });

  useEffect(() => {
    let cancelled = false;
    const urls = allBattlefieldModelUrls();

    async function checkAssets() {
      const results = await Promise.all(
        urls.map(async (url) => {
          try {
            const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
            const contentType = response.headers.get('content-type') ?? '';
            const contentLength = Number(response.headers.get('content-length') ?? '0');
            const looksLikeModel =
              contentType.includes('model/gltf') ||
              contentType.includes('application/octet-stream') ||
              contentType === '';
            if (response.ok && looksLikeModel && contentLength !== 0) return url;
          } catch {
            // Missing production assets are expected until the approved GLB pack lands.
          }
          return null;
        })
      );
      if (cancelled) return;

      const available = new Set(results.filter((url): url is string => Boolean(url)));
      const completePack = available.size === urls.length;
      setStatus({
        checked: true,
        availableUrls: completePack ? available : emptySet,
        detectedUrls: available,
        missingUrls: urls.filter((url) => !available.has(url)),
        mode: completePack ? 'production-glb' : 'procedural-fallback',
      });
    }

    void checkAssets();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
