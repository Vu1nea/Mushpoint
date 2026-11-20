/** Postman collection (v2.1) that walks through every API use case in order:
 * sign in, set up the profile, build a goal with subgoals, tasks and a habit,
 * capture and promote an idea, fill the vision board, then delete what it made.
 *
 * Each create request stores the new id in a collection variable that later
 * requests use, so the Collection Runner can run the folders top to bottom.
 * `npm run postman` writes it to `postman/mushpoint.postman_collection.json`;
 * `postman.spec.ts` runs every step against the app and fails when the file is
 * stale or an operation in `OPERATIONS` has no step. DELETE /account is left
 * out on purpose, so a full run never deletes the account it signed in with. */
import { OPERATIONS } from './openapi';

type Method = 'get' | 'post' | 'put' | 'delete';

export interface Step {
  name: string;
  method: Method;
  /** API path; `{{var}}` is a collection variable. */
  path: string;
  query?: Record<string, string>;
  /** JSON body; `'{{somethingId}}'` is sent bare (a number), other variables as strings. */
  body?: Record<string, unknown>;
  /** Multipart upload in field `file`. */
  upload?: boolean;
  /** Stores a response field (a dotted path) in a collection variable. */
  capture?: { variable: string; field: string };
  status: number;
  description?: string;
}

export interface Folder {
  name: string;
  description: string;
  steps: Step[];
}

const goalBody = {
  categoryId: '{{categoryId}}',
  title: 'Run a half marathon',
  description: 'Train three times a week',
  timeframe: 'mid',
  dueDate: '2027-06-01',
  motivationText: 'Feel strong',
  motivationImagePath: null,
  repoUrl: null
};

const taskBody = {
  title: 'Buy running shoes',
  dueDate: '2027-01-15',
  goalId: '{{goalId}}',
  subgoalId: '{{subgoalId}}',
  recurrence: null
};

