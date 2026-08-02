import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as settings from './settings';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

describe('settings', () => {
	it('defaults to nocturne', async () => {
		expect((await settings.get(driver)).activeTheme).toBe('nocturne');
	});

	it('switches to a known theme', async () => {
		await settings.setTheme(driver, 'coquette');
		expect((await settings.get(driver)).activeTheme).toBe('coquette');
	});

	it('rejects an unknown theme', async () => {
		await expect(settings.setTheme(driver, 'vaporwave')).rejects.toMatchObject({
			kind: 'validation'
		});
		expect((await settings.get(driver)).activeTheme).toBe('nocturne');
	});

	it('the grace period starts at two days', async () => {
		expect((await settings.get(driver)).streakGraceDays).toBe(2);
		expect(await settings.graceDays(driver)).toBe(2);
	});

	it('the grace period can be changed within range', async () => {
		expect((await settings.setGraceDays(driver, 0)).streakGraceDays).toBe(0);
		expect((await settings.setGraceDays(driver, 7)).streakGraceDays).toBe(7);
	});

	it('rejects a grace period outside zero to seven', async () => {
		await expect(settings.setGraceDays(driver, 8)).rejects.toMatchObject({ kind: 'validation' });
		await expect(settings.setGraceDays(driver, -1)).rejects.toMatchObject({ kind: 'validation' });
		expect((await settings.get(driver)).streakGraceDays).toBe(2);
	});
});
