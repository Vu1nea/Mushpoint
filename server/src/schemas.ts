/** Request schemas, checked at each route boundary before any SQL runs.
 *
 * They check shape only: JSON types, enums, required keys. Meaning stays in the
 * repo layer (trimming, empty titles, `MAX_TEXT`, http(s) URLs, real calendar
 * dates, ownership), so those rules hold for every caller, not just HTTP.
 *
 * Nullable fields are still required (send `null`): every PUT replaces the whole
 * record, so a left-out key must not quietly clear a value. Unknown keys are dropped. */
import { z } from 'zod';
import { AppError } from './error';
import {
  GOAL_STATUSES,
  RECURRENCES,
  TASK_STATUSES,
  TIMEFRAMES,
  type CategoryInput,
  type GoalInput,
  type IdeaInput,
  type SubgoalInput,
  type SubgoalUpdate,
  type TaskInput,
  type TaskUpdate,
  type VisionItemInput
} from './types';

const tuple = <T extends string>(values: T[]) => values as [T, ...T[]];

/** Postgres refuses NUL in text; refusing it here keeps the message readable. */
const text = z.string().refine((s) => !s.includes('\u0000'), 'must not contain a NUL character');
const nullableText = text.nullable();
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nullableId = id.nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const timeframe = z.enum(tuple(TIMEFRAMES));
export const goalStatus = z.enum(tuple(GOAL_STATUSES));
export const taskStatus = z.enum(tuple(TASK_STATUSES));
export const recurrence = z.enum(tuple(RECURRENCES));

export const categoryInput = z.object({
  name: text,
  colorToken: nullableText
}) satisfies z.ZodType<CategoryInput>;

export const goalInput = z.object({
  categoryId: nullableId,
  title: text,
  description: nullableText,
  timeframe,
  dueDate: nullableText,
  motivationText: nullableText,
  motivationImagePath: nullableText,
  repoUrl: nullableText
}) satisfies z.ZodType<GoalInput>;

export const subgoalInput = z.object({
  goalId: id,
  title: text,
  dueDate: nullableText
}) satisfies z.ZodType<SubgoalInput>;

export const subgoalUpdate = z.object({
  title: text,
  dueDate: nullableText,
  isComplete: z.boolean()
}) satisfies z.ZodType<SubgoalUpdate>;

export const ideaInput = z.object({
  title: text,
  note: nullableText,
  tagNames: z.array(text).max(100)
}) satisfies z.ZodType<IdeaInput>;

export const visionItemInput = z.object({
  imagePath: nullableText,
  quoteText: nullableText
}) satisfies z.ZodType<VisionItemInput>;

export const taskInput = z.object({
  title: text,
  dueDate: nullableText,
  goalId: nullableId,
  subgoalId: nullableId,
  recurrence: recurrence.nullable()
}) satisfies z.ZodType<TaskInput>;

export const taskUpdate = taskInput.extend({ status: taskStatus }) satisfies z.ZodType<TaskUpdate>;

export const goalStatusBody = z.object({ status: goalStatus });
export const taskStatusBody = z.object({ status: taskStatus });
export const isCompleteBody = z.object({ isComplete: z.boolean() });
export const usernameBody = z.object({ username: text });
export const themeBody = z.object({ theme: text });
export const graceDaysBody = z.object({ days: z.number().int() });
export const completionBody = z.object({ done: z.boolean(), date: date.nullable().default(null) });
export const orderBody = z.object({ orderedIds: z.array(id).max(10_000) });

const flag = z.enum(['true', 'false']).optional().transform((v) => v === 'true');

export const goalListQuery = z.object({ status: goalStatus.optional() });
export const goalDeleteQuery = z.object({ deleteOrphanedTasks: flag });
export const ideaListQuery = z.object({ tag: text.optional(), includePromoted: flag });
export const streakQuery = z.object({
  days: z
    .string()
    .regex(/^\d+$/, 'must be an integer from 1 to 366')
    .transform(Number)
    .pipe(z.number().int().min(1, 'must be an integer from 1 to 366').max(366, 'must be an integer from 1 to 366'))
    .optional()
});

/** Parses `value`, or throws a validation error naming the first bad field. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
  throw AppError.validation(`${where}${issue.message}`);
}
