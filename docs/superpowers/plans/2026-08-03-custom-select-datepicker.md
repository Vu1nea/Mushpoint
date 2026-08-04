# Custom Select & Date Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native-control-backed `Select.svelte` and every native `<input type="date">` with fully custom, themed components (`Select.svelte` rewritten, new `DatePicker.svelte`) that animate with a bouncy `backOut` pop and escape any `overflow-hidden` ancestor via a portaled, fixed-position panel.

**Architecture:** Two pure, DOM-free logic modules (`selectOptions.ts`, `calendarGrid.ts`) hold the testable math. A shared rune-based `popover.svelte.ts` holds the "float a panel off a trigger's rect, portal it to `<body>`, close on outside click" mechanics (same approach already proven in `Tooltip.svelte`, factored once since two new components need it). `Select.svelte` and `DatePicker.svelte` are thin view layers on top of those three modules. Seven call sites across four files switch from native markup to the new components.

**Tech Stack:** Svelte 5 (runes), Tailwind v4 utility classes, `svelte/transition` (`scale`, `fly`) + `svelte/easing` (`backOut`) for animation, Vitest for the pure-logic unit tests. No new npm dependencies.

## Global Constraints

- No typed/manual date entry in `DatePicker` — calendar-only (per approved spec).
- `Select` groups are one level deep only (matches every current use).
- No new npm dependencies.
- `npx svelte-check` (run from `app/`) must report 0 errors at the end of every task; do not introduce new warnings beyond the two pre-existing `KanbanBoard.svelte` drag-handler ones.
- Format every touched file with `npx prettier --write <files>` (run from `app/`) before committing.
- Reuse existing tokens/helpers — `$lib/motion`'s `motion()`, `$lib/format`'s `formatDate`, the `field`/`sectionHeading` exports from `./ui`, the existing `mp-pop` CSS animation class in `theme.css`. Do not invent parallel ones.
- `Tooltip.svelte` is out of scope — do not modify it.

---

### Task 1: `calendarGrid.ts` — pure calendar math

**Files:**
- Create: `app/src/lib/calendarGrid.ts`
- Test: `app/src/lib/calendarGrid.spec.ts`

**Interfaces:**
- Consumes: nothing (pure, no imports beyond built-ins).
- Produces (used by Task 6, `DatePicker.svelte`):
  - `interface CalendarDay { iso: string; day: number; inCurrentMonth: boolean; isToday: boolean; isSelected: boolean }`
  - `function isoOf(year: number, month: number, day: number): string` — `month` is 0-indexed.
  - `function todayIso(now?: Date): string`
  - `function addDays(iso: string, delta: number): string`
  - `function shiftMonth(year: number, month: number, delta: number): { year: number; month: number }`
  - `function monthLabel(year: number, month: number): string`
  - `function monthGrid(year: number, month: number, selectedIso: string | null, today: string): CalendarDay[]` — always 42 cells (6 full weeks, Sunday-first), including leading/trailing days from adjacent months.

- [ ] **Step 1: Write the failing tests**

```ts
// app/src/lib/calendarGrid.spec.ts
import { describe, expect, it } from 'vitest';

import { addDays, isoOf, monthGrid, monthLabel, shiftMonth, todayIso } from './calendarGrid';

describe('isoOf', () => {
	it('formats a zero-padded ISO date from a local year/month/day', () => {
		expect(isoOf(2026, 7, 15)).toBe('2026-08-15');
		expect(isoOf(2026, 0, 1)).toBe('2026-01-01');
	});
});

describe('todayIso', () => {
	it('reads the ISO date from a given Date', () => {
		expect(todayIso(new Date(2026, 6, 31))).toBe('2026-07-31');
	});
});

describe('addDays', () => {
	it('adds and subtracts days within a month', () => {
		expect(addDays('2026-08-15', 1)).toBe('2026-08-16');
		expect(addDays('2026-08-15', -1)).toBe('2026-08-14');
	});

	it('crosses month and year boundaries', () => {
		expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
		expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
	});

	it('adds a full week', () => {
		expect(addDays('2026-08-28', 7)).toBe('2026-09-04');
	});
});

describe('shiftMonth', () => {
	it('moves within a year', () => {
		expect(shiftMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });
		expect(shiftMonth(2026, 5, -1)).toEqual({ year: 2026, month: 4 });
	});

	it('wraps across a year boundary', () => {
		expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
		expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
	});
});

describe('monthLabel', () => {
	it('names the month and year', () => {
		expect(monthLabel(2026, 7)).toBe('August 2026');
		expect(monthLabel(2026, 0)).toBe('January 2026');
	});
});

describe('monthGrid', () => {
	it('always returns 42 cells starting on a Sunday', () => {
		const grid = monthGrid(2026, 7, null, '2026-08-15');
		expect(grid).toHaveLength(42);
		expect(new Date(`${grid[0].iso}T00:00:00`).getDay()).toBe(0);
	});

	it('marks exactly one in-month day 1', () => {
		const grid = monthGrid(2026, 7, null, '2026-08-15');
		const firstDays = grid.filter((day) => day.day === 1 && day.inCurrentMonth);
		expect(firstDays).toHaveLength(1);
		expect(firstDays[0].iso).toBe('2026-08-01');
	});

	it('marks the matching today and selected cells', () => {
		const grid = monthGrid(2026, 7, '2026-08-20', '2026-08-15');
		expect(grid.find((day) => day.iso === '2026-08-15')?.isToday).toBe(true);
		expect(grid.find((day) => day.iso === '2026-08-20')?.isSelected).toBe(true);
	});

	it('marks leading/trailing days from neighboring months as out of month', () => {
		const grid = monthGrid(2026, 7, null, '2026-08-15');
		expect(grid[0].inCurrentMonth).toBe(false);
		expect(grid.at(-1)?.inCurrentMonth).toBe(false);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `app/`): `npx vitest run src/lib/calendarGrid.spec.ts`
Expected: FAIL — `Cannot find module './calendarGrid'`.

- [ ] **Step 3: Implement `calendarGrid.ts`**

```ts
// app/src/lib/calendarGrid.ts

