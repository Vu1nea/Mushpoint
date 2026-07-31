<script lang="ts">
	import {
		createGoal,
		TIMEFRAME_LABELS,
		TIMEFRAMES,
		updateGoal,
		type Category,
		type Goal,
		type Timeframe
	} from '$lib/api';
	import Drawer from './Drawer.svelte';
	import Icon from './Icon.svelte';
	import Select from './Select.svelte';
	import { field, segment } from './ui';

	interface Props {
		open: boolean;
		categories: Category[];
		/** Null creates a goal; a goal edits it in place. */
		goal?: Goal | null;
		onClose: () => void;
		/** Called after a successful save, before the drawer closes. */
		onSaved: () => Promise<void> | void;
	}

	let { open, categories, goal = null, onClose, onSaved }: Props = $props();

	let submitting = $state(false);
	let error = $state<unknown>(null);
	let titleMissing = $state(false);
	let shake = $state(false);

	let form = $state({
		title: '',
		categoryId: '',
		timeframe: 'short' as Timeframe,
		motivationText: '',
		description: '',
		dueDate: ''
	});

	// Each opening starts from the record being edited, or from a blank goal.
	$effect(() => {
		if (!open) return;
		error = null;
		titleMissing = false;
		form = {
			title: goal?.title ?? '',
			categoryId: goal?.categoryId ? String(goal.categoryId) : '',
			timeframe: goal?.timeframe ?? 'short',
			motivationText: goal?.motivationText ?? '',
			description: goal?.description ?? '',
			dueDate: goal?.dueDate ?? ''
		};
	});

	async function submit() {
		if (!form.title.trim()) {
			titleMissing = true;
			shake = true;
			return;
		}

		submitting = true;
		error = null;
		const input = {
			categoryId: form.categoryId ? Number(form.categoryId) : null,
			title: form.title.trim(),
			description: form.description.trim() || null,
			timeframe: form.timeframe,
			dueDate: form.dueDate || null,
			motivationText: form.motivationText.trim() || null,
			motivationImagePath: goal?.motivationImagePath ?? null
		};

		try {
			await (goal ? updateGoal(goal.id, input) : createGoal(input));
			await onSaved();
			onClose();
		} catch (failure) {
			error = failure;
		} finally {
			submitting = false;
		}
	}
</script>

<Drawer
	{open}
	title={goal ? 'Edit Goal' : 'New Goal'}
	submitLabel={goal ? 'Save' : 'Create'}
	{submitting}
	{error}
	{onClose}
	onSubmit={submit}
>
	<div>
		<label class={field.label} for="goal-title">Title</label>
		<input
			id="goal-title"
			class="{field.input} {titleMissing ? 'border-warn' : ''} {shake ? 'mp-shake' : ''}"
			bind:value={form.title}
			oninput={() => (titleMissing = false)}
			onanimationend={() => (shake = false)}
			placeholder="Give it a name…"
			aria-invalid={titleMissing}
		/>
		{#if titleMissing}
			<p class="mt-1.5 flex items-center gap-1.5 text-xs text-warn">
				<Icon name="warning" size={13} weight={2} /> Title is required
			</p>
		{/if}
	</div>

	<div>
		<label class={field.label} for="goal-category">Category</label>
		<Select id="goal-category" bind:value={form.categoryId}>
			<option value="">Uncategorized</option>
			{#each categories as category (category.id)}
				<option value={String(category.id)}>{category.name}</option>
			{/each}
		</Select>
	</div>

	<fieldset>
		<legend class={field.label}>Timeframe</legend>
		<div class="flex gap-2">
			{#each TIMEFRAMES as option (option)}
				<button
					type="button"
					class={segment(form.timeframe === option)}
					aria-pressed={form.timeframe === option}
					onclick={() => (form.timeframe = option)}
				>
					{TIMEFRAME_LABELS[option]}
				</button>
			{/each}
		</div>
	</fieldset>

	<div>
		<label class={field.label} for="goal-motivation">Motivation</label>
		<textarea
			id="goal-motivation"
			class="{field.input} resize-y"
			rows="3"
			bind:value={form.motivationText}
			placeholder="Why this goal matters…"
		></textarea>
	</div>

	<div>
		<label class={field.label} for="goal-description">Description (optional)</label>
		<textarea
			id="goal-description"
			class="{field.input} resize-y"
			rows="2"
			bind:value={form.description}
			placeholder="What finishing looks like…"
		></textarea>
	</div>

	<div>
		<label class={field.label} for="goal-due">Due date (optional)</label>
		<input id="goal-due" type="date" class={field.input} bind:value={form.dueDate} />
	</div>
</Drawer>
