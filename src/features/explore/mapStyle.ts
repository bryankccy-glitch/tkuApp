import type { PlaceCategory } from '@/data/places';

/**
 * One colour per building category, shared by the 2D pins, the 3D labels and the legend.
 * Each is dark enough for white bold text (≥ 4.5:1) on both light and dark maps.
 */
export const CATEGORY_COLORS: Record<PlaceCategory, string> = {
  academic: '#2558C9',
  library: '#6A3FC4',
  admin: '#9A5B00',
  culture: '#B83279',
  sports: '#167A4C',
  service: '#0B7380',
  gate: '#4B5563',
  other: '#4B5563',
};

/** Escapes text for the small HTML strings Leaflet's divIcon takes. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Pin markup for the 2D map: a rounded tag with the building code, coloured by category. */
export function pinHtml(code: string, category: PlaceCategory, active: boolean): string {
  return `<span class="map-pin${active ? ' map-pin--active' : ''}" style="--pin:${CATEGORY_COLORS[category]}">${escapeHtml(code)}</span>`;
}
