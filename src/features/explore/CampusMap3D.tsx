import { useEffect, useRef, useState } from 'react';
import { Map, Marker, AttributionControl, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CAMPUS_CENTER, type CampusPlace } from '@/data/places';
import type { MyLocation } from '@/hooks/useMyLocation';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { t } from '@/i18n/t';

interface Props {
  places: CampusPlace[];
  selected?: CampusPlace | null;
  me?: MyLocation | null;
  recenter: number;
  onSelect?: (place: CampusPlace) => void;
  onUnavailable: () => void;
}

/** Liberty supplies OSM footprints via OpenMapTiles; unknown heights are illustrative. */
export default function CampusMap3D({ places, selected, me, recenter, onSelect, onUnavailable }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const [ready, setReady] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!el.current) return;
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) { onUnavailable(); return; }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { onUnavailable(); return; }
    let instance: Map | undefined;
    let loaded = false;
    let disposed = false;
    const fail = () => { if (!disposed) onUnavailable(); };
    const timeout = window.setTimeout(fail, 20_000);
    try {
      instance = new Map({
        container: el.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [CAMPUS_CENTER.lng, CAMPUS_CENTER.lat],
        zoom: 16.5, pitch: 55, bearing: -20,
        attributionControl: false,
      });
      map.current = instance;
      instance.getCanvas().setAttribute('aria-label', t('map3d.scene'));
      // The OpenFreeMap style already credits OpenFreeMap, OpenMapTiles and OpenStreetMap; keep it visible, once.
      instance.addControl(new AttributionControl({ compact: false }), 'bottom-right');
      instance.addControl(new NavigationControl({ visualizePitch: true }), 'top-left');
      instance.on('webglcontextlost', fail);
      instance.on('error', () => { if (!loaded) fail(); });
      instance.on('load', () => {
        if (disposed || !instance) return;
        try {
          const layers = instance.getStyle().layers;
          const building = layers.find((layer) => 'source-layer' in layer && layer['source-layer'] === 'building');
          if (!building || !('source' in building)) { fail(); return; }
          // Avoid a second extrusion if the upstream style already includes one.
          for (const layer of layers) {
            if (layer.type === 'fill-extrusion' && layer['source-layer'] === 'building') instance.removeLayer(layer.id);
          }
          instance.addLayer({
            id: 'campus-buildings-3d', type: 'fill-extrusion',
            source: building.source, 'source-layer': 'building', minzoom: 14,
            paint: {
              'fill-extrusion-color': '#b7aaa0',
              'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 9],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.9,
            },
          }, layers.find((layer) => layer.type === 'symbol')?.id);
          loaded = true;
          window.clearTimeout(timeout);
          setReady(true);
        } catch { fail(); }
      });
    } catch { fail(); }
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      instance?.remove();
      map.current = null;
    };
  }, [onUnavailable]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const markers = places.flatMap((place) => {
      if (!place.coords) return [];
      const active = selected?.code === place.code;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = place.code;
      button.dataset.building = place.code;
      button.setAttribute('aria-label', `${place.code} ${place.name}`);
      button.setAttribute('aria-pressed', String(active));
      button.className = active
        ? 'rounded-sm border-2 border-primary bg-primary px-2 py-1 text-body font-bold text-white shadow-lift'
        : 'rounded-xs border border-line bg-surface px-1 text-caption font-bold text-ink';
      button.style.zIndex = active ? '1' : '0';
      button.addEventListener('click', () => onSelect?.(place));
      return [new Marker({ element: button }).setLngLat([place.coords.lng, place.coords.lat]).addTo(instance)];
    });
    return () => { markers.forEach((marker) => marker.remove()); };
  }, [ready, places, selected, onSelect]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !selected?.coords) return;
    const camera = { center: [selected.coords.lng, selected.coords.lat] as [number, number], zoom: 18 };
    if (reduced) instance.jumpTo(camera); else instance.flyTo(camera);
  }, [ready, selected, reduced]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !me) return;
    const dot = document.createElement('span');
    dot.className = 'block h-5 w-5 rounded-full border-2 border-white bg-[#2F6FED] shadow-lift';
    dot.setAttribute('role', 'img');
    dot.setAttribute('aria-label', t('map.youPopup', { m: Math.round(me.accuracy) }));
    const marker = new Marker({ element: dot }).setLngLat([me.lng, me.lat]).addTo(instance);
    return () => { marker.remove(); };
  }, [ready, me]);

  const centeredFor = useRef(-1);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !me || centeredFor.current === recenter) return;
    centeredFor.current = recenter;
    const camera = { center: [me.lng, me.lat] as [number, number], zoom: Math.max(instance.getZoom(), 17) };
    if (reduced) instance.jumpTo(camera); else instance.flyTo(camera);
  }, [ready, me, recenter, reduced]);

  return <div ref={el} className="h-full w-full" role="region" aria-label={t('map3d.scene')} data-testid="campus-3d" />;
}