export const FOLDERS: Folder[] = [
  {
    name: '0. Probes',
    description: 'No token needed.',
    steps: [
      { name: 'Liveness', method: 'get', path: '/healthz', status: 200 },
      { name: 'Readiness (checks the database)', method: 'get', path: '/readyz', status: 200 }
    ]
  },
  {
    name: '1. Profile and settings',
    description: 'The account’s username, avatar, theme and streak grace period.',
    steps: [
      { name: 'Get profile', method: 'get', path: '/profile', status: 200 },
      { name: 'Set username', method: 'put', path: '/profile/username', body: { username: 'postman_runner' }, status: 200 },
      {
        name: 'Upload avatar',
        method: 'put',
        path: '/profile/avatar',
        upload: true,
        status: 200,
        description: 'Pick a PNG, JPEG, WebP or GIF of at most 5 MB in the `file` field.'
      },
      { name: 'Remove avatar', method: 'delete', path: '/profile/avatar', status: 200 },
      { name: 'Get settings', method: 'get', path: '/settings', status: 200 },
      { name: 'Set theme', method: 'put', path: '/settings/theme', body: { theme: 'coquette' }, status: 200, description: '`nocturne` or `coquette`.' },
      { name: 'Set streak grace days', method: 'put', path: '/settings/streak-grace-days', body: { days: 2 }, status: 200, description: '0 to 7.' }
    ]
  },
  {
    name: '2. Categories',
    description: 'Optional groups for goals.',
    steps: [
      {
        name: 'Create category',
        method: 'post',
        path: '/categories',
        body: { name: 'Health', colorToken: null },
        capture: { variable: 'categoryId', field: 'id' },
        status: 200
      },
      { name: 'List categories', method: 'get', path: '/categories', status: 200 },
      { name: 'Rename category', method: 'put', path: '/categories/{{categoryId}}', body: { name: 'Health and fitness', colorToken: null }, status: 200 }
    ]
  },
  {
    name: '3. Goals and subgoals',
    description: 'Every PUT replaces the whole record: send every field, `null` to clear one.',
    steps: [
      { name: 'Create goal', method: 'post', path: '/goals', body: goalBody, capture: { variable: 'goalId', field: 'id' }, status: 200 },
      { name: 'List active goals', method: 'get', path: '/goals', query: { status: 'active' }, status: 200 },
      { name: 'Update goal', method: 'put', path: '/goals/{{goalId}}', body: { ...goalBody, timeframe: 'long' }, status: 200 },
      {
        name: 'Create subgoal',
        method: 'post',
        path: '/subgoals',
        body: { goalId: '{{goalId}}', title: 'Run 10 km', dueDate: '2027-03-01' },
        capture: { variable: 'subgoalId', field: 'id' },
        status: 200
      },
      { name: 'List subgoals', method: 'get', path: '/subgoals', status: 200 },
      { name: 'Update subgoal', method: 'put', path: '/subgoals/{{subgoalId}}', body: { title: 'Run 12 km', dueDate: '2027-03-15', isComplete: false }, status: 200 },
      { name: 'Complete subgoal', method: 'put', path: '/subgoals/{{subgoalId}}/complete', body: { isComplete: true }, status: 200 }
    ]
  },
  {
    name: '4. Tasks and habits',
    description: 'A task with a `recurrence` is a habit; marking it done on a day builds its streak.',
    steps: [
      { name: 'Create task', method: 'post', path: '/tasks', body: taskBody, capture: { variable: 'taskId', field: 'id' }, status: 200 },
      {
        name: 'Create daily habit',
        method: 'post',
        path: '/tasks',
        body: { title: 'Stretch for 10 minutes', dueDate: null, goalId: '{{goalId}}', subgoalId: null, recurrence: 'daily' },
        capture: { variable: 'habitId', field: 'id' },
        status: 200
      },
      { name: 'List tasks', method: 'get', path: '/tasks', status: 200 },
      { name: 'Update task', method: 'put', path: '/tasks/{{taskId}}', body: { ...taskBody, title: 'Buy trail shoes', status: 'in_progress' }, status: 200 },
      { name: 'Set task status', method: 'put', path: '/tasks/{{taskId}}/status', body: { status: 'done' }, status: 200 },
      {
        name: 'Mark habit done today',
        method: 'put',
        path: '/tasks/{{habitId}}/completion',
        body: { done: true, date: null },
        status: 200,
        description: '`date: null` means today in `X-Timezone`; a `YYYY-MM-DD` marks a past day.'
      },
      { name: 'Goal with its subgoals and tasks', method: 'get', path: '/goals/{{goalId}}', status: 200 },
      { name: 'Streaks for the last 30 days', method: 'get', path: '/streaks', query: { days: '30' }, status: 200 },
      { name: 'Complete goal', method: 'put', path: '/goals/{{goalId}}/status', body: { status: 'completed' }, status: 200 }
    ]
  },
  {
    name: '5. Ideas',
    description: 'Loose ideas with tags; promoting one turns it into a goal.',
    steps: [
      {
        name: 'Create idea',
        method: 'post',
        path: '/ideas',
        body: { title: 'Learn to bake bread', note: 'Sourdough first', tagNames: ['cooking', 'someday'] },
        capture: { variable: 'ideaId', field: 'id' },
        status: 200
      },
      { name: 'List ideas tagged cooking', method: 'get', path: '/ideas', query: { tag: 'cooking', includePromoted: 'false' }, status: 200 },
      { name: 'Get idea', method: 'get', path: '/ideas/{{ideaId}}', status: 200 },
      { name: 'Update idea', method: 'put', path: '/ideas/{{ideaId}}', body: { title: 'Learn to bake bread', note: 'Rye too', tagNames: ['cooking'] }, status: 200 },
      { name: 'List idea tags', method: 'get', path: '/idea-tags', status: 200 },
      {
        name: 'Promote idea to a goal',
        method: 'post',
        path: '/ideas/{{ideaId}}/promote',
        body: { ...goalBody, categoryId: null, title: 'Bake a loaf every week', timeframe: 'short', dueDate: null, motivationText: null },
        capture: { variable: 'promotedGoalId', field: 'goal.id' },
        status: 200
      }
    ]
  },
  {
    name: '6. Vision board',
    description: 'Upload an image first; an item holds an uploaded image path, a quote, or both.',
    steps: [
      {
        name: 'Upload vision image',
        method: 'post',
        path: '/vision-images',
        upload: true,
        capture: { variable: 'imagePath', field: 'imagePath' },
        status: 200,
        description: 'Pick a PNG, JPEG, WebP or GIF of at most 5 MB in the `file` field.'
      },
      {
        name: 'Create image item',
        method: 'post',
        path: '/vision-items',
        body: { imagePath: '{{imagePath}}', quoteText: null },
        capture: { variable: 'imageItemId', field: 'id' },
        status: 200
      },
      {
        name: 'Create quote item',
        method: 'post',
        path: '/vision-items',
        body: { imagePath: null, quoteText: 'Small steps, every day.' },
        capture: { variable: 'quoteItemId', field: 'id' },
        status: 200
      },
      { name: 'List vision items', method: 'get', path: '/vision-items', status: 200 },
      { name: 'Add a quote to the image item', method: 'put', path: '/vision-items/{{imageItemId}}', body: { imagePath: '{{imagePath}}', quoteText: 'Finish line' }, status: 200 },
      { name: 'Reorder items', method: 'put', path: '/vision-items/order', body: { orderedIds: ['{{quoteItemId}}', '{{imageItemId}}'] }, status: 204 }
    ]
  },
  {
    name: '7. Clean up',
    description: 'Deletes what the earlier folders created.',
    steps: [
      { name: 'Delete image item', method: 'delete', path: '/vision-items/{{imageItemId}}', status: 204 },
      { name: 'Delete quote item', method: 'delete', path: '/vision-items/{{quoteItemId}}', status: 204 },
      { name: 'Delete idea', method: 'delete', path: '/ideas/{{ideaId}}', status: 204 },
      { name: 'Delete promoted goal', method: 'delete', path: '/goals/{{promotedGoalId}}', status: 204 },
      { name: 'Delete task', method: 'delete', path: '/tasks/{{taskId}}', status: 204 },
      { name: 'Delete subgoal', method: 'delete', path: '/subgoals/{{subgoalId}}', status: 204 },
      {
        name: 'Delete goal and its orphaned tasks',
        method: 'delete',
        path: '/goals/{{goalId}}',
        query: { deleteOrphanedTasks: 'true' },
        status: 204,
        description: 'With `deleteOrphanedTasks=false` the goal’s tasks are kept, unlinked.'
      },
      { name: 'Delete category', method: 'delete', path: '/categories/{{categoryId}}', status: 204 }
    ]
  }
];

