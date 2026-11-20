/** OpenAPI 3.1 description of the API, built from the request schemas in
 * `schemas.ts`. `npm run openapi` writes it to `openapi.json`; `openapi.spec.ts`
 * fails when that file is stale or a mounted route is missing here.
 *
 * Request bodies and query strings come from zod, so they cannot drift from what
 * the routes accept. Responses are described by name only. */
import { z } from 'zod';
import * as s from './schemas';

type Method = 'get' | 'post' | 'put' | 'delete';

interface Op {
  method: Method;
  path: string;
  summary: string;
  body?: z.ZodType;
  query?: z.ZodObject;
  /** Multipart upload in field `file`. */
  upload?: boolean;
  /** Reads `X-Timezone` to work out the user's local day. */
  tz?: boolean;
  /** No bearer token needed. */
  open?: boolean;
  status?: 200 | 204;
}

export const OPERATIONS: Op[] = [
  { method: 'get', path: '/healthz', summary: 'Liveness probe', open: true },
  { method: 'get', path: '/readyz', summary: 'Readiness probe (checks the database)', open: true },
  { method: 'delete', path: '/account', summary: 'Delete the account and all its data', status: 204 },

  { method: 'get', path: '/categories', summary: 'List categories' },
  { method: 'post', path: '/categories', summary: 'Create a category', body: s.categoryInput },
  { method: 'put', path: '/categories/{id}', summary: 'Update a category', body: s.categoryInput },
  { method: 'delete', path: '/categories/{id}', summary: 'Delete a category', status: 204 },

  { method: 'get', path: '/goals', summary: 'List goals with progress', query: s.goalListQuery, tz: true },
  { method: 'get', path: '/goals/{id}', summary: 'A goal with its subgoals and tasks', tz: true },
  { method: 'post', path: '/goals', summary: 'Create a goal', body: s.goalInput },
  { method: 'put', path: '/goals/{id}', summary: 'Update a goal', body: s.goalInput },
  { method: 'put', path: '/goals/{id}/status', summary: 'Set a goal status', body: s.goalStatusBody },
  { method: 'delete', path: '/goals/{id}', summary: 'Delete a goal', query: s.goalDeleteQuery, status: 204 },

  { method: 'get', path: '/subgoals', summary: 'List subgoals' },
  { method: 'post', path: '/subgoals', summary: 'Create a subgoal', body: s.subgoalInput },
  { method: 'put', path: '/subgoals/{id}', summary: 'Update a subgoal', body: s.subgoalUpdate },
  { method: 'put', path: '/subgoals/{id}/complete', summary: 'Mark a subgoal complete or not', body: s.isCompleteBody },
  { method: 'delete', path: '/subgoals/{id}', summary: 'Delete a subgoal', status: 204 },

  { method: 'get', path: '/tasks', summary: 'List tasks with today’s completion', tz: true },
  { method: 'post', path: '/tasks', summary: 'Create a task', body: s.taskInput },
  { method: 'put', path: '/tasks/{id}', summary: 'Update a task', body: s.taskUpdate },
  { method: 'put', path: '/tasks/{id}/status', summary: 'Set a task status', body: s.taskStatusBody },
  { method: 'delete', path: '/tasks/{id}', summary: 'Delete a task', status: 204 },
  { method: 'put', path: '/tasks/{id}/completion', summary: 'Mark a habit done or not on a day', body: s.completionBody, tz: true },
  { method: 'get', path: '/streaks', summary: 'Streak cards for every habit', query: s.streakQuery, tz: true },

  { method: 'get', path: '/ideas', summary: 'List ideas', query: s.ideaListQuery },
  { method: 'get', path: '/ideas/{id}', summary: 'An idea' },
  { method: 'post', path: '/ideas', summary: 'Create an idea', body: s.ideaInput },
  { method: 'put', path: '/ideas/{id}', summary: 'Update an idea', body: s.ideaInput },
  { method: 'delete', path: '/ideas/{id}', summary: 'Delete an idea', status: 204 },
  { method: 'post', path: '/ideas/{id}/promote', summary: 'Create a goal from an idea', body: s.goalInput },
  { method: 'get', path: '/idea-tags', summary: 'List idea tags' },

  { method: 'get', path: '/vision-items', summary: 'List vision board items with signed image URLs' },
  { method: 'post', path: '/vision-items', summary: 'Create a vision board item', body: s.visionItemInput },
  { method: 'put', path: '/vision-items/order', summary: 'Reorder vision board items', body: s.orderBody, status: 204 },
  { method: 'put', path: '/vision-items/{id}', summary: 'Update a vision board item', body: s.visionItemInput },
  { method: 'delete', path: '/vision-items/{id}', summary: 'Delete a vision board item', status: 204 },
  { method: 'post', path: '/vision-images', summary: 'Upload a vision board image', upload: true },

  { method: 'get', path: '/settings', summary: 'User settings' },
  { method: 'put', path: '/settings/theme', summary: 'Set the theme', body: s.themeBody },
  { method: 'put', path: '/settings/streak-grace-days', summary: 'Set streak grace days', body: s.graceDaysBody },

  { method: 'get', path: '/profile', summary: 'Username and avatar' },
  { method: 'put', path: '/profile/username', summary: 'Set the username', body: s.usernameBody },
  { method: 'put', path: '/profile/avatar', summary: 'Upload an avatar', upload: true },
  { method: 'delete', path: '/profile/avatar', summary: 'Remove the avatar' }
];

