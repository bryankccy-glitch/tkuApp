import type { Course } from '@/lib/types';
import { SIMPLIFIED_CHARS } from './localEngine';

const HAN = /\p{Script=Han}/u;
const ENGLISH_WORD = /\b(where|when|what|who|which|how|is|are|do|does|my|next|the|any|class|classes|homework|exam|today|tomorrow)\b/i;
const VIETNAMESE = /[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
const SPANISH = /[¿¡ñ]|\b(d[oó]nde|cu[aá]ndo|qu[eé]|cu[aá]l|qui[eé]n|clases?|tareas?|ex[aá]men(es)?|hoy|mañana|tengo|hola|semana)\b/i;
const INDONESIAN = /\b(di ?mana|kapan|apa|siapa|kelas|tugas|ujian|hari ini|besok|saya|berapa|halo|minggu ini)\b/i;

/** Removes what says nothing about the language: the user's course names and room codes. */
function strip(question: string, courses: Course[]): string {
  let text = question.normalize('NFKC');
  for (const c of [...courses].sort((a, b) => b.name.length - a.name.length)) {
    if (c.name) text = text.split(c.name).join(' ');
  }
  return text.replace(/\b[A-Za-z]{1,2}\d{2,4}\b/g, ' ').trim();
}

/** The language a question is written in, or `current` when the text does not show one. */
export function detectLanguage(question: string, current: string, courses: Course[] = []): string {
  const text = strip(question, courses);
  if (/\p{Script=Hangul}/u.test(text)) return 'ko';
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'ja';
  if (/\p{Script=Thai}/u.test(text)) return 'th';
  const latin = /^[\s\p{P}]*[A-Za-zÀ-ỹ]/u.test(text);
  if (HAN.test(text) && !(latin && ENGLISH_WORD.test(text))) {
    if ([...text].some((c) => SIMPLIFIED_CHARS.has(c))) return 'zh-CN';
    return current.startsWith('zh') ? current : 'zh-TW';
  }
  if (!/\p{L}/u.test(text)) return current;
  if (VIETNAMESE.test(text)) return 'vi';
  if (SPANISH.test(text)) return 'es';
  if (INDONESIAN.test(text)) return 'id';
  return 'en';
}

/** Common questions in the languages the engine does not read, as phrases it does read. */
const PHRASES: Record<string, [RegExp, string][]> = {
  ja: [
    [/次の(授業|講義|クラス)/, '下一堂課'], [/今日の(授業|時間割)/, '今天的課'], [/明日の(授業|時間割)/, '明天的課'],
    [/(今週|一週間)の(授業|時間割)|時間割/, '這週課表'], [/宿題|課題/, '這週有哪些作業'], [/試験|テスト/, '這週有哪些考試'],
    [/何週目/, '第幾週'], [/何時に.*終わ/, '幾點下課'], [/(こんにちは|何ができ)/, '你好'], [/病欠/, '病假'],
    [/どこ/, '在哪'],
  ],
  ko: [
    [/다음 ?(수업|강의)/, '下一堂課'], [/오늘.*(수업|시간표)/, '今天的課'], [/내일.*(수업|시간표)/, '明天的課'],
    [/(이번 ?주.*(수업|시간표)|시간표)/, '這週課表'], [/숙제|과제/, '這週有哪些作業'], [/시험/, '這週有哪些考試'],
    [/몇 ?주차/, '第幾週'], [/몇 ?시에.*끝/, '幾點下課'], [/(안녕|뭐 ?할 ?수)/, '你好'], [/병가/, '病假'],
    [/어디/, '在哪'],
  ],
  vi: [
    [/tiết học tiếp theo|lớp tiếp theo|môn tiếp theo/i, '下一堂課'], [/(lớp|tiết|môn).*hôm nay|hôm nay.*(lớp|tiết|môn|học)/i, '今天的課'],
    [/(lớp|tiết|môn).*ngày mai|ngày mai.*(lớp|tiết|môn|học)/i, '明天的課'], [/thời khóa biểu/i, '這週課表'],
    [/bài tập/i, '這週有哪些作業'], [/thi|kiểm tra/i, '這週有哪些考試'], [/tuần thứ mấy/i, '第幾週'],
    [/xin chào|chào bạn/i, '你好'], [/nghỉ ốm/i, '病假'], [/ở đâu/i, '在哪'],
  ],
  th: [
    [/คาบถัดไป|วิชาถัดไป|เรียนต่อไป/, '下一堂課'], [/วันนี้.*เรียน|เรียน.*วันนี้/, '今天的課'], [/พรุ่งนี้.*เรียน|เรียน.*พรุ่งนี้/, '明天的課'],
    [/ตารางเรียน/, '這週課表'], [/การบ้าน/, '這週有哪些作業'], [/สอบ/, '這週有哪些考試'], [/สัปดาห์ที่เท่าไหร่/, '第幾週'],
    [/สวัสดี/, '你好'], [/ลาป่วย/, '病假'], [/ที่ไหน|อยู่ไหน/, '在哪'],
  ],
  id: [
    [/kelas berikutnya/i, '下一堂課'], [/kelas.*hari ini|hari ini.*kelas/i, '今天的課'], [/kelas.*besok|besok.*kelas/i, '明天的課'],
    [/jadwal/i, '這週課表'], [/tugas|pr\b/i, '這週有哪些作業'], [/ujian/i, '這週有哪些考試'], [/minggu ke berapa/i, '第幾週'],
    [/\b(halo|hai)\b/i, '你好'], [/izin sakit/i, '病假'], [/di ?mana/i, '在哪'],
  ],
  es: [
    [/pr[oó]xima clase|siguiente clase/i, '下一堂課'], [/clases? (de )?hoy|hoy.*clases?/i, '今天的課'], [/clases? (de )?mañana|mañana.*clases?/i, '明天的課'],
    [/horario/i, '這週課表'], [/tareas?|deberes/i, '這週有哪些作業'], [/ex[aá]men(es)?/i, '這週有哪些考試'], [/qu[eé] semana/i, '第幾週'],
    [/\bhola\b/i, '你好'], [/baja por enfermedad|enfermedad/i, '病假'], [/d[oó]nde/i, '在哪'],
  ],
};

/** Rewrites a question for the engine. Room codes and course names stay in the text. */
export function toEngineQuestion(question: string, language: string): string {
  const rules = PHRASES[language];
  if (!rules) return question;
  for (const [pattern, phrase] of rules) {
    if (pattern.test(question)) return phrase === '在哪' ? `${question.replace(pattern, '')} ${phrase}`.trim() : phrase;
  }
  return question;
}
