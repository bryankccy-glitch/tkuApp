import type { Semester } from '../types';
import i18n from '@/i18n';

/**
 * 依日期推算淡江學期代碼（民國學年-學期）。
 * 上學期約 8/1–1/31，下學期約 2/1–7/31。確切開學日以淡江行事曆為準（待查核），
 * 這裡的起訖只用來預設學期範圍，使用者可自行修改。
 */
/** Display name from the semester code (e.g. "115-1"), in the active language — stored names may be in another language. */
export function semesterLabel(s: Pick<Semester, 'code' | 'name'>): string {
  const m = s.code.match(/^(\d{2,3})-([12])$/);
  return m ? i18n.t('semester.name', { year: m[1], term: m[2] }) : s.name;
}

export function inferSemester(d: Date): Omit<Semester, 'id'> {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const academicYear = (m >= 8 ? y : y - 1) - 1911;
  const term = m >= 8 || m === 1 ? 1 : 2;
  const startYear = academicYear + 1911;
  const startDate = term === 1 ? `${startYear}-08-01` : `${startYear + 1}-02-01`;
  const endDate = term === 1 ? `${startYear + 1}-01-31` : `${startYear + 1}-07-31`;
  return { code: `${academicYear}-${term}`, name: i18n.t('semester.name', { year: academicYear, term }), startDate, endDate };
}