/** The `OPERATIONS` entry a step exercises, as `get /goals/{id}`. */
export const operationOf = (step: Step) => `${step.method} ${step.path.replace(/\{\{\w+\}\}/g, '{id}')}`;

/** The body as Postman raw text: an id variable `"{{goalId}}"` becomes a bare `{{goalId}}`. */
export const rawBody = (body: Record<string, unknown>) =>
  JSON.stringify(body, null, 2).replace(/"(\{\{\w+Id\}\})"/g, '$1');

const OPEN = new Set(OPERATIONS.filter((op) => op.open).map((op) => `${op.method} ${op.path}`));
const TZ = new Set(OPERATIONS.filter((op) => op.tz).map((op) => `${op.method} ${op.path}`));

const VARIABLES = [
  ['baseUrl', 'http://localhost:3000/api', 'The API, ending in /api.'],
  ['supabaseUrl', 'https://your-project.supabase.co', 'For "Sign in" only.'],
  ['supabaseAnonKey', '', 'The project’s anon (public) key, for "Sign in" only.'],
  ['email', '', 'A test account. Do not use a real account’s password in a shared collection.'],
  ['password', '', ''],
  ['token', '', 'Set by "Sign in", or paste a Supabase access token.'],
  ['timezone', 'UTC', 'IANA zone used for "today", e.g. Europe/Berlin.']
] as const;

