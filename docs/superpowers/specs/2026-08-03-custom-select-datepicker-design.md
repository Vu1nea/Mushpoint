# Custom Select & Date Picker — Design

## Goal

Replace the native `<select>` (already wrapped by `Select.svelte`, just styled
around the native element) and every native `<input type="date">` with fully
custom components that match the app's theme and carry the same "personality"
the rest of the UI has picked up (bouncy, `backOut`-eased pop-ins), rather than
native browser chrome with a coat of paint on top.

Two components: `Select.svelte` (rewritten in place) and a new
`DatePicker.svelte`. Both open a floating panel positioned off the trigger's
`getBoundingClientRect()`, portaled to `<body>`, so they escape any
`overflow-hidden` ancestor (cards, the sidebar, drawers) the same way
`Tooltip.svelte` already does. That shared mechanics piece is factored into
`app/src/lib/popover.svelte.ts` so it exists once, not twice.

`Tooltip.svelte` is not touched — it's hover-driven and already working;
duplicating its couple of lines of positioning code once more isn't worth
retrofitting a shared helper onto code that isn't changing.

## Shared plumbing — `app/src/lib/popover.svelte.ts`

A small rune-based class, constructed once per component instance:

```ts
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
```

Plus a `portal(node)` action (reparents to `document.body`, removes on
destroy — identical to the one already in `Tooltip.svelte`) and a
`outsideClick(node, onOutside)` action that adds a capture-phase
`window` `mousedown` listener while mounted and calls back when the click
target is outside `node`. Consuming components wire `Escape` themselves via
`<svelte:window onkeydown={...}>` since both need slightly different
close-then-refocus behavior.

Like `Tooltip`, position is computed once on open; a scroll/resize while open
closes the panel rather than tracking position live (same trade-off already
made for tooltips — stale coordinates are worse than a closed panel).

## `Select.svelte`

### Props

```ts
interface SelectOption {
	value: string;
	label: string;
}
interface SelectGroup {
	label: string;
	options: SelectOption[];
}
type SelectItem = SelectOption | SelectGroup;

interface Props {
	value: string; // $bindable
	options: SelectItem[];
	id?: string;
	ariaLabel?: string;
	disabled?: boolean;
	class?: string;
}
```

A flat list is `SelectOption[]`; the task-parent picker (which needs a lone
"Standalone" option followed by one group per goal, subgoals nested under it)
is expressed as `[{value:'',label:'Standalone'}, {label: goal.title, options: [...]}, ...]`.
Groups are one level deep only — matches every current use.

### Markup / behavior

- Trigger: `<button id aria-haspopup="listbox" aria-expanded aria-label>`,
  same `field.input`-family classes callers already pass via `class`. Shows
  the selected option's `label` (flattened lookup over `options`), or a muted
  em dash if `value` matches nothing. Chevron (`chevron-down`) rotates 180°
  on open via a CSS transition.
- Panel: `role="listbox"`, portaled + fixed-positioned per above. Group
  headers render as a non-interactive small uppercase muted row
  (`role="presentation"`); options render as `role="option"` buttons with
  `aria-selected` and a check glyph on the current value.
- Open transition: `scale` + `fade` from `svelte/transition`, `easing:
backOut` from `svelte/easing`, duration via `motion(180)`.
- Keyboard on the trigger: `ArrowDown`/`ArrowUp` opens (if closed) or moves
  the highlighted index; `Enter`/`Space` selects the highlighted option and
  closes, refocusing the trigger; `Escape` closes and refocuses. Highlight
  index walks the flattened option list, skipping group headers.
- Click outside or window scroll/resize closes the panel without changing
  `value`.
- Disabled state matches the current look (`opacity-60`,
  `cursor-not-allowed`).

Out of scope: typeahead-by-letter, multi-select, nested groups deeper than
one level.

## `DatePicker.svelte` (new)

### Props

```ts
interface Props {
	value: string; // $bindable, ISO yyyy-mm-dd or ''
	id?: string;
	ariaLabel?: string;
	placeholder?: string; // default "Pick a date"
	disabled?: boolean;
	class?: string;
}
```

No typed entry — calendar-only, per the earlier decision.

### Markup / behavior

- Trigger: button styled like `Select`'s, showing `formatDate(value)` (from
  `$lib/format`, already used everywhere else for due dates) or the
  placeholder in muted text. `calendar` icon on the right; when `value` is
  set, a small `×` (`close` icon) appears before the calendar icon to clear
  the field without opening the panel (`stopPropagation` on its click).
- Panel: portaled + fixed, same open transition as `Select`
  (scale+fade, `backOut`, `motion(180)`).
  - Header: prev/next chevrons (`chevron-right`, one rotated 180°) around a
    "Month YYYY" label.
  - Weekday row (`Su Mo Tu We Th Fr Sa`), muted, non-interactive.
  - 6×7 day grid. Leading/trailing days from adjacent months render muted
    but are still clickable (clicking one navigates the visible month and
    selects that day — standard calendar UX, avoids dead cells at the grid
    edges).
  - Today gets a subtle ring; the selected day gets an accent fill and plays
    the existing `mp-pop` animation class (from `theme.css`) when it becomes
    selected.
  - Footer: "Today" and "Clear" text buttons (Clear only shown when `value`
    is set).
  - Changing month re-keys the grid container (`{#key year-month}`) so a
    `fly` transition (`x: dir * 24`, fade, `backOut`) slides it in the
    direction of navigation — the one deliberately flashier flourish beyond
    the shared open/close pop.
- Keyboard: with the panel open, arrow keys move a single roving-tabindex
  "active day" — Left/Right ±1 day, Up/Down ±7 days; crossing a month
  boundary updates the visible month and refocuses the new active cell.
  `Enter`/`Space` selects the active day and closes, refocusing the trigger.
  `Escape` closes without selecting.

Out of scope: typed entry, date ranges, min/max constraints, `Home`/`End`/
`PageUp`/`PageDown` shortcuts.

## Call sites updated

- `app/src/routes/goals/+page.svelte` — category filter `Select` → `options`
  array (`all` / each category / `''` Uncategorized).
- `app/src/lib/components/GoalDrawer.svelte` — category `Select` → `options`
  array (`''` Uncategorized / each category); due-date `<input type=date>` →
  `<DatePicker>`.
- `app/src/lib/components/TaskDrawer.svelte` — parent `Select` → grouped
  `options` (Standalone + one group per goal, subgoals nested); recurrence
  `Select` → flat `options`; due-date `<input type=date>` → `<DatePicker>`.
- `app/src/routes/goals/[id]/+page.svelte` — new-subgoal due-date
  `<input type=date>` → `<DatePicker>`.

## Testing

No backend/data changes, so no Rust/repo-layer tests. Verify by hand once
built (`npm run tauri dev`, since data loading needs the Tauri backend):
open each drawer, exercise both components with mouse and keyboard, confirm
grouped options render correctly in the task-parent picker, confirm the
calendar's month-slide and day-pop animations, confirm dropdowns opened near
a drawer's bottom edge aren't clipped. `svelte-check` must stay clean.

## Out of scope

- Typed/manual date entry
- Multi-select
- Date ranges or min/max constraints
- Touching `Tooltip.svelte`'s existing (separate) positioning code
