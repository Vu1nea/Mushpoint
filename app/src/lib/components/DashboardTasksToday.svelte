<script lang="ts">
	import type { TaskSummary } from '$lib/api';
	import { todaysTasks } from '$lib/dashboard';
	import TaskRow from './TaskRow.svelte';
	import { sectionHeading } from './ui';

	interface Props {
		tasks: TaskSummary[];
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		class?: string;
	}

	let { tasks, onMutated, onError, class: className = '' }: Props = $props();

	const today = $derived(todaysTasks(tasks));
</script>

<section class="flex min-h-0 flex-col overflow-y-auto rounded-card border border-subtle bg-surface p-4.5 {className}">
	<h2 class="{sectionHeading} mb-3">Today's tasks</h2>

	{#if today.length === 0}
		<p class="flex-1 py-8 text-center text-md text-muted">Nothing due today.</p>
	{:else}
		<ul class="flex flex-col gap-0.5">
			{#each today as task (task.id)}
				<TaskRow {task} {onMutated} {onError} />
			{/each}
		</ul>
	{/if}
</section>
