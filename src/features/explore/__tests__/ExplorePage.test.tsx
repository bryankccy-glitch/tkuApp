import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ExplorePage from '../ExplorePage';

// The map itself is covered in CampusMap.test.tsx; here only the page chrome around it matters.
vi.mock('../CampusMap', () => ({ default: () => <div data-testid="map-stub" /> }));

describe('explore page map chrome', () => {
  it('toggles full screen, exits with Escape and restores page scrolling', async () => {
    render(<MemoryRouter><ExplorePage /></MemoryRouter>);
    await screen.findByTestId('map-stub');
    fireEvent.click(screen.getByRole('button', { name: '全螢幕地圖' }));
    expect(screen.getByRole('dialog', { name: /地圖/ })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('button', { name: '全螢幕地圖' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a legend for the categories that have pins', async () => {
    render(<MemoryRouter><ExplorePage /></MemoryRouter>);
    const legend = await screen.findByRole('list', { name: '地圖圖例' });
    expect(legend.querySelectorAll('li').length).toBeGreaterThan(0);
  });
});
