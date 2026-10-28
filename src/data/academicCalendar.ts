/**
 * Exam periods from Tamkang's official academic calendar (教務處行事曆). Read once per academic year;
 * add the next year's entries when the school publishes its calendar.
 *
 * The calendar has no unified midterm exam week: teachers schedule midterms themselves and the school only
 * opens midterm grade upload (期中評量成績上傳). Midterm season is therefore taken as the two weeks before
 * upload opens. Final assessment weeks (期末多元評量週) are official dates.
 */
export interface AcademicTerm {
  /** 民國學年-學期 */
  code: string;
  /** 期中評量成績上傳 opens (YYYY-MM-DD, Asia/Taipei) */
  midtermUploadStart: string;
  /** 期末多元評量週 (and the flexible-teaching week that follows), inclusive */
  finalStart: string;
  finalEnd: string;
}

export const ACADEMIC_CALENDAR_SOURCE = {
  name: '淡江大學教務處 115學年度行事曆',
  url: 'https://www.acad.tku.edu.tw/get_page?t=rtdoc&rtdoc_id=OAA201&lang=tw',
  pdf: 'https://fkwx-at.azurewebsites.net/at/115calendar.pdf',
  pdfSha256: '600f753a4c00a25e1bcefddaedd744afe45c57eb81c7c840fb3b28f729ccde56',
  verifiedAt: '2026-10-28',
};

export const ACADEMIC_TERMS: AcademicTerm[] = [
  // 第1學期：期中評量成績上傳 11/9–11/30（第九週起）；期末多元評量週 12/28–1/3、期末多元評量週/教師彈性教學週 1/4–1/10
  { code: '115-1', midtermUploadStart: '2026-11-09', finalStart: '2026-12-28', finalEnd: '2027-01-10' },
  // 第2學期：期中評量成績上傳 4/19–5/10；期末多元評量週 6/7–6/13、期末多元評量週/教師彈性教學週 6/14–6/20
  // （畢業班課程期末評量 5/31–6/6 另計，不在此表）
  { code: '115-2', midtermUploadStart: '2027-04-19', finalStart: '2027-06-07', finalEnd: '2027-06-20' },
];
