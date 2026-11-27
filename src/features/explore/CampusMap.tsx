import { cn } from '@/lib/cn';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CAMPUS_CENTER, type CampusPlace } from '@/data/places';
import type { MyLocation } from '@/hooks/useMyLocation';
import { t } from '@/i18n/t';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { pinHtml } from './mapStyle';

// The entire renderer (including MapLibre and its CSS) is fetched only on 3D entry.
const CampusMap3D = lazy(() => import('./CampusMap3D').catch(() => ({ default: MapUnavailable })));
function MapUnavailable({ onUnavailable }: { onUnavailable: () => void }) {
  useEffect(onUnavailable, [onUnavailable]);
  return <></>;
}

/**
 * OpenStreetMap-based campus map. Only shows markers whose coordinates are verified;
 * the campus centre marker comes from Wikipedia. No fabricated building positions.
 */
export default function CampusMap({ places, selected, me, recenter = 0, onSelect }: {
  places: CampusPlace[];
  onSelect?: (place: CampusPlace) => void;
  selected?: CampusPlace | null;
  /** The viewer's own position (stays on the device). */
  me?: MyLocation | null;
  /** Increment to fly to `me` again (e.g. the 定位 button was pressed). */
  recenter?: number;
}) {
  const [mode, setMode] = useState<'2d' | '3d'>(() => {
    try { return localStorage.getItem('tku.explore.mapMode') === '3d' ? '3d' : '2d'; }
    catch { return '2d'; }
  });
  const [unavailable, setUnavailable] = useState(false);
  const theme = useResolvedTheme();
  const changeMode = (next: '2d' | '3d') => {
    setUnavailable(false);
    setMode(next);
    try { localStorage.setItem('tku.explore.mapMode', next); } catch { /* Storage can be disabled. */ }
  };
  const fallback = useCallback(() => {
    setUnavailable(true);
    setMode('2d');
    try { localStorage.setItem('tku.explore.mapMode', '2d'); } catch { /* Storage can be disabled. */ }
  }, []);
  useEffect(() => { if (mode === '2d') map.current?.invalidateSize(); }, [mode]);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const meLayer = useRef<L.LayerGroup | null>(null);
  const centeredFor = useRef(-1);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    meLayer.current = L.layerGroup().addTo(map.current);
    // The container grows in full-screen mode; Leaflet only listens to window resizes by itself.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => map.current?.invalidateSize());
    ro?.observe(el.current);
    return () => { ro?.disconnect(); map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const centre = L.divIcon({
      className: '',
      html: '<span class="map-centre"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 18],
    });
    L.marker([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], { icon: centre, title: t('map.campus') }).bindPopup(t('map.campusPopup')).addTo(g);
    places.filter((p) => p.coords).forEach((p) => {
      const active = p.code === selected?.code;
      // Anchor at the tag's centre so the code sits on the building; the selected one floats above the rest.
      const icon = L.divIcon({ className: '', html: pinHtml(p.code, p.category, active), iconSize: [0, 0], iconAnchor: [0, 0] });
      L.marker([p.coords!.lat, p.coords!.lng], { icon, title: p.name, zIndexOffset: active ? 500 : 0, riseOnHover: true })
        .bindPopup(`${p.code}｜${p.name}`)
        .on('click', () => onSelect?.(p))
        .addTo(g);
    });
    if (selected?.coords) map.current?.setView([selected.coords.lat, selected.coords.lng], 18);
  }, [places, selected, onSelect]);

  useEffect(() => {
    const g = meLayer.current;
    if (!g) return;
    g.clearLayers();
    if (!me) return;
    // Accuracy halo + pulsing blue dot, the convention people know from phone maps.
    L.circle([me.lat, me.lng], { radius: Math.min(me.accuracy, 500), color: '#2F6FED', weight: 1, opacity: 0.5, fillColor: '#2F6FED', fillOpacity: 0.12, interactive: false }).addTo(g);
    L.marker([me.lat, me.lng], {
      icon: L.divIcon({
        className: '',
        html: '<span class="me-dot"><span></span></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      title: t('map.you'),
      zIndexOffset: 1000,
      keyboard: false,
    }).bindPopup(t('map.youPopup', { m: Math.round(me.accuracy) })).addTo(g);
    if (centeredFor.current !== recenter) {
      centeredFor.current = recenter;
      map.current?.setView([me.lat, me.lng], Math.max(map.current.getZoom(), 17));
    }
  }, [me, recenter]);

  return <div className="flex h-full min-w-0 flex-col">
    <div className="flex shrink-0 items-center gap-1 bg-surface px-2" role="group" aria-label={t('map3d.mode')}>
      {(['2d', '3d'] as const).map((value) => <button key={value} type="button" className={cn('my-1 h-9 min-w-11 rounded-sm px-3 text-caption font-semibold transition-colors', mode === value ? 'bg-primary text-white dark:text-[#1A0506]' : 'text-primary hover:bg-sunken')} aria-label={t('map3d.mode') + ' ' + value.toUpperCase()} aria-pressed={mode === value} onClick={() => changeMode(value)}>{value.toUpperCase()}</button>)}
    </div>
    <div className="relative min-h-0 flex-1">
      {/* Leaflet adds its own classes to the map element: toggle a wrapper so React never overwrites them. */}
      <div className={mode === '2d' ? 'h-full w-full' : 'hidden'}>
        <div className={cn('campus-map-2d h-full w-full', theme === 'dark' && 'campus-map-2d--dark')} ref={el} role="region" aria-label={t('map.label')} />
      </div>
      {mode === '3d' && <Suspense fallback={<p role="status" className="p-3 text-caption text-muted">{t('explore.mapLoading')}</p>}>
        <CampusMap3D key={theme} theme={theme} places={places} selected={selected} me={me} recenter={recenter} onSelect={onSelect} onUnavailable={fallback} />
      </Suspense>}
    </div>
    {unavailable && <p role="status" className="shrink-0 bg-surface px-2 py-1 text-caption text-muted">{t('map3d.unavailable')}</p>}
    {mode === '3d' && <p className="shrink-0 bg-surface px-2 py-1 text-[10px] text-muted">{t('map3d.notice')}</p>}
  </div>;
}
