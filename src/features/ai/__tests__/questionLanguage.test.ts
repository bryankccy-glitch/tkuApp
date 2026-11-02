import { describe, expect, it } from 'vitest';
import i18n, { prepareLanguage, withLanguage } from '@/i18n';
import { formatDateLong } from '@/lib/time';
import { WEEKDAY_LABELS } from '@/lib/labels';
import type { Course } from '@/lib/types';
import { answerLocally } from '../localEngine';
import { detectLanguage, toEngineQuestion } from '../questionLanguage';

const econ = { id: '1', semesterId: 's', name: '經濟學', color: 'navy', slots: [] } as unknown as Course;

describe('detectLanguage', () => {
  it.each([
    ['下一堂課在哪？', 'zh-TW'], ['下一节课在哪里', 'zh-CN'], ['Where is my next class?', 'en'],
    ['次の授業はどこ？', 'ja'], ['다음 수업은 어디예요?', 'ko'], ['คาบถัดไปอยู่ที่ไหน', 'th'],
    ['Lớp tiếp theo ở đâu?', 'vi'], ['¿Dónde es mi próxima clase?', 'es'], ['Di mana kelas berikutnya?', 'id'],
  ])('%s → %s', (question, language) => {
    expect(detectLanguage(question, 'zh-TW')).toBe(language);
  });

  it('ignores course names and room codes', () => {
    expect(detectLanguage('who teaches 經濟學?', 'zh-TW', [econ])).toBe('en');
    expect(detectLanguage('Where is 微積分?', 'zh-TW')).toBe('en');
    expect(detectLanguage('Data Structures 在哪', 'en')).toBe('zh-TW');
  });

  it('keeps the interface language when the text shows none', () => {
    expect(detectLanguage('B217', 'ja')).toBe('ja');
    expect(detectLanguage('123', 'en')).toBe('en');
    expect(detectLanguage('經濟學', 'zh-CN', [econ])).toBe('zh-CN');
    expect(detectLanguage('你好', 'zh-CN')).toBe('zh-CN');
  });
});

describe('answers follow the question', () => {
  const input = { courses: [], tasks: [], events: null, now: new Date(2026, 9, 14, 13, 30) };
  const ask = async (question: string) => {
    const language = detectLanguage(question, 'zh-TW');
    await prepareLanguage(language);
    return withLanguage(language, () => answerLocally({ ...input, question: toEngineQuestion(question, language) })).content;
  };

  it('uses the question language and leaves the interface alone', async () => {
    expect(await ask('What can you do?')).toContain('campus assistant');
    expect(await ask('こんにちは')).toContain('キャンパスアシスタント');
    expect(await ask('안녕하세요')).toContain(i18n.getFixedT('ko')('ai.help').slice(0, 12));
    expect(await ask('次の授業はどこ？')).toBe(i18n.getFixedT('ja')('ai.schedule.empty'));
    expect(await ask('Tugas minggu ini?')).not.toBe(i18n.getFixedT('id')('ai.fallback'));
    expect(i18n.language).toBe('zh-TW');
    expect(i18n.t('ai.title')).toBe('校園助理');
  });

  it('formats dates and labels in that language', async () => {
    await prepareLanguage('en');
    const date = new Date(2026, 9, 14);
    expect(withLanguage('en', () => formatDateLong(date))).toMatch(/October/);
    expect(withLanguage('en', () => WEEKDAY_LABELS[1])).toMatch(/Mon/);
    expect(formatDateLong(date)).toContain('10');
    expect(WEEKDAY_LABELS[1]).toMatch(/週|星期/);
  });

  it('restores the language when the answer throws', () => {
    expect(() => withLanguage('en', () => { throw new Error('x'); })).toThrow('x');
    expect(i18n.language).toBe('zh-TW');
  });
});
