import { afterEach, describe, expect, it, vi } from 'vitest';
import { lineCanvas, unifyTeachers } from '../readTimetable';
import type { LineImage } from '../timetableGrid';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('OCR normalization', () => {
  it('votes across courseKey variants and unrelated lecturer spellings without counting TA votes', () => {
    const cell = (teacher: string, course = '英文（二）') => ({ weekday: 1, period: 1, group: '', course, teacher, room: '' });
    const cells = [cell('錯名'), cell('甲乙丙', '英文 (二)'), cell('甲乙丙'), cell('助　教'), cell('TA'), cell('ta')];
    expect(unifyTeachers(cells).map((c) => c.teacher)).toEqual(['甲乙丙', '甲乙丙', '甲乙丙', '助教', '助教', '助教']);
    expect(cells[0]!.teacher).toBe('錯名');
  });
});

describe('lineCanvas', () => {
  it.each([
    { glyph: 8, imageScale: 3, targetScale: 40 / 24 },
    { glyph: 14, imageScale: 3, targetScale: 1 },
    { glyph: 5, imageScale: 1, targetScale: 4 },
  ])('scales glyph height $glyph at input scale $imageScale with bounded enlargement', ({ glyph, imageScale, targetScale }) => {
    vi.stubGlobal('ImageData', class {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    });
    const context = { putImageData: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: false, imageSmoothingQuality: '' };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const width = 30 * imageScale, height = (glyph + 6) * imageScale;
    const line: LineImage = { width, height, top: 10, bottom: 10 + glyph - 1, link: false, data: new Uint8ClampedArray(width * height * 4) };
    const result = lineCanvas(line);
    const scaledWidth = Math.round(width * targetScale), scaledHeight = Math.round(height * targetScale);
    expect(result.width).toBe(scaledWidth + 32);
    expect(result.height).toBe(scaledHeight + 32);
    expect(context.drawImage).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 16, 16, scaledWidth, scaledHeight);
    expect(context.putImageData).toHaveBeenCalledTimes(1);
  });
});


describe('course names that differ only by an ordinal stay separate', () => {
  it('keeps 微積分（一）and 微積分（二）as two courses but still fixes a misread character', async () => {
    const { unifyCourseNames } = await import('../normalizeCells');
    const cell = (course: string, period: number) => ({ weekday: 1, period, group: '資管二', course, teacher: '王小明', room: 'B217' });
    const out = unifyCourseNames([cell('微積分（一）', 1), cell('微積分（一）', 2), cell('微積分（二）', 5), cell('投資學', 7), cell('投資學', 8), cell('投賁學', 9)]);
    expect(out.map((c) => c.course)).toEqual(['微積分（一）', '微積分（一）', '微積分（二）', '投資學', '投資學', '投資學']);
  });
});
