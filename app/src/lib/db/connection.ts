import Database from '@tauri-apps/plugin-sql';
import { AppError } from './error';
import type { SqlDriver } from './driver';
import { createPluginSqlDriver } from './pluginSqlDriver';

/** Must match SQL_CONNECTION in src-tauri/src/lib.rs verbatim — tauri-plugin-sql
 * keys registered migrations by this exact string. */
const CONNECTION_STRING = 'sqlite:mushpoint.sqlite3';

function hasBackend() {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let driver: Promise<SqlDriver> | null = null;

/** The one live connection for the whole app, lazily created on first use. */
export function getDriver(): Promise<SqlDriver> {
	if (!driver) {
		driver = connect();
	}
	return driver;
}

async function connect(): Promise<SqlDriver> {
	if (!hasBackend()) {
		throw new AppError(
			'unavailable',
			'The desktop backend is not running. Start the app with `npm run tauri dev` instead of `npm run dev`.'
		);
	}

	const db = await Database.load(CONNECTION_STRING);
	// Foreign keys are off by default in SQLite; the schema leans on ON DELETE rules.
	await db.execute('PRAGMA foreign_keys = ON');
	return createPluginSqlDriver(db);
}
