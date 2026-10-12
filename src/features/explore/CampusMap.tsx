import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CAMPUS_CENTER, type CampusPlace } from '@/data/places';
import { t } from '@/i18n/t';

/**
 * OpenStreetMap-based campus map. Only shows markers whose coordinates are verified;
 * the campus centre marker comes from Wikipedia. No fabricated building positions.
 */
export default function CampusMap({ places, selected }: { places: CampusPlace[]; selected?: CampusPlace | null }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
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

  return <div ref={el} className="h-full w-full" role="region" aria-label={t('map.label')} />;
}
