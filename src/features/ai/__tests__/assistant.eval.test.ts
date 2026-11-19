/**
 * Optional accuracy run for the local campus assistant (skipped in normal `vitest run`).
 * Questions and the schedule fixture live outside the repo (they come from a real student timetable):
 *   ASSISTANT_EVAL=/path/questions.json ASSISTANT_FIXTURE=/path/fixture.json npx vitest run src/features/ai/__tests__/assistant.eval.test.ts
 * questions.json: [{ q, expect_contains: string[], expect_not?: string[], category }]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { answerLocally } from '../localEngine';

const questionsPath = process.env.ASSISTANT_EVAL;
const fixturePath = process.env.ASSISTANT_FIXTURE;

describe.skipIf(!questionsPath || !fixturePath)('assistant accuracy (external question set)', () => {
  it('scores every question and writes a report', () => {
    const fx = JSON.parse(readFileSync(fixturePath!, 'utf8'));
    const questions: { q: string; expect_contains: string[]; expect_not?: string[]; category: string }[] = JSON.parse(readFileSync(questionsPath!, 'utf8'));
    const now = new Date(fx.now);
    const byCat = new Map<string, [number, number]>();
    const fails: string[] = [];
    let pass = 0;
    for (const item of questions) {
      const answer = answerLocally({ question: item.q, courses: fx.courses, tasks: fx.tasks, events: fx.events, now, semester: fx.semester }).content;
      const flat = answer.replace(/\s+/g, '');
      const ok = item.expect_contains.every((k) => flat.includes(k.replace(/\s+/g, '')))
        && !(item.expect_not ?? []).some((k) => flat.includes(k.replace(/\s+/g, '')));
      const [p, n] = byCat.get(item.category) ?? [0, 0];
      byCat.set(item.category, [p + (ok ? 1 : 0), n + 1]);
      if (ok) pass += 1; else fails.push(`✗ [${item.category}] ${item.q}\n   要有：${item.expect_contains.join('、')}${item.expect_not?.length ? `｜不能有：${item.expect_not.join('、')}` : ''}\n   回答：${answer.replace(/\n/g, ' ⏎ ').slice(0, 220)}`);
    }
    const summary = { pass, total: questions.length, byCategory: Object.fromEntries([...byCat].map(([k, [p, n]]) => [k, `${p}/${n}`])) };
    if (process.env.ASSISTANT_EVAL_OUT) writeFileSync(process.env.ASSISTANT_EVAL_OUT, JSON.stringify({ summary, fails }, null, 1));
    console.log(JSON.stringify(summary));
    expect(questions.length).toBeGreaterThan(0);
  });
});