/** Pure calendar math for DatePicker.svelte — no DOM, no Svelte. */

export interface CalendarDay {
	iso: string;
	day: number;
	inCurrentMonth: boolean;
	isToday: boolean;
	isSelected: boolean;
}

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

/** `month` is 0-indexed, matching `Date`. */
export function isoOf(year: number, month: number, day: number): string {
	const date = new Date(year, month, day);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(now: Date = new Date()): string {
	return isoOf(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(iso: string, delta: number): string {
	const [year, month, day] = iso.split('-').map(Number);
	const date = new Date(year, month - 1, day + delta);
	return isoOf(date.getFullYear(), date.getMonth(), date.getDate());
}

export function shiftMonth(
	year: number,
	month: number,
	delta: number
): { year: number; month: number } {
	const date = new Date(year, month + delta, 1);
	return { year: date.getFullYear(), month: date.getMonth() };
}

export function monthLabel(year: number, month: number): string {
	return new Date(year, month, 1).toLocaleDateString(undefined, {
		month: 'long',
		year: 'numeric'
	});
}

/** Always 42 cells (6 full weeks, Sunday-first), including the leading/trailing
 * days of neighboring months needed to fill the grid. */
export function monthGrid(
	year: number,
	month: number,
	selectedIso: string | null,
	today: string
): CalendarDay[] {
	const firstOfMonth = new Date(year, month, 1);
	const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());

	return Array.from({ length: 42 }, (_, index) => {
		const date = new Date(
			gridStart.getFullYear(),
			gridStart.getMonth(),
			gridStart.getDate() + index
		);
		const iso = isoOf(date.getFullYear(), date.getMonth(), date.getDate());
		return {
			iso,
			day: date.getDate(),
			inCurrentMonth: date.getMonth() === month,
			isToday: iso === today,
			isSelected: iso === selectedIso
		};
	});
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `app/`): `npx vitest run src/lib/calendarGrid.spec.ts`
Expected: PASS, all 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/calendarGrid.ts app/src/lib/calendarGrid.spec.ts
git commit -m "feat: add pure calendar-grid math for the custom date picker"
```

---

### Task 2: `selectOptions.ts` — pure option/group helpers

**Files:**
- Create: `app/src/lib/selectOptions.ts`
- Test: `app/src/lib/selectOptions.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Task 4, `Select.svelte`, and by every call site in Task 5):
  - `interface SelectOption { value: string; label: string }`
  - `interface SelectGroup { label: string; options: SelectOption[] }`
  - `type SelectItem = SelectOption | SelectGroup`
  - `function isGroup(item: SelectItem): item is SelectGroup`
  - `function flattenOptions(items: SelectItem[]): SelectOption[]`
  - `function labelFor(items: SelectItem[], value: string): string | undefined`

- [ ] **Step 1: Write the failing tests**

```ts
// app/src/lib/selectOptions.spec.ts
import { describe, expect, it } from 'vitest';

import { flattenOptions, isGroup, labelFor, type SelectItem } from './selectOptions';

describe('isGroup', () => {
	it('tells options and groups apart', () => {
		expect(isGroup({ value: 'a', label: 'A' })).toBe(false);
		expect(isGroup({ label: 'Group', options: [] })).toBe(true);
	});
});

describe('flattenOptions', () => {
	it('leaves a flat list unchanged', () => {
		const items: SelectItem[] = [
			{ value: 'a', label: 'A' },
			{ value: 'b', label: 'B' }
		];
		expect(flattenOptions(items)).toEqual(items);
	});

	it('flattens groups in place, preserving order', () => {
		const items: SelectItem[] = [
			{ value: '', label: 'Standalone' },
			{
				label: 'Goal 1',
				options: [
					{ value: 'goal:1', label: 'Goal 1 (whole goal)' },
					{ value: 'subgoal:1', label: '↳ Sub 1' }
				]
			},
			{ label: 'Goal 2', options: [{ value: 'goal:2', label: 'Goal 2 (whole goal)' }] }
		];
		expect(flattenOptions(items)).toEqual([
			{ value: '', label: 'Standalone' },
			{ value: 'goal:1', label: 'Goal 1 (whole goal)' },
			{ value: 'subgoal:1', label: '↳ Sub 1' },
			{ value: 'goal:2', label: 'Goal 2 (whole goal)' }
		]);
	});
});

describe('labelFor', () => {
	const items: SelectItem[] = [
		{ value: '', label: 'Standalone' },
		{ label: 'Goal 1', options: [{ value: 'goal:1', label: 'Goal 1 (whole goal)' }] }
	];

	it('finds a top-level option', () => {
		expect(labelFor(items, '')).toBe('Standalone');
	});

	it('finds an option nested in a group', () => {
		expect(labelFor(items, 'goal:1')).toBe('Goal 1 (whole goal)');
	});

	it('returns undefined for no match', () => {
		expect(labelFor(items, 'missing')).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `app/`): `npx vitest run src/lib/selectOptions.spec.ts`
Expected: FAIL — `Cannot find module './selectOptions'`.

- [ ] **Step 3: Implement `selectOptions.ts`**

```ts
// app/src/lib/selectOptions.ts

/** Pure option/group helpers for Select.svelte — no DOM, no Svelte. */

export interface SelectOption {
	value: string;
	label: string;
}

export interface SelectGroup {
	label: string;
	options: SelectOption[];
}

export type SelectItem = SelectOption | SelectGroup;

export function isGroup(item: SelectItem): item is SelectGroup {
	return 'options' in item;
}

export function flattenOptions(items: SelectItem[]): SelectOption[] {
	return items.flatMap((item) => (isGroup(item) ? item.options : [item]));
}

export function labelFor(items: SelectItem[], value: string): string | undefined {
	return flattenOptions(items).find((option) => option.value === value)?.label;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `app/`): `npx vitest run src/lib/selectOptions.spec.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/selectOptions.ts app/src/lib/selectOptions.spec.ts
git commit -m "feat: add pure option/group flattening helpers for the custom select"
```

---

### Task 3: `popover.svelte.ts` — shared floating-panel mechanics

**Files:**
- Create: `app/src/lib/popover.svelte.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Task 4 `Select.svelte` and Task 6 `DatePicker.svelte`):
  - `class Popover { open: boolean; top: number; left: number; width: number; show(anchor: HTMLElement): void; hide(): void }` (all fields are `$state`, readable/reactive from consuming components)
  - `function portal(node: HTMLElement): { destroy(): void }` — Svelte action, reparents `node` to `document.body`.
  - `function isOutside(event: MouseEvent, ...nodes: Array<HTMLElement | undefined>): boolean` — true when `event.target` is outside every given node.

No automated test for this file: it's DOM-and-rune-dependent (reads `getBoundingClientRect`, mutates `document.body`), and this repo has no component/browser test runner configured (`vitest.config.ts` only defines a Node-environment project and explicitly excludes `*.svelte.{test,spec}.ts`). Every other interactive Svelte component built in this codebase (`Tooltip.svelte`, `ConfirmDialog.svelte`, etc.) is verified the same way this one will be: `svelte-check` plus manual exercise once wired into `Select`/`DatePicker` in later tasks.

- [ ] **Step 1: Implement `popover.svelte.ts`**

```ts
// app/src/lib/popover.svelte.ts

/**
 * Shared floating-panel mechanics for Select and DatePicker: position a panel
 * off a trigger's rect, portal it to <body> so it escapes any overflow-hidden
 * ancestor (cards, drawers, the sidebar), and close it on outside click.
 *
 * Position is computed once on open, not tracked live — a scroll/resize while
 * open closes the panel instead, same trade-off already made in Tooltip.svelte.
 */
export class Popover {
	open = $state(false);
	top = $state(0);
	left = $state(0);
	width = $state(0);

	#anchor: HTMLElement | undefined;

	show(anchor: HTMLElement) {
		this.#anchor = anchor;
		this.#place();
		this.open = true;
	}

	hide() {
		this.open = false;
	}

	#place() {
		if (!this.#anchor) return;
		const rect = this.#anchor.getBoundingClientRect();
		this.top = rect.bottom + 6;
		this.left = rect.left;
		this.width = rect.width;
	}
}

/** Reparents the node to <body> on mount, removes it on destroy. */
export function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}

