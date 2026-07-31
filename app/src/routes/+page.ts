import { redirect } from '@sveltejs/kit';

// The Dashboard lands in a later phase; Goals is the app's home until then.
export const load = () => redirect(307, '/goals');
