// The client's API surface: one module per resource, re-exported here so
// callers import from `$lib/api`. Account and settings calls live in
// `./account` and `./settings` and are imported from there directly.
export * from './types';
export * from './viewTypes';
export { AppError } from './error';
export type { ErrorKind } from './error';

export * from './categories';
export * from './goals';
export * from './subgoals';
export * from './tasks';
export * from './streaks';
export * from './ideas';
export * from './visionItems';
