import { z } from '@/lib/zod';
import { COURSE_COLORS } from '@/lib/types';
import { toMinutes } from '@/lib/time';
import i18n from '@/i18n';

// Messages are resolved when the schema is built; the app remounts on language change.
const m = (k: string) => i18n.t(`validation.${k}`);

const time = z.string().regex(/^\d{2}:\d{2}$/, m('enterTime'));

export const slotSchema = z
  .object({
    id: z.string().optional(),
    weekday: z.coerce.number().int().min(1).max(7),
    startTime: time,
    endTime: time,
    room: z.string().trim().max(20, m('roomMax')),
  })
  .refine((s) => toMinutes(s.endTime) > toMinutes(s.startTime), { message: m('endAfterStart'), path: ['endTime'] });

export const courseSchema = z.object({
  name: z.string().trim().min(1, m('courseName')).max(80, m('courseNameMax')),
  code: z.string().trim().max(20, m('codeMax')).optional(),
  instructor: z.string().trim().max(60, m('instructorMax')).optional(),
  color: z.enum(COURSE_COLORS),
  notes: z.string().trim().max(1000, m('notesMax')).optional(),
  slots: z.array(slotSchema).min(1, m('slotsMin')),
});

export type CourseFormValues = z.infer<typeof courseSchema>;
export type CourseFormInput = z.input<typeof courseSchema>;