export function isOutside(event: MouseEvent, ...nodes: Array<HTMLElement | undefined>): boolean {
	const target = event.target as Node;
	return nodes.every((node) => node && !node.contains(target));
}
```

- [ ] **Step 2: Type-check**

Run (from `app/`): `npx svelte-check --output human`
Expected: 0 errors (this file has no `.svelte` markup, so svelte-check only type-checks it as plain TS).

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/popover.svelte.ts
git commit -m "feat: add shared portal/position/outside-click helper for floating panels"
```

---

### Task 4: Rewrite `Select.svelte`

**Files:**
- Modify: `app/src/lib/components/Select.svelte` (full rewrite)

**Interfaces:**
- Consumes: `Popover`, `portal`, `isOutside` from `$lib/popover.svelte` (Task 3); `SelectItem`, `SelectOption`, `isGroup`, `flattenOptions`, `labelFor` from `$lib/selectOptions` (Task 2); `field` from `./ui`; `Icon` (existing).
- Produces (used by Task 5 call sites): props `{ value: string /* $bindable */, options: SelectItem[], id?: string, ariaLabel?: string, disabled?: boolean, class?: string }`.

- [ ] **Step 1: Replace the file**

```svelte
<!-- app/src/lib/components/Select.svelte -->
<script lang="ts">
	import { backOut } from 'svelte/easing';
	import { scale } from 'svelte/transition';

	import { motion } from '$lib/motion';
	import { isOutside, Popover, portal } from '$lib/popover.svelte';
	import {
		flattenOptions,
		isGroup,
		labelFor,
		type SelectItem,
		type SelectOption
	} from '$lib/selectOptions';
	import Icon from './Icon.svelte';
	import { field } from './ui';

	interface Props {
		value: string;
		options: SelectItem[];
		id?: string;
		ariaLabel?: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		value = $bindable(),
		options,
		id,
		ariaLabel,
		disabled = false,
		class: className = ''
	}: Props = $props();

	const popover = new Popover();
	const listboxId = `${id ?? 'select'}-listbox`;

	let root: HTMLElement | undefined = $state();
	let trigger: HTMLButtonElement | undefined = $state();
	let panel: HTMLElement | undefined = $state();
	let highlighted = $state(0);

	const flat = $derived(flattenOptions(options));
	const selectedLabel = $derived(labelFor(options, value));
	const activeId = $derived(
		popover.open && flat[highlighted] ? `${listboxId}-${flat[highlighted].value}` : undefined
	);

	function openPanel() {
		if (disabled || !trigger) return;
		const index = flat.findIndex((option) => option.value === value);
		highlighted = Math.max(0, index);
		popover.show(trigger);
	}

	function closePanel() {
		popover.hide();
	}

	function choose(optionValue: string) {
		value = optionValue;
		closePanel();
		trigger?.focus();
	}

	function onTriggerKeydown(event: KeyboardEvent) {
		if (disabled) return;
		if (!popover.open) {
			if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
				event.preventDefault();
				openPanel();
			}
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlighted = Math.min(highlighted + 1, flat.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlighted = Math.max(highlighted - 1, 0);
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const option = flat[highlighted];
			if (option) choose(option.value);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			closePanel();
			trigger?.focus();
		}
	}

	function onWindowMousedown(event: MouseEvent) {
		if (popover.open && isOutside(event, root, panel)) closePanel();
	}
</script>

<svelte:window onmousedown={onWindowMousedown} />

<div class="relative {className}" bind:this={root}>
	<button
		bind:this={trigger}
		type="button"
		{id}
		{disabled}
		aria-haspopup="listbox"
		aria-expanded={popover.open}
		aria-controls={listboxId}
		aria-activedescendant={activeId}
		aria-label={ariaLabel}
		class="{field.input} flex w-full items-center justify-between gap-2 text-left font-medium disabled:cursor-not-allowed disabled:opacity-60 {disabled
			? ''
			: 'cursor-pointer'}"
		onclick={() => (popover.open ? closePanel() : openPanel())}
		onkeydown={onTriggerKeydown}
	>
		<span class="truncate {selectedLabel ? '' : 'text-muted'}">{selectedLabel ?? '—'}</span>
		<Icon
			name="chevron-down"
			size={12}
			weight={2.2}
			class="shrink-0 text-muted transition-transform duration-200 {popover.open
				? 'rotate-180'
				: ''}"
		/>
	</button>
</div>

{#snippet optionRow(option: SelectOption)}
	{@const flatIndex = flat.findIndex((candidate) => candidate.value === option.value)}
	<li
		id="{listboxId}-{option.value}"
		role="option"
		aria-selected={option.value === value}
		class="mx-1.5 flex cursor-pointer items-center justify-between gap-2 rounded-control px-2.5 py-2 text-sm transition-colors {flatIndex ===
			highlighted ? 'bg-surface' : ''}"
		onclick={() => choose(option.value)}
		onmouseenter={() => (highlighted = flatIndex)}
	>
		<span class="truncate">{option.label}</span>
		{#if option.value === value}
			<Icon name="check" size={13} weight={2.4} class="shrink-0 text-accent" />
		{/if}
	</li>
{/snippet}

{#if popover.open}
	<ul
		use:portal
		bind:this={panel}
		id={listboxId}
		role="listbox"
		class="fixed z-50 max-h-70 overflow-y-auto rounded-control border border-subtle bg-surface-raised py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]"
		style="top: {popover.top}px; left: {popover.left}px; width: {popover.width}px;"
		transition:scale={{ start: 0.92, duration: motion(160), easing: backOut }}
	>
		{#each options as item, index (isGroup(item) ? `group-${index}` : item.value)}
			{#if isGroup(item)}
				<li
					class="px-3.25 pt-2.5 pb-1 text-2xs font-semibold tracking-[0.06em] text-muted uppercase"
					role="presentation"
				>
					{item.label}
				</li>
				{#each item.options as option (option.value)}
					{@render optionRow(option)}
				{/each}
			{:else}
				{@render optionRow(item)}
			{/if}
		{/each}
	</ul>
{/if}
```