/** JSON Schema of what a client may send (defaults make keys optional). */
const json = (schema: z.ZodType) => {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  return rest;
};

const error = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
});

function operation(op: Op) {
  const parameters: unknown[] = [];
  if (op.path.includes('{id}')) {
    parameters.push({ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } });
  }
  if (op.query) {
    const schema = json(op.query) as { properties?: Record<string, unknown>; required?: string[] };
    for (const [name, prop] of Object.entries(schema.properties ?? {})) {
      parameters.push({ name, in: 'query', required: schema.required?.includes(name) ?? false, schema: prop });
    }
  }
  if (op.tz) {
    parameters.push({
      name: 'X-Timezone',
      in: 'header',
      required: true,
      description: 'IANA time zone of the user, e.g. Europe/Berlin',
      schema: { type: 'string' }
    });
  }

  const status = op.status ?? 200;
  const responses: Record<string, unknown> = {
    [status]: status === 204
      ? { description: 'Done' }
      : { description: 'OK', content: { 'application/json': { schema: {} } } },
    429: error('Rate limited'),
    500: error('Internal error')
  };
  if (!op.open) {
    responses[400] = error('Invalid input');
    responses[401] = error('Missing, invalid or expired token');
    responses[404] = error('No such record (or not yours)');
  }

  return {
    operationId: `${op.method}${op.path.replace(/[{}]/g, '').replace(/[/-](\w)/g, (_, c: string) => c.toUpperCase())}`,
    summary: op.summary,
    ...(op.open ? { security: [] } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(op.body
      ? { requestBody: { required: true, content: { 'application/json': { schema: json(op.body) } } } }
      : {}),
    ...(op.upload
      ? {
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: { file: { type: 'string', format: 'binary', description: 'PNG, JPEG, WebP or GIF, at most 5 MB' } }
                }
              }
            }
          }
        }
      : {}),
    responses
  };
}

export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of OPERATIONS) {
    (paths[op.path] ??= {})[op.method] = operation(op);
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Mushpoint API',
      version: '1.0.0',
      description: 'Every route except the probes needs a Supabase access token as a bearer token. ' +
        'Records are scoped to the token’s user; another user’s id answers 404.'
    },
    servers: [{ url: '/api' }],
    security: [{ bearer: [] }],
    paths,
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Error: {
          type: 'object',
          required: ['kind', 'message'],
          properties: {
            kind: { type: 'string', enum: ['validation', 'unauthenticated', 'not_found', 'database', 'internal', 'unavailable'] },
            message: { type: 'string' }
          }
        }
      }
    }
  };
}
