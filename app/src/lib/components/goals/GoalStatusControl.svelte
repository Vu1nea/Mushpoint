<script lang="ts">
	import { untrack } from 'svelte';

	import { setGoalStatus, type GoalStatus } from '$lib/api';
	import { optimistic } from '$lib/optimistic';
	import RowMenu from 'mushpoint-design/svelte/RowMenu.svelte';
	import ConfirmDialog from '../ui/ConfirmDialog.svelte';
	import GoalCompleteCelebration from './GoalCompleteCelebration.svelte';
	import Icon from '../ui/Icon.svelte';

	interface Props {
		goalId: number;
		title: string;
		status: GoalStatus;
		/** 0–1 ratio; drives a nudge toward Completed, never an auto-transition —
		 * the user still decides when a goal is actually done. */
		progress: number;
		onEdit: () => void;
		onDelete: () => void;
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
	}

	let { goalId, title, status, progress, onEdit, onDelete, onMutated, onError }: Props = $props();

	/** Optimistic local value; resyncs whenever the committed status changes
	 * underneath us (e.g. navigating to a different goal). */
	let current = $state(untrack(() => status));
	$effect(() => {
		current = status;
	});

	let confirmingArchive = $state(false);
	let celebrating = $state(false);
	/** True for a moment after the tick lands, to play the pop. */
	let popping = $state(false);
	let popTimer: ReturnType<typeof setTimeout> | undefined;

	const done = $derived(current === 'completed');
	/** Progress hit 100% but the goal isn't marked Completed yet — suggest it,
	 * don't force it (a goal can sit at 100% on purpose). */
	const suggestComplete = $derived(progress >= 1 && !done);

	function apply(next: GoalStatus) {
		const previous = current;
		if (next === 'completed') {
			popping = true;
			clearTimeout(popTimer);
			popTimer = setTimeout(() => (popping = false), 600);
		}
		return optimistic({
			key: `goal-status:${goalId}`,
			apply: () => (current = next),
			revert: () => (current = previous),
			call: () => setGoalStatus(goalId, next),
			refresh: async () => {
				await onMutated();
			},
			// Only runs when the call succeeded and is still the latest, so the
			// celebration never fires for a save that was rolled back.
			settle: () => {
				if (next === 'completed') celebrating = true;
			},
			onError
		});
	}

	function toggleDone() {
		apply(done ? 'active' : 'completed');
	}

	function confirmArchive() {
		confirmingArchive = false;
		apply('archived');
	}

	const items = $derived([
		{ label: 'Edit', icon: 'edit' as const, onSelect: onEdit },
		current === 'archived'
			? { label: 'Unarchive', onSelect: () => apply('active') }
			: { label: 'Archive', onSelect: () => (confirmingArchive = true) },
		{ label: 'Delete', icon: 'trash' as const, danger: true, onSelect: onDelete }
	]);
</script>

<div class="flex items-center gap-1">
	<button
		type="button"
		aria-pressed={done}
		aria-label={done ? 'Mark goal not complete' : 'Mark goal complete'}
		title={suggestComplete ? 'Every subgoal and task is done — mark the goal complete?' : undefined}
		class="mp-hit inline-flex size-8 items-center justify-center rounded-full border transition-[background-color,border-color,color,transform] duration-(--mp-duration-base) ease-(--mp-ease-out) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-90 motion-reduce:active:scale-100 {done
			? 'border-green-400 bg-green-400 text-accent-contrast'
			: 'border-subtle text-muted hover:border-green-400 hover:text-green-400'} {popping
			? 'mp-pulse'
			: ''} {suggestComplete ? 'mp-pulse border-green-400 text-green-400' : ''}"
		onclick={toggleDone}
	>
		<span class={popping ? 'mp-pop' : ''}>
			<Icon name="check" size={14} weight={done ? 3 : 2.4} />
		</span>
	</button>

	<RowMenu label="Goal settings" {items} />
</div>

<ConfirmDialog
	open={confirmingArchive}
	title="Archive “{title}”?"
	body="It stays around, dimmed, and drops out of the active list. You can unarchive it anytime."
	confirmLabel="Archive"
	onConfirm={confirmArchive}
	onCancel={() => (confirmingArchive = false)}
/>

<GoalCompleteCelebration open={celebrating} {title} onClose={() => (celebrating = false)} />
