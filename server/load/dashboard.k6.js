// k6 load test for the two hot paths: the dashboard load (six reads in
// parallel, as the app's +page.ts does) and ticking a habit (the streak write).
//
// Run against staging, never production, with a throwaway account:
//
//   k6 run server/load/dashboard.k6.js \
//     -e API_URL=https://staging.example.com/api \
//     -e SUPABASE_URL=https://<ref>.supabase.co -e SUPABASE_ANON_KEY=sb_publishable_... \
//     -e EMAIL=load-test@example.com -e PASSWORD=...
//
// Every virtual user shares the one account, so this measures the API and
// database, not per-user rate limits. The API's per-IP limit (600/min) will
// answer 429 from one machine: raise RATE_LIMIT_PER_IP on staging for the run.
// The thresholds are the proposed SLO; a breach makes k6 exit non-zero.
import http from 'k6/http';
import { check, fail, group, sleep } from 'k6';

const API = __ENV.API_URL || 'http://localhost:3000/api';
const TZ = __ENV.TZ_NAME || 'Europe/London';

export const options = {
	scenarios: {
		dashboard: {
			executor: 'ramping-vus',
			exec: 'dashboard',
			startVUs: 0,
			stages: [
				{ duration: '30s', target: 20 },
				{ duration: '2m', target: 20 },
				{ duration: '30s', target: 0 }
			]
		},
		tick_habit: {
			executor: 'constant-arrival-rate',
			exec: 'tickHabit',
			rate: 5,
			timeUnit: '1s',
			duration: '3m',
			preAllocatedVUs: 10
		}
	},
	thresholds: {
		http_req_failed: ['rate<0.01'],
		'http_req_duration{group:::dashboard}': ['p(95)<300'],
		'http_req_duration{group:::tick habit}': ['p(95)<300']
	}
};

/** Signs in once with Supabase's password grant; tokens last an hour, longer than the run. */
export function setup() {
	for (const name of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'EMAIL', 'PASSWORD']) {
		if (!__ENV[name]) fail(`set -e ${name}=...`);
	}
	const res = http.post(
		`${__ENV.SUPABASE_URL}/auth/v1/token?grant_type=password`,
		JSON.stringify({ email: __ENV.EMAIL, password: __ENV.PASSWORD }),
		{ headers: { 'Content-Type': 'application/json', apikey: __ENV.SUPABASE_ANON_KEY } }
	);
	if (res.status !== 200) fail(`sign-in failed: ${res.status}`);
	const token = res.json('access_token');
	const headers = authHeaders(token);

	// A daily habit to tick; reuse it across runs so the account does not grow.
	const tasks = http.get(`${API}/tasks`, { headers }).json();
	let habit = tasks.find((t) => t.title === 'k6 habit');
	if (!habit) {
		habit = http
			.post(
				`${API}/tasks`,
				JSON.stringify({
					title: 'k6 habit',
					dueDate: null,
					goalId: null,
					subgoalId: null,
					recurrence: 'daily'
				}),
				{ headers }
			)
			.json();
	}
	if (!habit || !habit.id) fail('could not create the k6 habit task');
	return { token, habitId: habit.id };
}

function authHeaders(token) {
	return {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
		'X-Timezone': TZ
	};
}

export function dashboard(data) {
	const params = { headers: authHeaders(data.token) };
	group('dashboard', () => {
		const responses = http.batch([
			['GET', `${API}/categories`, null, params],
			['GET', `${API}/goals?status=active`, null, params],
			['GET', `${API}/subgoals`, null, params],
			['GET', `${API}/tasks`, null, params],
			['GET', `${API}/streaks`, null, params],
			['GET', `${API}/vision-items`, null, params]
		]);
		for (const res of responses) check(res, { 'dashboard 200': (r) => r.status === 200 });
	});
	sleep(1);
}

export function tickHabit(data) {
	const params = { headers: authHeaders(data.token) };
	group('tick habit', () => {
		// Alternate done/undone so the row count stays flat.
		const done = Math.random() < 0.5;
		const res = http.put(
			`${API}/tasks/${data.habitId}/completion`,
			JSON.stringify({ done, date: null }),
			params
		);
		check(res, { 'completion 200': (r) => r.status === 200 });
	});
}
