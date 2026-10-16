import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BootScreen } from '../Logo';

describe('BootScreen', () => {
  it('keeps the page surroundings splash-colored while it is up (no light strip under it on iOS)', () => {
    document.getElementById('boot')?.remove();
    const { unmount } = render(<BootScreen />);
    expect(document.documentElement.classList.contains('boot-screen')).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains('boot-screen')).toBe(false);
  });
});
