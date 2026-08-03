<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';

	import { GOAL_STATUS_LABELS, GOAL_STATUSES, setGoalStatus, type GoalStatus } from '$lib/api';
	import { motion } from '$lib/motion';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import GoalCompleteCelebration from './GoalCompleteCelebration.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		goalId: number;
		title: string;
		status: GoalStatus;
		/** 0–1 ratio; drives a nudge toward Completed, never an auto-transition —
		 * the user still decides when a goal is actually done. */
		progress: number;
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
	}

	let { goalId, title, status, progress, onMutated, onError }: Props = $props();

	/** Optimistic local value; resyncs whenever the committed status changes
	 * underneath us (e.g. navigating to a different goal). */
	let current = $state(untrack(() => status));
	$effect(() => {
		current = status;
	});

	let saved = $state(false);
	let savedTimer: ReturnType<typeof setTimeout> | undefined;
	let buttons: (HTMLButtonElement | null)[] = [];
	let confirmingArchive = $state(false);
	let celebrating = $state(false);

	/** Guards against an in-flight save resolving after a newer click has
	 * already moved the selection on. */
	let requestId = 0;

	const index = $derived(GOAL_STATUSES.indexOf(current));
	/** Progress hit 100% but the goal isn't marked Completed yet — suggest it,
	 * don't force it (a goal can sit at 100% on purpose, or the user may not
	 * be ready to close it out). */
	const suggestComplete = $derived(progress >= 1 && current !== 'completed');

	/** The pill's fill; label text pairs whichever contrast reads against it. */
	const PILL: Record<GoalStatus, string> = {
		active: 'bg-accent',
		completed: 'bg-accent-secondary',
		archived: 'bg-surface-raised'
	};
	const LABEL: Record<GoalStatus, string> = {
		active: 'text-accent-contrast',
		completed: 'text-accent-contrast',
		archived: 'text-content'
	};

	/** Archiving asks first; active/completed apply immediately. Going to
	 * completed is still instant — the celebration lands after the save, not
	 * as a gate before it. */
	function select(next: GoalStatus) {
		if (next === current) return;
		if (next === 'archived') {
			confirmingArchive = true;
			return;
		}
		apply(next);
	}

	async function apply(next: GoalStatus) {
		const previous = current;
		current = next;
		const id = ++requestId;
		clearTimeout(savedTimer);
		saved = false;
		try {
			await setGoalStatus(goalId, next);
			if (id !== requestId) return;
			saved = true;
			savedTimer = setTimeout(() => (saved = false), 1500);
			if (next === 'completed') celebrating = true;
			await onMutated();
		} catch (error) {
			if (id !== requestId) return;
			current = previous;
			onError(error);
		}
	}

	function confirmArchive() {
		confirmingArchive = false;
		apply('archived');
	}

	function onKeydown(event: KeyboardEvent) {
		let delta = 0;
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') delta = 1;
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') delta = -1;
		else return;

		event.preventDefault();
		const next = GOAL_STATUSES[(index + delta + GOAL_STATUSES.length) % GOAL_STATUSES.length];
		select(next);
		buttons[GOAL_STATUSES.indexOf(next)]?.focus();
	}
</script>

<div class="flex items-center gap-2">
	<div
		role="radiogroup"
		aria-label="Goal status"
		tabindex="-1"
		class="relative flex flex-1 rounded-control bg-track p-1"
		onkeydown={onKeydown}
	>
		<span
			class="pointer-events-none absolute inset-y-1 left-1 rounded-[7px] {PILL[current]}"
			style="width:calc((100% - 0.5rem) / 3); transform:translateX(calc({index} * 100%));
				transition: transform var(--mp-duration-base) cubic-bezier(0.34, 1.2, 0.64, 1),
				background-color var(--mp-duration-base) var(--mp-ease-out);"
			aria-hidden="true"
		></span>
		{#each GOAL_STATUSES as s, i (s)}
			<button
				bind:this={buttons[i]}
				type="button"
				role="radio"
				aria-checked={current === s}
				tabindex={current === s ? 0 : -1}
				class="relative z-10 flex flex-1 items-center justify-center rounded-[7px] px-2 py-1.75 text-xs transition-transform active:scale-95 motion-reduce:active:scale-100 {current ===
				s
					? `font-semibold ${LABEL[s]}`
					: 'text-muted transition-colors hover:text-content'} {s === 'completed' && suggestComplete
					? 'mp-pulse ring-1 ring-accent-secondary/70'
					: ''}"
				style="transition-duration: var(--mp-duration-fast)"
				title={s === 'completed' && suggestComplete
					? 'Every subgoal and task is done — mark the goal Completed?'
					: undefined}
				onclick={() => select(s)}
			>
				{GOAL_STATUS_LABELS[s]}
				{#if s === 'completed' && current === 'completed'}
					<span
						class="mp-pop absolute -top-1 -right-1 z-20 grid size-3.5 place-items-center rounded-full bg-accent-secondary text-accent-contrast"
						aria-hidden="true"
					>
						<Icon name="check" size={8} weight={3} />
					</span>
				{:else if s === 'completed' && suggestComplete}
					<span
						class="mp-pop absolute -top-1 -right-1 z-20 size-2.5 rounded-full bg-accent-secondary"
						aria-hidden="true"
					></span>
				{/if}
			</button>
		{/each}
	</div>
	{#if saved}
		<span
			class="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold text-accent-secondary"
			out:fade={{ duration: motion(250) }}
		>
			<Icon name="check" size={10} weight={3} /> Saved
		</span>
	{/if}
</div>

<ConfirmDialog
	open={confirmingArchive}
	title="Archive “{title}”?"
	body="It stays around, dimmed, and drops out of the active list. You can switch it back anytime."
	confirmLabel="Archive"
	onConfirm={confirmArchive}
	onCancel={() => (confirmingArchive = false)}
/>

<GoalCompleteCelebration open={celebrating} {title} onClose={() => (celebrating = false)} />
