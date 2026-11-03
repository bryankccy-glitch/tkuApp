import { lazy, Suspense } from 'react';
import { cn } from '@/lib/cn';
import type { SceneState } from './sceneTypes';

// The animated scene (canvas drawing for sky, river, bridge, rain...) is decoration, so it is kept
// out of the first download: the greeting, summary and cards render first and the scene fades in
// as soon as its chunk arrives. Until then the hero shows its own dark background.
const PixelCampusScene = lazy(() => import('./PixelCampusScene').then((m) => ({ default: m.PixelCampusScene })));

type Props = { scene: SceneState; label: string; className?: string };

export function LazyPixelCampusScene(props: Props) {
  return (
    <Suspense
      fallback={
        // Same accessible name as the real scene. No data-scene attribute, so tests and tools that
        // wait for the drawn scene keep waiting for the real one.
        <div role="img" aria-label={props.label} className={cn('absolute inset-0', props.className)} />
      }
    >
      <PixelCampusScene {...props} />
    </Suspense>
  );
}
