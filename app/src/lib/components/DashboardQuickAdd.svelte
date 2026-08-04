<script lang="ts">
	import { createGoal, createIdea, createTask } from '$lib/api';
	import Icon from './Icon.svelte';
	import { button, field, segment } from './ui';

	type QuickAddKind = 'idea' | 'task' | 'goal';

	interface Props {
		onAdded: () => Promise<void> | void;
		onError: (error: unknown) => void;
		class?: string;
	}

	let { onAdded, onError, class: className = '' }: Props = $props();

	const KINDS: { value: QuickAddKind; label: string; icon: 'idea' | 'task' | 'goal' }[] = [
		{ value: 'idea', label: 'Idea', icon: 'idea' },
		{ value: 'task', label: 'Task', icon: 'task' },
		{ value: 'goal', label: 'Goal', icon: 'goal' }
	];

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
			} else if (kind === 'task') {
				await createTask({ title: value, dueDate: null, goalId: null, subgoalId: null, recurrence: null });
			} else {
				await createGoal({
					categoryId: null,
					title: value,
					description: null,
					timeframe: 'short',
					dueDate: null,
					motivationText: null,
					motivationImagePath: null,
					repoUrl: null
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
	class="flex flex-col items-stretch gap-3 rounded-card border border-subtle bg-surface p-3.5 sm:flex-row sm:items-center {className}"
>
	<div class="flex w-full shrink-0 gap-1.5 sm:w-auto" role="group" aria-label="Quick-add type">
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
		placeholder="Quick-add a {kind}…"
		aria-label="Quick-add title"
		disabled={submitting}
		class={field.input}
	/>

	<button type="submit" class={button.primary} disabled={submitting || !title.trim()}>
		<Icon name="plus" size={15} weight={2.4} />
		Add
	</button>
</form>
