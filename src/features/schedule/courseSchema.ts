import { z } from 'zod';
import { COURSE_COLORS } from '@/lib/types';
import { toMinutes } from '@/lib/time';

const time = z.string().regex(/^\d{2}:\d{2}$/, '請輸入時間');

export const slotSchema = z
  .object({
    id: z.string().optional(),
    weekday: z.coerce.number().int().min(1).max(7),
    startTime: time,
    endTime: time,
    room: z.string().trim().max(20, '教室代碼最多 20 字'),
  })
  .refine((s) => toMinutes(s.endTime) > toMinutes(s.startTime), { message: '下課時間必須晚於上課時間', path: ['endTime'] });

export const courseSchema = z.object({
  name: z.string().trim().min(1, '請輸入課程名稱').max(80, '課程名稱最多 80 字'),
  code: z.string().trim().max(20, '課號最多 20 字').optional(),
  instructor: z.string().trim().max(60, '教師名稱最多 60 字').optional(),
  color: z.enum(COURSE_COLORS),
  notes: z.string().trim().max(1000, '備註最多 1000 字').optional(),
  slots: z.array(slotSchema).min(1, '至少需要一個上課時段'),
});

export type CourseFormValues = z.infer<typeof courseSchema>;