- [ ] **Step 2: Type-check**

Run (from `app/`): `npx svelte-check --output human`
Expected: 0 new errors/warnings (fix any `Select.svelte`-specific ones before continuing — e.g. if the linter flags the `<li>` option rows, confirm `role="option"` is present, which satisfies the interactive-role rule the same way `role="group"` did for `Tooltip.svelte`).

- [ ] **Step 3: Format**

Run (from `app/`): `npx prettier --write src/lib/components/Select.svelte`

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/components/Select.svelte
git commit -m "feat: rewrite Select as a custom themed listbox with bouncy open animation"
```

Note: this commit temporarily breaks every existing call site (they still pass `<option>` children, which the new `Select` no longer accepts) — Task 5 fixes all of them immediately after. If running `svelte-check` across the whole project at this point shows errors in `goals/+page.svelte`, `GoalDrawer.svelte`, or `TaskDrawer.svelte`, that's expected and resolved in the next task.

---

### Task 5: Update `Select` call sites

**Files:**
- Modify: `app/src/routes/goals/+page.svelte`
- Modify: `app/src/lib/components/GoalDrawer.svelte`
- Modify: `app/src/lib/components/TaskDrawer.svelte`

**Interfaces:**
- Consumes: `Select.svelte`'s `options: SelectItem[]` prop (Task 4).
- Produces: nothing further consumed by later tasks.

- [ ] **Step 1: `goals/+page.svelte` — category filter**

Find:

```svelte
<Select bind:value={categoryFilter} ariaLabel="Filter goals by category" class="mb-7 max-w-55">
	<option value="all">All categories</option>
	{#each data.categories as category (category.id)}
		<option value={String(category.id)}>{category.name}</option>
	{/each}
	<option value="">Uncategorized</option>
</Select>
```

Replace with:

```svelte
<Select
	bind:value={categoryFilter}
	ariaLabel="Filter goals by category"
	class="mb-7 max-w-55"
	options={[
		{ value: 'all', label: 'All categories' },
		...data.categories.map((category) => ({ value: String(category.id), label: category.name })),
		{ value: '', label: 'Uncategorized' }
	]}
/>
```

- [ ] **Step 2: `GoalDrawer.svelte` — category select**

Find:

```svelte
<Select id="goal-category" bind:value={form.categoryId}>
	<option value="">Uncategorized</option>
	{#each categories as category (category.id)}
		<option value={String(category.id)}>{category.name}</option>
	{/each}
</Select>
```

Replace with:

```svelte
<Select
	id="goal-category"
	bind:value={form.categoryId}
	options={[
		{ value: '', label: 'Uncategorized' },
		...categories.map((category) => ({ value: String(category.id), label: category.name }))
	]}
/>
```

- [ ] **Step 3: `TaskDrawer.svelte` — parent select (grouped)**

Add a derived options list near the existing `subgoalsByGoal` derived (after it, in the `<script>` block):

```ts
const parentOptions = $derived.by(() => [
	{ value: '', label: 'Standalone' },
	...goals.map((goal) => ({
		label: goal.title,
		options: [
			{ value: `goal:${goal.id}`, label: `${goal.title} (whole goal)` },
			...(subgoalsByGoal.get(goal.id) ?? []).map((subgoal) => ({
				value: `subgoal:${subgoal.id}`,
				label: `↳ ${subgoal.title}`
			}))
		]
	}))
]);
```

Find:

```svelte
<Select id="task-parent" bind:value={form.parent}>
	<option value="">Standalone</option>
	{#each goals as goal (goal.id)}
		<optgroup label={goal.title}>
			<option value="goal:{goal.id}">{goal.title} (whole goal)</option>
			{#each subgoalsByGoal.get(goal.id) ?? [] as subgoal (subgoal.id)}
				<option value="subgoal:{subgoal.id}">↳ {subgoal.title}</option>
			{/each}
		</optgroup>
	{/each}
</Select>
```

Replace with:

```svelte
<Select id="task-parent" bind:value={form.parent} options={parentOptions} />
```

- [ ] **Step 4: `TaskDrawer.svelte` — recurrence select**

Find:

```svelte
<Select id="task-recurrence" bind:value={form.recurrence}>
	<option value="">Doesn't repeat</option>
	{#each RECURRENCES as recurrence (recurrence)}
		<option value={recurrence}>{RECURRENCE_LABELS[recurrence]}</option>
	{/each}
</Select>
```

Replace with:

```svelte
<Select
	id="task-recurrence"
	bind:value={form.recurrence}
	options={[
		{ value: '', label: "Doesn't repeat" },
		...RECURRENCES.map((recurrence) => ({
			value: recurrence,
			label: RECURRENCE_LABELS[recurrence]
		}))
	]}
/>
```

- [ ] **Step 5: Type-check**

Run (from `app/`): `npx svelte-check --output human`
Expected: 0 errors in these three files (unrelated pre-existing `KanbanBoard.svelte` warnings may remain).

- [ ] **Step 6: Format**

Run (from `app/`): `npx prettier --write src/routes/goals/+page.svelte src/lib/components/GoalDrawer.svelte src/lib/components/TaskDrawer.svelte`

- [ ] **Step 7: Commit**

```bash
git add app/src/routes/goals/+page.svelte app/src/lib/components/GoalDrawer.svelte app/src/lib/components/TaskDrawer.svelte
git commit -m "feat: switch every Select call site to the options-data API"
```

---

### Task 6: Build `DatePicker.svelte`

**Files:**
- Create: `app/src/lib/components/DatePicker.svelte`

**Interfaces:**
- Consumes: `Popover`, `portal`, `isOutside` from `$lib/popover.svelte` (Task 3); `CalendarDay`, `addDays`, `monthGrid`, `monthLabel`, `shiftMonth`, `todayIso` from `$lib/calendarGrid` (Task 1); `formatDate` from `$lib/format` (existing); `field` from `./ui`; `Icon` (existing, `calendar`/`chevron-right`/`close` icons already exist).
- Produces (used by Task 7 call sites): props `{ value: string /* $bindable */, id?: string, ariaLabel?: string, placeholder?: string, disabled?: boolean, class?: string }`.

- [ ] **Step 1: Create the file**

```svelte
<!-- app/src/lib/components/DatePicker.svelte -->
<script lang="ts">
	import { backOut } from 'svelte/easing';
	import { fly, scale } from 'svelte/transition';

	import {
		addDays,
		monthGrid,
		monthLabel,
		shiftMonth,
		todayIso,
		type CalendarDay
	} from '$lib/calendarGrid';
	import { formatDate } from '$lib/format';
	import { motion } from '$lib/motion';
	import { isOutside, Popover, portal } from '$lib/popover.svelte';
	import Icon from './Icon.svelte';
	import { field } from './ui';

	interface Props {
		value: string;
		id?: string;
		ariaLabel?: string;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		value = $bindable(),
		id,
		ariaLabel,
		placeholder = 'Pick a date',
		disabled = false,
		class: className = ''
	}: Props = $props();

	const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
	const today = todayIso();

	const popover = new Popover();

	let root: HTMLElement | undefined = $state();
	let trigger: HTMLElement | undefined = $state();
	let panel: HTMLElement | undefined = $state();

	let viewYear = $state(0);
	let viewMonth = $state(0);
	let activeIso = $state(today);
	let slideDirection = $state(1);

	const grid = $derived(monthGrid(viewYear, viewMonth, value || null, today));
	const heading = $derived(monthLabel(viewYear, viewMonth));

	function baseYearMonth(): { year: number; month: number } {
		const [year, month] = (value || today).split('-').map(Number);
		return { year, month: month - 1 };
	}

	function openPanel() {
		if (disabled || !trigger) return;
		const base = baseYearMonth();
		viewYear = base.year;
		viewMonth = base.month;
		activeIso = value || today;
		popover.show(trigger);
	}

	function closePanel() {
		popover.hide();
	}

	function pickDay(day: CalendarDay) {
		value = day.iso;
		closePanel();
		trigger?.focus();
	}

	function changeMonth(delta: 1 | -1) {
		slideDirection = delta;
		const next = shiftMonth(viewYear, viewMonth, delta);
		viewYear = next.year;
		viewMonth = next.month;
	}

	function goToday() {
		const [year, month] = today.split('-').map(Number);
		viewYear = year;
		viewMonth = month - 1;
		activeIso = today;
	}

	function clearValue() {
		value = '';
	}

	function moveActive(delta: number) {
		const next = addDays(activeIso, delta);
		const [year, month] = next.split('-').map(Number);
		const monthIndex = month - 1;
		if (year !== viewYear || monthIndex !== viewMonth) {
			const before = viewYear * 12 + viewMonth;
			const after = year * 12 + monthIndex;
			slideDirection = after > before ? 1 : -1;
			viewYear = year;
			viewMonth = monthIndex;
		}
		activeIso = next;
	}

	function onTriggerKeydown(event: KeyboardEvent) {
		if (disabled) return;
		if (!popover.open) {
			if (['ArrowDown', 'Enter', ' '].includes(event.key)) {
				event.preventDefault();
				openPanel();
			}
			return;
		}
		switch (event.key) {
			case 'ArrowLeft':
				event.preventDefault();
				moveActive(-1);
				break;
			case 'ArrowRight':
				event.preventDefault();
				moveActive(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				moveActive(-7);
				break;
			case 'ArrowDown':
				event.preventDefault();
				moveActive(7);
				break;
			case 'Enter':
			case ' ': {
				event.preventDefault();
				const match = grid.find((day) => day.iso === activeIso);
				if (match) pickDay(match);
				break;
			}
			case 'Escape':
				event.preventDefault();
				closePanel();
				trigger?.focus();
				break;
		}
	}

	function onWindowMousedown(event: MouseEvent) {
		if (popover.open && isOutside(event, root, panel)) closePanel();
	}
</script>

<svelte:window onmousedown={onWindowMousedown} />

<div class="relative {className}" bind:this={root}>
	<div
		bind:this={trigger}
		role="button"
		tabindex={disabled ? -1 : 0}
		aria-haspopup="dialog"
		aria-expanded={popover.open}
		aria-label={ariaLabel}
		{id}
		aria-disabled={disabled}
		class="{field.input} flex w-full items-center justify-between gap-2 text-left {disabled
			? 'cursor-not-allowed opacity-60'
			: 'cursor-pointer'}"
		onclick={() => {
			if (disabled) return;
			popover.open ? closePanel() : openPanel();
		}}
		onkeydown={onTriggerKeydown}
	>
		<span class="truncate {value ? '' : 'text-muted'}">
			{value ? formatDate(value) : placeholder}
		</span>
		<span class="flex shrink-0 items-center gap-1">
			{#if value}
				<button
					type="button"
					aria-label="Clear date"
					class="rounded-control p-0.5 text-muted transition-colors hover:text-content"
					onclick={(event) => {
						event.stopPropagation();
						clearValue();
					}}
				>
					<Icon name="close" size={12} weight={2.2} />
				</button>
			{/if}
			<Icon name="calendar" size={14} weight={1.8} class="text-muted" />
		</span>
	</div>
</div>

{#if popover.open}
	<div
		use:portal
		bind:this={panel}
		role="dialog"
		aria-label="Choose a date"
		class="fixed z-50 w-70 overflow-hidden rounded-control border border-subtle bg-surface-raised p-3 shadow-[0_16px_40px_rgba(0,0,0,0.3)]"
		style="top: {popover.top}px; left: {popover.left}px;"
		transition:scale={{ start: 0.92, duration: motion(160), easing: backOut }}
	>
		<div class="mb-2 flex items-center justify-between">
			<button
				type="button"
				class="rounded-control p-1 text-muted transition-colors hover:text-content"
				aria-label="Previous month"
				onclick={() => changeMonth(-1)}
			>
				<Icon name="chevron-right" size={13} weight={2.2} class="rotate-180" />
			</button>
			<span class="text-sm font-semibold">{heading}</span>
			<button
				type="button"
				class="rounded-control p-1 text-muted transition-colors hover:text-content"
				aria-label="Next month"
				onclick={() => changeMonth(1)}
			>
				<Icon name="chevron-right" size={13} weight={2.2} />
			</button>
		</div>

		<div class="grid grid-cols-7 gap-y-1 text-center">
			{#each WEEKDAYS as weekday (weekday)}
				<span class="text-2xs font-semibold text-muted">{weekday}</span>
			{/each}
		</div>

		{#key `${viewYear}-${viewMonth}`}
			<div
				class="grid grid-cols-7 gap-y-1 text-center"
				in:fly={{ x: slideDirection * 24, duration: motion(180), easing: backOut }}
				out:fly={{ x: slideDirection * -24, duration: motion(120) }}
			>
				{#each grid as day (day.iso)}
					<button
						type="button"
						class="mx-auto flex size-7.5 items-center justify-center rounded-full text-xs transition-colors
							{day.inCurrentMonth ? 'text-content' : 'text-muted/50'}
							{day.iso === activeIso ? 'ring-2 ring-accent' : ''}
							{day.isSelected ? 'mp-pop bg-accent text-accent-contrast' : 'hover:bg-surface'}
							{day.isToday && !day.isSelected ? 'font-bold text-accent' : ''}"
						onclick={() => pickDay(day)}
					>
						{day.day}
					</button>
				{/each}
			</div>
		{/key}

		<div class="mt-2 flex items-center justify-between border-t border-subtle pt-2">
			<button type="button" class="text-xs font-semibold text-accent" onclick={goToday}>
				Today
			</button>
			{#if value}
				<button
					type="button"
					class="text-xs font-semibold text-muted transition-colors hover:text-content"
					onclick={() => {
						clearValue();
						closePanel();
					}}
				>
					Clear
				</button>
			{/if}
		</div>
	</div>
{/if}
```

- [ ] **Step 2: Type-check**

Run (from `app/`): `npx svelte-check --output human`
Expected: 0 new errors/warnings for `DatePicker.svelte`.

- [ ] **Step 3: Format**

Run (from `app/`): `npx prettier --write src/lib/components/DatePicker.svelte`

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/components/DatePicker.svelte
git commit -m "feat: add custom DatePicker with animated calendar popover"
```

---

### Task 7: Replace native date inputs with `DatePicker`

**Files:**
- Modify: `app/src/lib/components/GoalDrawer.svelte`
- Modify: `app/src/lib/components/TaskDrawer.svelte`
- Modify: `app/src/routes/goals/[id]/+page.svelte`

**Interfaces:**
- Consumes: `DatePicker.svelte`'s props (Task 6).
- Produces: nothing further consumed by later tasks.

- [ ] **Step 1: `GoalDrawer.svelte`**

Add the import alongside the existing `Select` import:

```ts
import DatePicker from './DatePicker.svelte';
```

Find:

```svelte
<input id="goal-due" type="date" class={field.input} bind:value={form.dueDate} />
```

Replace with:

```svelte
<DatePicker id="goal-due" bind:value={form.dueDate} class={field.input} />
```

- [ ] **Step 2: `TaskDrawer.svelte`**

Add the import alongside the existing `Select` import:

```ts
import DatePicker from './DatePicker.svelte';
```

Find:

```svelte
<input id="task-due" type="date" class={field.input} bind:value={form.dueDate} />
```

Replace with:

```svelte
<DatePicker id="task-due" bind:value={form.dueDate} class={field.input} />
```

- [ ] **Step 3: `goals/[id]/+page.svelte`**

Add the import alongside the existing component imports:

```ts
import DatePicker from '$lib/components/DatePicker.svelte';
```

Find:

```svelte
<input
	type="date"
	class="{field.dashed} w-37.5 shrink-0"
	bind:value={newSubgoalDue}
	aria-label="New subgoal due date"
/>
```

Replace with:

```svelte
<DatePicker
	bind:value={newSubgoalDue}
	ariaLabel="New subgoal due date"
	class="{field.dashed} w-37.5 shrink-0"
/>
```

- [ ] **Step 4: Type-check**

Run (from `app/`): `npx svelte-check --output human`
Expected: 0 errors in these three files.

- [ ] **Step 5: Format**

Run (from `app/`): `npx prettier --write src/lib/components/GoalDrawer.svelte src/lib/components/TaskDrawer.svelte "src/routes/goals/[id]/+page.svelte"`

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/components/GoalDrawer.svelte app/src/lib/components/TaskDrawer.svelte "app/src/routes/goals/[id]/+page.svelte"
git commit -m "feat: switch every due-date input to the custom DatePicker"
```

---

### Task 8: Full-project verification and TODO cleanup

**Files:**
- Modify: `TODO.md`

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: nothing (terminal task).

- [ ] **Step 1: Run the full unit test suite**

Run (from `app/`): `npx vitest run`
Expected: PASS, including the 16 new tests from Tasks 1–2 alongside every pre-existing test.

- [ ] **Step 2: Run svelte-check across the whole project**

Run (from `app/`): `npx svelte-check --output human`
Expected: 0 errors; only the two pre-existing `KanbanBoard.svelte` drag-handler warnings remain.

- [ ] **Step 3: Manual smoke test**

Start the app with the real backend (data loading needs Tauri): `npm run tauri dev` (from `app/`). Then:
- Open the New Goal drawer: exercise the category `Select` (mouse and keyboard — arrows, Enter, Escape) and the due-date `DatePicker` (open, navigate months both directions, pick a day, clear it, reopen and confirm it re-centers on the current value).
- Open the New Task drawer: confirm the parent picker still shows goals as group headers with subgoals nested and indented under them, and the recurrence picker works.
- On a goal detail page, open the inline "new subgoal" due-date `DatePicker` and confirm it isn't clipped (this field sits in a plain page section, but also spot-check a `DatePicker`/`Select` opened near the bottom of a drawer's scroll area to confirm the portal keeps the panel fully visible).
- Confirm both themes (Nocturne/Coquette, toggle in the sidebar) render the panels correctly.

- [ ] **Step 4: Update `TODO.md`**

Find:

```markdown
# Todos

- Select and date inputs need to be made custon
```

Replace with:

```markdown
# Todos
```

- [ ] **Step 5: Commit**

```bash
git add TODO.md
git commit -m "chore: mark select/date-picker custom-component work done"
```

---

## Self-Review Notes

- **Spec coverage:** shared popover plumbing (Task 3), `Select` rewrite + grouped options (Task 4–5), `DatePicker` with month-slide/day-pop animation (Task 6–7), all four `Select` call sites and all three date-input call sites are each their own step, manual clipping/theme verification (Task 8). Nothing in the spec's in-scope sections is unaddressed; the spec's "Out of scope" items (typed entry, multi-select, ranges, min/max, touching `Tooltip.svelte`) are correspondingly absent from every task.
- **Type consistency:** `SelectItem`/`SelectOption`/`SelectGroup` (Task 2) are the exact names imported in Task 4 and used in Task 5's inline arrays; `CalendarDay`/`monthGrid`/`monthLabel`/`shiftMonth`/`addDays`/`todayIso` (Task 1) are the exact names imported in Task 6; `Popover`/`portal`/`isOutside` (Task 3) are used identically in Tasks 4 and 6.
- **No placeholders:** every step ships complete, runnable code — no "similar to Task N" references, no TODO markers.
