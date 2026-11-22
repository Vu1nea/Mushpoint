<script lang="ts">
	import { setTaskCompletion, setTaskStatus, type TaskSummary } from '$lib/api';
	import { optimistic } from '$lib/optimistic';
	import Checkbox from '../ui/Checkbox.svelte';

	interface Props {
		task: TaskSummary;
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		/** Reports the tick as the user sees it, so the row can restyle at once. */
		onDone?: (done: boolean) => void;
	}

	let { task, onMutated, onError, onDone }: Props = $props();

	/** A habit has no lasting status: ticking it logs today's completion instead
	 * of writing `status = 'done'`, so it stays in sync with the board and streaks. */
	const serverDone = $derived(task.recurrence ? task.completedToday : task.status === 'done');

	/** The tick as the user just set it, shown until fresh data arrives. */
	let pendingDone = $state<boolean | null>(null);
	const done = $derived(pendingDone ?? serverDone);

	$effect(() => onDone?.(done));

	function toggle(checked: boolean) {
		return optimistic<unknown>({
			key: `task:${task.id}`,
			apply: () => (pendingDone = checked),
			revert: () => (pendingDone = null),
			call: () =>
				task.recurrence
					? setTaskCompletion(task.id, checked)
					: setTaskStatus(task.id, checked ? 'done' : 'todo'),
			refresh: async () => {
				await onMutated();
			},
			onError,
			settle: () => (pendingDone = null)
		});
	}
</script>

<Checkbox checked={done} label="Mark {task.title} done" onchange={toggle} />
