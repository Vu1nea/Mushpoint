<script lang="ts">
	import { tick } from 'svelte';
	import { updateSubgoal, type Subgoal } from '$lib/api';
	import DatePicker from './DatePicker.svelte';
	import FormModal from './FormModal.svelte';
	import Icon from './Icon.svelte';
	import { field } from './ui';

	interface Props {
		subgoal: Subgoal | null;
		onClose: () => void;
		onSaved: () => Promise<void> | void;
	}

	let { subgoal, onClose, onSaved }: Props = $props();

	let submitting = $state(false);
	let error = $state<unknown>(null);
	let titleMissing = $state(false);
	let form = $state({ title: '', dueDate: '' });

	$effect(() => {
		if (!subgoal) return;
		error = null;
		titleMissing = false;
		form = { title: subgoal.title, dueDate: subgoal.dueDate ?? '' };
	});

	async function submit() {
		if (!subgoal) return;
		if (!form.title.trim()) {
			titleMissing = true;
			// After render, so the field is read with its error message.
			tick().then(() => document.getElementById('subgoal-title')?.focus());
			return;
		}

		submitting = true;
		error = null;
		try {
			await updateSubgoal(subgoal.id, {
				title: form.title.trim(),
				dueDate: form.dueDate || null,
				isComplete: subgoal.isComplete
			});
			await onSaved();
			onClose();
		} catch (failure) {
			error = failure;
		} finally {
			submitting = false;
		}
	}
</script>

<FormModal
	open={subgoal !== null}
	title="Edit Subgoal"
	submitLabel="Save"
	{submitting}
	{error}
	{onClose}
	onSubmit={submit}
>
	<div>
		<label class={field.label} for="subgoal-title">Title</label>
		<input
			id="subgoal-title"
			class="{field.input} {titleMissing ? 'border-warn' : ''}"
			bind:value={form.title}
			oninput={() => (titleMissing = false)}
			aria-invalid={titleMissing}
			aria-describedby={titleMissing ? 'subgoal-title-error' : undefined}
		/>
		{#if titleMissing}
			<p id="subgoal-title-error" class="mt-1.5 flex items-center gap-1.5 text-xs text-warn">
				<Icon name="warning" size={13} weight={2} /> Title is required
			</p>
		{/if}
	</div>

	<div>
		<label class={field.label} for="subgoal-due">Due date (optional)</label>
		<DatePicker id="subgoal-due" bind:value={form.dueDate} />
	</div>
</FormModal>
