import { describe, expect, it } from 'vitest';
import { AppError } from './error';
import { completionBody, goalInput, ideaListQuery, orderBody, parse, streakQuery, taskInput, taskUpdate } from './schemas';

const task = { title: 'x', dueDate: null, goalId: null, subgoalId: null, recurrence: null };

const goal = {
  categoryId: null,
  title: 'Ship',
  description: null,
  timeframe: 'short',
  dueDate: null,
  motivationText: null,
  motivationImagePath: null,
  repoUrl: null
};

function message(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).kind).toBe('validation');
    return (err as AppError).message;
  }
  throw new Error('expected a validation error');
}

describe('request schemas', () => {
  it('accepts a full goal and drops unknown keys', () => {
    expect(parse(goalInput, { ...goal, extra: 1 })).toEqual(goal);
  });

  it('requires nullable fields, so a PUT never clears a value the client left out', () => {
    expect(message(() => parse(taskInput, { title: 'x', dueDate: null, goalId: null, subgoalId: null }))).toMatch(
      /^recurrence: /
    );
    expect(parse(taskInput, task)).toEqual(task);
  });

  it('reads a left-out completion date as today (null)', () => {
    expect(parse(completionBody, { done: true })).toEqual({ done: true, date: null });
    expect(() => parse(completionBody, { done: true, date: '2026-1-1' })).toThrow(AppError);
  });

  it('names the first bad field', () => {
    expect(message(() => parse(goalInput, { ...goal, timeframe: 'bogus' }))).toMatch(/^timeframe: /);
    expect(message(() => parse(goalInput, { ...goal, title: 123 }))).toMatch(/^title: /);
    expect(message(() => parse(taskInput, { ...task, goalId: 'abc' }))).toMatch(/^goalId: /);
  });

  it('refuses ids that are not positive safe integers', () => {
    for (const bad of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 2]) {
      expect(() => parse(taskInput, { ...task, goalId: bad })).toThrow(AppError);
    }
    expect(() => parse(orderBody, { orderedIds: [1, '2'] })).toThrow(AppError);
  });

  it('refuses NUL characters in text', () => {
    expect(message(() => parse(goalInput, { ...goal, title: 'a\u0000b' }))).toMatch(/NUL/);
  });

  it('requires a valid status on a task update', () => {
    expect(() => parse(taskUpdate, task)).toThrow(AppError);
    expect(parse(taskUpdate, { ...task, status: 'done' }).status).toBe('done');
  });

  it('parses query flags and the streak window', () => {
    expect(parse(ideaListQuery, {})).toEqual({ includePromoted: false });
    expect(parse(ideaListQuery, { includePromoted: 'true' }).includePromoted).toBe(true);
    expect(() => parse(ideaListQuery, { includePromoted: 'yes' })).toThrow(AppError);
    expect(parse(streakQuery, { days: '30' }).days).toBe(30);
    expect(parse(streakQuery, {}).days).toBeUndefined();
    for (const bad of ['0', '367', '-1', '1.5', 'x']) {
      expect(() => parse(streakQuery, { days: bad })).toThrow(AppError);
    }
    expect(() => parse(streakQuery, { days: ['1', '2'] })).toThrow(AppError);
  });
});
