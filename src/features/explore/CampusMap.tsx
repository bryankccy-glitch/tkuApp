import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CAMPUS_CENTER, type CampusPlace } from '@/data/places';
import type { MyLocation } from '@/hooks/useMyLocation';
import { t } from '@/i18n/t';

/**
 * OpenStreetMap-based campus map. Only shows markers whose coordinates are verified;
 * the campus centre marker comes from Wikipedia. No fabricated building positions.
 */
export default function CampusMap({ places, selected, me, recenter = 0 }: {
  places: CampusPlace[];
  selected?: CampusPlace | null;
  /** The viewer's own position (stays on the device). */
  me?: MyLocation | null;
  /** Increment to fly to `me` again (e.g. the 定位 button was pressed). */
  recenter?: number;
}) {
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
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const icon = (accent: boolean) =>
      L.divIcon({
        className: '',
        html: `<span style="display:block;width:18px;height:18px;border-radius:9px 9px 9px 2px;transform:rotate(-45deg);background:${accent ? '#B3262D' : '#171717'};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 18],
      });
    L.marker([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], { icon: icon(true), title: t('map.campus') }).bindPopup(t('map.campusPopup')).addTo(g);
    places.filter((p) => p.coords).forEach((p) => {
      L.marker([p.coords!.lat, p.coords!.lng], { icon: icon(p.code === selected?.code), title: p.name }).bindPopup(`${p.code}｜${p.name}`).addTo(g);
    });
    if (selected?.coords) map.current?.setView([selected.coords.lat, selected.coords.lng], 18);
  }, [places, selected]);

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

  return <div ref={el} className="h-full w-full" role="region" aria-label={t('map.label')} />;
}
