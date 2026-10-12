import type { CampusEvent, Course, Task, Weekday } from '@/lib/types';
import { occurrencesOn } from '@/lib/schedule';
import { addDays, formatDateShort, formatDue, weekdayOf, startOfDay } from '@/lib/time';
import { filterTasks, upcomingExams } from '@/lib/tasks';
import { TASK_KIND_LABELS, WEEKDAY_LABELS, EVENT_CATEGORY_LABELS } from '@/lib/labels';
import { formatPeriods, timesToPeriods, PERIOD_SOURCE, TKU_PERIODS } from '@/lib/periods';
import { CAMPUS_PLACES, buildingFromRoom, type CampusPlace } from '@/data/places';
import { OFFICIAL_SOURCES } from '@/data/sources';
import type { SourceRef } from './types';

/**
 * 本機校園助理（不需 API Key）：
 * 只根據使用者自己的課表/待辦、已查核的建築代碼與官方文件清單回答。
 * 不會生成校規內容；找不到可靠資料時明確說明。
 */
export interface EngineInput {
  question: string;
  courses: Course[];
  tasks: Task[];
  events: CampusEvent[] | null;
  now: Date;
}
export interface EngineAnswer {
  content: string;
  sources: SourceRef[];
}

const PERSONAL_SCHEDULE: SourceRef = { title: '你的課表', kind: 'personal' };
const PERSONAL_TASKS: SourceRef = { title: '你的待辦與考試', kind: 'personal' };

const ZH_DAY: Record<string, Weekday> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };

function resolveDay(q: string, now: Date): { date: Date; label: string } | null {
  if (/後天/.test(q)) return { date: addDays(now, 2), label: '後天' };
  if (/明天|明日/.test(q)) return { date: addDays(now, 1), label: '明天' };
  if (/今天|今日/.test(q)) return { date: now, label: '今天' };
  const m = q.match(/(?:週|星期|禮拜)([一二三四五六日天])/);
  if (m) {
    const target = ZH_DAY[m[1]!]!;
    const diff = (target - weekdayOf(now) + 7) % 7;
    const date = addDays(now, diff);
    return { date, label: WEEKDAY_LABELS[target] };
  }
  return null;
}

function scheduleAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(課|上課|教室|第[一二三四五1-9]堂|幾點)/.test(q)) return null;
  const day = resolveDay(q, input.now) ?? { date: input.now, label: '今天' };
  if (input.courses.length === 0) {
    return { content: '你的課表目前是空的，我沒辦法查詢上課資訊。可以到「課表」新增課程或匯入 CSV。', sources: [PERSONAL_SCHEDULE] };
  }
  const list = occurrencesOn(input.courses, weekdayOf(day.date));
  const dateLabel = `${day.label}（${formatDateShort(day.date)}）`;
  if (list.length === 0) return { content: `${dateLabel}沒有排課。`, sources: [PERSONAL_SCHEDULE] };

  const wantsFirst = /第一堂|第1堂|最早/.test(q);
  const wantsLast = /最後一堂|最晚/.test(q);
  const pick = wantsFirst ? [list[0]!] : wantsLast ? [list[list.length - 1]!] : list;
  const lines = pick.map(({ course, slot }) => {
    const b = buildingFromRoom(slot.room);
    const where = slot.room ? `**${slot.room}**${b ? `（${b.name}）` : ''}` : '教室未填寫';
    const p = formatPeriods(timesToPeriods(slot.startTime, slot.endTime));
    return `- ${slot.startTime}–${slot.endTime}${p ? `（${p}）` : ''}　${course.name}，${where}${course.instructor ? `，${course.instructor}` : ''}`;
  });
  const head = wantsFirst ? `${dateLabel}第一堂課：` : wantsLast ? `${dateLabel}最後一堂課：` : `${dateLabel}共有 ${list.length} 堂課：`;
  return { content: `${head}\n\n${lines.join('\n')}`, sources: [PERSONAL_SCHEDULE] };
}

function examAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(考試|期中|期末|小考|考什麼|要考)/.test(q)) return null;
  const days = /下週|下周/.test(q) ? 14 : /這週|本週|這周/.test(q) ? 7 : 30;
  const exams = upcomingExams(input.tasks, input.now, days);
  const name = (id?: string | null) => input.courses.find((c) => c.id === id)?.name;
  if (exams.length === 0) {
    return { content: `接下來 ${days} 天內，你的待辦裡沒有考試。如果有考試還沒登記，可以到「作業與考試」新增，類型選小考、期中考或期末考。`, sources: [PERSONAL_TASKS] };
  }
  const lines = exams.map((e) => `- **${formatDue(e.dueAt, input.now)}**　${TASK_KIND_LABELS[e.kind]}：${name(e.courseId) ?? e.title}${name(e.courseId) && e.title !== name(e.courseId) ? `（${e.title}）` : ''}`);
  return { content: `接下來 ${days} 天內有 ${exams.length} 場考試：\n\n${lines.join('\n')}`, sources: [PERSONAL_TASKS] };
}

function taskAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(作業|待辦|截止|報告|要交|deadline|任務)/i.test(q)) return null;
  const overdue = filterTasks(input.tasks, 'overdue', input.now);
  const view = /今天|今日/.test(q) ? 'today' : 'week';
  const list = filterTasks(input.tasks, view, input.now).filter((t) => new Date(t.dueAt) >= input.now);
  const name = (id?: string | null) => input.courses.find((c) => c.id === id)?.name;
  const fmt = (t: Task) => `- **${formatDue(t.dueAt, input.now)}**　${t.title}（${TASK_KIND_LABELS[t.kind]}${name(t.courseId) ? `｜${name(t.courseId)}` : ''}）`;
  const parts: string[] = [];
  parts.push(list.length ? `${view === 'today' ? '今天' : '本週'}還有 ${list.length} 項待辦：\n\n${list.map(fmt).join('\n')}` : `${view === 'today' ? '今天' : '本週'}沒有未完成的待辦。`);
  if (overdue.length) parts.push(`另外有 **${overdue.length} 項已逾期**：\n\n${overdue.slice(0, 5).map(fmt).join('\n')}`);
  return { content: parts.join('\n\n'), sources: [PERSONAL_TASKS] };
}

function findPlace(q: string): CampusPlace | undefined {
  const room = q.toUpperCase().match(/\b([A-Z]{1,2})\s?\d{2,4}\b/);
  if (room) return buildingFromRoom(room[0].replace(/\s/g, ''));
  const byName = [...CAMPUS_PLACES].sort((a, b) => b.name.length - a.name.length).find((p) => q.includes(p.name));
  if (byName) return byName;
  const code = q.toUpperCase().match(/\b([A-Z]{1,2})\s*(館|棟|大樓)/);
  return code ? CAMPUS_PLACES.find((p) => p.code === code[1]) : undefined;
}

function placeAnswer(q: string): EngineAnswer | null {
  if (!/(在哪|哪裡|位置|怎麼走|地點|大樓|館|教室代碼)/.test(q) && !/\b[A-Z]{1,2}\d{2,4}\b/i.test(q)) return null;
  const p = findPlace(q);
  if (!p) return null;
  return {
    content: `**${p.code}** 是「${p.name}」。教室編號以 ${p.code} 開頭的課都在這棟。\n\n可以到「探索」頁查看建築資訊，並用 Google 地圖導航。建築的精確座標仍在查核中，所以我不提供方位描述，避免帶錯路。`,
    sources: [{ title: p.source.name, url: p.source.url, kind: 'campus' }],
  };
}

function periodAnswer(q: string): EngineAnswer | null {
  const m = q.match(/第\s*(\d{1,2})\s*節/);
  if (!m && !/節次/.test(q)) return null;
  const src: SourceRef = { title: PERIOD_SOURCE.name, url: PERIOD_SOURCE.url, publisher: '淡江大學', kind: 'official' };
  if (m) {
    const p = TKU_PERIODS.find((x) => x.no === Number(m[1]));
    if (!p) return { content: `我只有第 1–12 節的查核資料，沒有第 ${m[1]} 節的時間。`, sources: [src] };
    return { content: `第 ${p.no} 節是 **${p.start}–${p.end}**。`, sources: [src] };
  }
  return { content: TKU_PERIODS.map((p) => `- 第 ${p.no} 節：${p.start}–${p.end}`).join('\n'), sources: [src] };
}

function eventAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(活動|講座|競賽|黑客松|實習|獎學金|比賽)/.test(q)) return null;
  if (input.events === null) {
    return { content: '活動資料由管理後台維護，目前這個版本尚未連線雲端資料庫，所以我查不到活動。我不會提供來源不明的活動資訊。', sources: [] };
  }
  const weekEnd = addDays(startOfDay(input.now), 8).getTime();
  const list = input.events.filter((e) => /這週|本週|這周/.test(q) ? new Date(e.startsAt).getTime() < weekEnd : true).slice(0, 6);
  if (!list.length) return { content: '目前沒有符合的已發布活動。', sources: [] };
  return {
    content: `找到 ${list.length} 則活動：\n\n${list.map((e) => `- **${formatDateShort(new Date(e.startsAt))}**　${e.title}（${EVENT_CATEGORY_LABELS[e.category]}）`).join('\n')}`,
    sources: list.map((e) => ({ title: e.sourceName, url: e.sourceUrl, kind: 'campus' as const })),
  };
}

function knowledgeAnswer(q: string): EngineAnswer | null {
  const hits = OFFICIAL_SOURCES.filter((s) => s.keywords.some((k) => q.includes(k)));
  if (!hits.length) return null;
  const top = hits.slice(0, 2);
  return {
    content:
      `這類問題以學校公告的正式文件為準。相關文件是${top.map((s) => `《${s.title}》`).join('與')}，請直接查閱原文。\n\n` +
      `目前的知識庫還沒有收錄這些文件的內文，我不會自行推測申請流程、天數或期限，以免給你錯誤資訊。如果規定和你的情況有關，也可以直接詢問學校承辦單位。`,
    sources: top.map((s) => ({ title: s.title, publisher: s.publisher, url: s.url, updated: s.updated, kind: 'official' as const })),
  };
}

export function answerLocally(input: EngineInput): EngineAnswer {
  const q = input.question.trim();
  return (
    periodAnswer(q) ??
    examAnswer(q, input) ??
    taskAnswer(q, input) ??
    placeAnswer(q) ??
    scheduleAnswer(q, input) ??
    eventAnswer(q, input) ??
    knowledgeAnswer(q) ?? {
      content:
        '這個問題我目前沒有可靠的資料可以回答。\n\n我可以幫你：\n- 查詢你的課表（例如「明天第一堂課在哪？」）\n- 整理作業與考試（例如「這週有哪些作業？」）\n- 查教室代碼（例如「FL105 在哪棟？」）\n- 找學校官方文件（例如「病假怎麼請？」）',
      sources: [],
    }
  );
}
