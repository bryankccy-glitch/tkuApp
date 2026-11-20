import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CampusMap from '../CampusMap';
import { CAMPUS_PLACES } from '@/data/places';

afterEach(() => vi.restoreAllMocks());
describe('campus map mode', () => {
  it('defaults to 2D, switches both ways and remembers the choice on remount', () => {
    const view = render(<CampusMap places={CAMPUS_PLACES} />);
    expect(screen.getByRole('button', { name: '地圖模式 2D' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '地圖模式 3D' }));
    expect(screen.getByTestId('campus-3d').querySelector('[data-building="B"]')).toBeTruthy();
    expect(localStorage.getItem('tku.explore.mapMode')).toBe('3d');
    view.unmount();
    render(<CampusMap places={CAMPUS_PLACES} />);
    expect(screen.getByRole('button', { name: '地圖模式 3D' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '地圖模式 2D' }));
    expect(screen.queryByTestId('campus-3d')).toBeNull();
    expect(localStorage.getItem('tku.explore.mapMode')).toBe('2d');
  });
  it('uses static projection even with reduced motion and updates only on input', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: true, media: query } as MediaQueryList));
    render(<CampusMap places={CAMPUS_PLACES} />);
    fireEvent.click(screen.getByRole('button', { name: '地圖模式 3D' }));
    const scene = screen.getByTestId('campus-3d');
    const before = scene.innerHTML;
    expect(scene.querySelector('animate, animateTransform')).toBeNull();
    expect(scene.getAnimations?.() ?? []).toEqual([]);
    fireEvent.change(screen.getByRole('slider', { name: '旋轉' }), { target: { value: '90' } });
    expect(scene.innerHTML).not.toBe(before);
    fireEvent.change(screen.getByRole('slider', { name: '傾斜' }), { target: { value: '25' } });
    expect(screen.getByRole('slider', { name: '傾斜' })).toHaveValue('25');
  });
  it('handles disabled storage and never invents points without coordinates', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
    render(<CampusMap places={CAMPUS_PLACES.map((p) => ({ ...p, coords: null }))} />);
    fireEvent.click(screen.getByRole('button', { name: '地圖模式 3D' }));
    expect(screen.getByTestId('campus-3d').querySelector('[data-building]')).toBeNull();
  });
});
