import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CampusMap from '../CampusMap';
import L from 'leaflet';
import { CAMPUS_PLACES } from '@/data/places';
import { CATEGORY_COLORS } from '../mapStyle';

const mock = vi.hoisted(() => ({
  created: vi.fn(), remove: vi.fn(), flyTo: vi.fn(), jumpTo: vi.fn(), addLayer: vi.fn(),
  fail: false, failStyle: false, error: undefined as (() => void) | undefined,
}));
vi.mock('maplibre-gl', () => ({
  Map: class {
    container: HTMLElement;
    constructor(options: { container: HTMLElement }) {
      mock.created(options);
      if (mock.fail) throw new Error('initialization failed');
      this.container = options.container;
      this.container.appendChild(document.createElement('canvas'));
    }
    getCanvas() { return this.container.querySelector('canvas')!; }
    addControl() {}
    on(event: string, callback: () => void) {
      if (event === 'load') queueMicrotask(() => { if (mock.failStyle) mock.error?.(); else callback(); });
      if (event === 'error') mock.error = callback;
    }
    getStyle() { return { layers: [{ id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building' }] }; }
    addLayer = mock.addLayer;
    remove = mock.remove;
    flyTo = mock.flyTo;
    jumpTo = mock.jumpTo;
    getZoom() { return 16.5; }
  },
  Marker: class {
    element: HTMLElement;
    constructor(options: { element: HTMLElement }) { this.element = options.element; }
    setLngLat() { return this; }
    addTo(map: { container: HTMLElement }) { map.container.appendChild(this.element); return this; }
    remove() { this.element.remove(); }
  },
  AttributionControl: class {}, NavigationControl: class {},
}));

const originalSvgSupport = L.Browser.svg;
beforeEach(() => {
  Object.defineProperty(L.Browser, 'svg', { value: true, configurable: true });
  mock.fail = false;
  mock.failStyle = false;
  mock.error = undefined;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as unknown as WebGL2RenderingContext);
});
afterEach(() => { Object.defineProperty(L.Browser, 'svg', { value: originalSvgSupport, configurable: true }); vi.restoreAllMocks(); vi.clearAllMocks(); });
async function enter3D() {
  fireEvent.click(screen.getByRole('button', { name: '地圖模式 3D' }));
  await waitFor(() => expect(screen.getByTestId('campus-3d').querySelector('[data-building="B"]')).toBeTruthy());
}

describe('campus map mode', () => {
  it('defers MapLibre until 3D, remembers mode, disposes and restores Leaflet classes', async () => {
    const view = render(<CampusMap places={CAMPUS_PLACES} />);
    expect(mock.created).not.toHaveBeenCalled();
    await enter3D();
    expect(screen.getByTestId('campus-3d').querySelector('canvas')).toHaveAttribute('aria-label', '淡江校園 3D 地圖');
    expect(localStorage.getItem('tku.explore.mapMode')).toBe('3d');
    view.unmount();
    expect(mock.remove).toHaveBeenCalledTimes(1);
    render(<CampusMap places={CAMPUS_PLACES} />);
    await waitFor(() => expect(mock.created).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: '地圖模式 3D' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '地圖模式 2D' }));
    expect(screen.queryByTestId('campus-3d')).toBeNull();
    expect(document.querySelector('.leaflet-container')).toBeVisible();
    expect(localStorage.getItem('tku.explore.mapMode')).toBe('2d');
    expect(mock.remove).toHaveBeenCalledTimes(2);
  });
  it('syncs marker selection, highlights selection and flies to verified coordinates', async () => {
    const onSelect = vi.fn();
    const view = render(<CampusMap places={CAMPUS_PLACES} onSelect={onSelect} />);
    await enter3D();
    fireEvent.click(screen.getByRole('button', { name: 'B 商管大樓' }));
    const selected = CAMPUS_PLACES.find((p) => p.code === 'B')!;
    expect(onSelect).toHaveBeenCalledWith(selected);
    view.rerender(<CampusMap places={CAMPUS_PLACES} selected={selected} onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: 'B 商管大樓' })).toHaveAttribute('aria-pressed', 'true');
    expect(mock.flyTo).toHaveBeenCalledWith({ center: [selected.coords!.lng, selected.coords!.lat], zoom: 17 });
    expect(mock.addLayer).toHaveBeenCalledWith(expect.objectContaining({ type: 'fill-extrusion', paint: expect.objectContaining({ 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 9] }) }), undefined);
  });
  it('uses jumpTo for selection and location under reduced motion', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: true, media: query } as MediaQueryList));
    const view = render(<CampusMap places={CAMPUS_PLACES} selected={CAMPUS_PLACES[0]} />);
    await enter3D();
    expect(mock.jumpTo).toHaveBeenCalled();
    const me = { lat: 25.175, lng: 121.449, accuracy: 12 };
    view.rerender(<CampusMap places={CAMPUS_PLACES} me={me} recenter={1} />);
    expect(screen.getByRole('img', { name: /12/ })).toBeVisible();
    expect(mock.jumpTo).toHaveBeenLastCalledWith({ center: [me.lng, me.lat], zoom: 17 });
    view.rerender(<CampusMap places={CAMPUS_PLACES} me={me} recenter={2} />);
    expect(mock.jumpTo).toHaveBeenCalledTimes(3);
    expect(mock.flyTo).not.toHaveBeenCalled();
  });
  it.each(['webgl', 'constructor', 'style'] as const)('falls back to 2D on %s failure and remembers the safe mode', async (failure) => {
    if (failure === 'webgl') vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    if (failure === 'constructor') mock.fail = true;
    if (failure === 'style') mock.failStyle = true;
    render(<CampusMap places={CAMPUS_PLACES} />);
    fireEvent.click(screen.getByRole('button', { name: '地圖模式 3D' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已切回 2D'));
    expect(screen.getByRole('button', { name: '地圖模式 2D' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('tku.explore.mapMode')).toBe('2d');
    expect(document.querySelector('.leaflet-container')).toBeVisible();
  });
  it('handles disabled storage and does not invent coordinates', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
    render(<CampusMap places={CAMPUS_PLACES.map((p) => ({ ...p, coords: null }))} />);
    fireEvent.click(screen.getByRole('button', { name: '地圖模式 3D' }));
    await waitFor(() => expect(mock.addLayer).toHaveBeenCalled());
    expect(screen.getByTestId('campus-3d').querySelector('[data-building]')).toBeNull();
  });
  it('2D pins show the building code in its category colour and select on click', async () => {
    const onSelect = vi.fn();
    const sg = CAMPUS_PLACES.find((p) => p.code === 'SG')!;
    const { container, rerender } = render(<CampusMap places={CAMPUS_PLACES} onSelect={onSelect} />);
    await waitFor(() => expect(container.querySelector('.map-pin')).toBeTruthy());
    const pin = [...container.querySelectorAll<HTMLElement>('.map-pin')].find((el) => el.textContent === 'SG')!;
    expect(pin.getAttribute('style')).toContain(CATEGORY_COLORS[sg.category]);
    fireEvent.click(pin);
    expect(onSelect).toHaveBeenCalledWith(sg);
    rerender(<CampusMap places={CAMPUS_PLACES} selected={sg} onSelect={onSelect} />);
    await waitFor(() => expect(container.querySelector('.map-pin--active')?.textContent).toBe('SG'));
  });
  it('3D picks the dark basemap for the dark theme', async () => {
    document.documentElement.dataset.theme = 'dark';
    try {
      render(<CampusMap places={CAMPUS_PLACES} />);
      await enter3D();
      expect(mock.created).toHaveBeenCalledWith(expect.objectContaining({ style: 'https://tiles.openfreemap.org/styles/dark' }));
    } finally {
      delete document.documentElement.dataset.theme;
    }
  });
});
