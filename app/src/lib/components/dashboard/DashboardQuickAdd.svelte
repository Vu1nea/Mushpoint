<script lang="ts">
	import { createIdea, createTask } from '$lib/api';
	import Icon from '../ui/Icon.svelte';
	import Spinner from '../ui/Spinner.svelte';
	import { field, segment } from '../ui';

	/** No goals here: a goal-sized thought starts as an idea and is promoted
	 * once its timeframe, category and motivation are worked out. */
	type QuickAddKind = 'idea' | 'task';

	interface Props {
		onAdded: () => Promise<void> | void;
		onError: (error: unknown) => void;
		class?: string;
		/** Stack the controls, for narrow containers such as the mobile sheet. */
		stacked?: boolean;
	}

	let { onAdded, onError, class: className = '', stacked = false }: Props = $props();

	const KINDS: { value: QuickAddKind; label: string; icon: QuickAddKind }[] = [
		{ value: 'idea', label: 'Idea', icon: 'idea' },
		{ value: 'task', label: 'Task', icon: 'task' }
	];

	/** Outlined, so the page keeps one filled button (New goal). */
	const addButton =
		'inline-flex items-center justify-center gap-1.5 rounded-control border border-accent-ink bg-transparent px-4.5 py-2.75 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-ink/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

	let kind = $state<QuickAddKind>('idea');
	let title = $state('');
	let submitting = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const value = title.trim();
		if (!value || submitting) return;

		submitting = true;
		try {
			if (kind === 'idea') {
				await createIdea({ title: value, note: null, tagNames: [] });
			} else {
				await createTask({
					title: value,
					dueDate: null,
					goalId: null,
					subgoalId: null,
					recurrence: null
				});
			}
			title = '';
			await onAdded();
		} catch (error) {
			onError(error);
		} finally {
			submitting = false;
		}
	}
</script>

<form
	onsubmit={submit}
	class="flex gap-2 {stacked ? 'flex-col items-stretch' : 'items-center'} {className}"
>
	<div
		class="flex gap-1.5 {stacked ? 'w-full' : 'shrink-0'}"
		role="group"
		aria-label="Quick-add type"
	>
		{#each KINDS as option (option.value)}
			<button
				type="button"
				class={segment(kind === option.value)}
				aria-pressed={kind === option.value}
				onclick={() => (kind = option.value)}
			>
				<span class="flex items-center justify-center gap-1">
					<Icon name={option.icon} size={12} />
					{option.label}
				</span>
			</button>
		{/each}
	</div>

	<input
		type="text"
		bind:value={title}
		placeholder={kind === 'idea' ? 'Quick-add an idea…' : 'Quick-add a task…'}
		aria-label="Quick-add title"
		disabled={submitting}
		class={field.input}
	/>

	<button
		type="submit"
		class={addButton}
		disabled={submitting || !title.trim()}
		aria-busy={submitting}
	>
		<!-- The spinner takes the plus icon's place, so the button doesn't grow. -->
		{#if submitting}
			<Spinner size={15} />
		{:else}
			<Icon name="plus" size={15} weight={2.4} />
		{/if}
		{submitting ? 'Adding…' : 'Add'}
	</button>
</form>