const CAPTURED = FOLDERS.flatMap((f) => f.steps.flatMap((s) => (s.capture ? [s.capture.variable] : [])));

function testScript(step: Step): string[] {
  const lines = [`pm.test('answers ${step.status}', () => pm.response.to.have.status(${step.status}));`];
  if (step.capture) {
    lines.push(`pm.collectionVariables.set('${step.capture.variable}', pm.response.json().${step.capture.field});`);
  }
  return lines;
}

function item(step: Step) {
  const op = operationOf(step);
  const segments = step.path.split('/').filter(Boolean);
  const query = Object.entries(step.query ?? {}).map(([key, value]) => ({ key, value }));
  const header: { key: string; value: string }[] = [];
  if (TZ.has(op)) header.push({ key: 'X-Timezone', value: '{{timezone}}' });
  if (step.body) header.push({ key: 'Content-Type', value: 'application/json' });
  const qs = query.length ? `?${query.map((q) => `${q.key}=${q.value}`).join('&')}` : '';

  return {
    name: step.name,
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: testScript(step) } }],
    request: {
      ...(OPEN.has(op) ? { auth: { type: 'noauth' } } : {}),
      method: step.method.toUpperCase(),
      header,
      ...(step.body ? { body: { mode: 'raw', raw: rawBody(step.body) } } : {}),
      ...(step.upload ? { body: { mode: 'formdata', formdata: [{ key: 'file', type: 'file', src: [] }] } } : {}),
      url: {
        raw: `{{baseUrl}}${step.path}${qs}`,
        host: ['{{baseUrl}}'],
        path: segments,
        ...(query.length ? { query } : {})
      },
      ...(step.description ? { description: step.description } : {})
    }
  };
}

/** Signs in with Supabase's password grant and stores the access token. */
const signIn = {
  name: 'Sign in (Supabase)',
  event: [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          "pm.test('signed in', () => pm.response.to.have.status(200));",
          "pm.collectionVariables.set('token', pm.response.json().access_token);"
        ]
      }
    }
  ],
  request: {
    auth: { type: 'noauth' },
    method: 'POST',
    header: [
      { key: 'apikey', value: '{{supabaseAnonKey}}' },
      { key: 'Content-Type', value: 'application/json' }
    ],
    body: { mode: 'raw', raw: JSON.stringify({ email: '{{email}}', password: '{{password}}' }, null, 2) },
    url: {
      raw: '{{supabaseUrl}}/auth/v1/token?grant_type=password',
      host: ['{{supabaseUrl}}'],
      path: ['auth', 'v1', 'token'],
      query: [{ key: 'grant_type', value: 'password' }]
    },
    description: 'Talks to Supabase, not the API. Tokens expire after an hour; run this again on a 401.'
  }
};

export function buildPostman() {
  return {
    info: {
      name: 'Mushpoint API',
      description:
        'Every Mushpoint API use case, in order. Set `baseUrl`, then either fill `supabaseUrl`, ' +
        '`supabaseAnonKey`, `email` and `password` and run "Sign in", or paste an access token into `token`. ' +
        'Run the folders top to bottom (the Collection Runner works); create requests store their ids for later ones. ' +
        'The two upload requests need a file picked first. Deleting the account is left out on purpose: ' +
        'it is `DELETE {{baseUrl}}/account` with the bearer token. Generated by `npm run postman` in `server/`.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
    variable: [
      ...VARIABLES.map(([key, value, description]) => ({ key, value, ...(description ? { description } : {}) })),
      ...CAPTURED.map((key) => ({ key, value: '' }))
    ],
    item: [
      { name: 'Sign in', item: [signIn] },
      ...FOLDERS.map((folder) => ({ name: folder.name, description: folder.description, item: folder.steps.map(item) }))
    ]
  };
}
