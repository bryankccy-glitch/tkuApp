import { useState } from 'react';
import { CAMPUS_CENTER, type CampusPlace } from '@/data/places';
import { t } from '@/i18n/t';

/** Point symbols only: the repository has OSM centres, not footprints or measured heights.
 * A uniform 3-storey × 3m symbol is used; sports grounds/gates remain flat.
 * Projection is recomputed only on input, with no animation loop or external requests.
 */
export default function CampusMap3D({ places, selected }: { places: CampusPlace[]; selected?: CampusPlace | null }) {
  const [bearing, setBearing] = useState(0);
  const [tilt, setTilt] = useState(50);
  const angle = bearing * Math.PI / 180;
  const pitch = tilt * Math.PI / 180;
  const project = (x: number, y: number, z: number): [number, number] => {
    const rx = x * Math.cos(angle) - y * Math.sin(angle);
    const ry = x * Math.sin(angle) + y * Math.cos(angle);
    return [200 + rx * 0.34, 125 + ry * 0.34 * Math.cos(pitch) - z * Math.sin(pitch)];
  };
  const symbols = places.flatMap((p) => {
    if (!p.coords) return [];
    const x = (p.coords.lng - CAMPUS_CENTER.lng) * 100700;
    const y = -(p.coords.lat - CAMPUS_CENTER.lat) * 111320;
    return [{ p, x, y, depth: x * Math.sin(angle) + y * Math.cos(angle) }];
  }).sort((a, b) => a.depth - b.depth);
  return <div className="flex h-full min-w-0 flex-col bg-sunken">
    <svg viewBox="0 0 400 240" className="min-h-0 w-full flex-1 text-primary" role="img" aria-label={t('map3d.scene')} data-testid="campus-3d">
      <title>{t('map3d.scene')}</title>
      {symbols.map(({ p, x, y }) => {
        const height = ['sports', 'other', 'gate'].includes(p.category) ? 0 : 18;
        const corners = [[-7, -7], [7, -7], [7, 7], [-7, 7]] as const;
        const base = corners.map(([dx, dy]) => project(x + dx, y + dy, 0));
        const roof = corners.map(([dx, dy]) => project(x + dx, y + dy, height));
        const points = (v: [number, number][]) => v.map((pt) => pt.join(',')).join(' ');
        return <g key={p.code} data-building={p.code} opacity={selected && selected.code !== p.code ? 0.5 : 1}>
          <title>{p.code} · {p.name}</title>
          {height > 0 && base.map((pt, i) => <polygon key={i} points={points([pt, base[(i + 1) % 4]!, roof[(i + 1) % 4]!, roof[i]!])} fill="currentColor" stroke="currentColor" strokeWidth="0.5" fillOpacity={0.4 + i * 0.12} />)}
          <polygon points={points(roof)} fill="currentColor" fillOpacity="0.8" />
          <text x={project(x, y, height)[0]} y={project(x, y, height)[1] - 5} textAnchor="middle" className="fill-ink text-[10px] font-bold">{p.code}</text>
        </g>;
      })}
    </svg>
    <div className="flex gap-3 px-3 pb-2 text-caption text-ink">
      <label className="min-w-0 flex-1">{t('map3d.rotate')}<input className="block w-full accent-primary" type="range" min="-180" max="180" value={bearing} onChange={(e) => setBearing(Number(e.target.value))} /></label>
      <label className="min-w-0 flex-1">{t('map3d.tilt')}<input className="block w-full accent-primary" type="range" min="20" max="70" value={tilt} onChange={(e) => setTilt(Number(e.target.value))} /></label>
    </div>
  </div>;
}
