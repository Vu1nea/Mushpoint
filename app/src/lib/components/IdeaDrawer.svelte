<!-- app/src/lib/components/IdeaDrawer.svelte -->
<script lang="ts">
	import { createIdea, updateIdea, type Idea } from '$lib/api';
	import Drawer from './Drawer.svelte';
	import Icon from './Icon.svelte';
	import TagInput from './TagInput.svelte';
	import { field } from './ui';

	interface Props {
		open: boolean;
		/** Null creates an idea; an idea edits it in place. */
		idea?: Idea | null;
		onClose: () => void;
		onSaved: () => Promise<void> | void;
	}

	let { open, idea = null, onClose, onSaved }: Props = $props();

	let submitting = $state(false);
	let error = $state<unknown>(null);
	let titleMissing = $state(false);
	let shake = $state(false);

	let form = $state({ title: '', note: '', tags: [] as string[] });

	// Each opening starts from the record being edited, or from a blank idea.
	$effect(() => {
		if (!open) return;
		error = null;
		titleMissing = false;
		form = {
			title: idea?.title ?? '',
			note: idea?.note ?? '',
			tags: idea?.tags.map((tag) => tag.name) ?? []
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
			title: form.title.trim(),
			note: form.note.trim() || null,
			tagNames: form.tags
		};

		try {
			await (idea ? updateIdea(idea.id, input) : createIdea(input));
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
	title={idea ? 'Edit Idea' : 'New Idea'}
	submitLabel={idea ? 'Save' : 'Create'}
	{submitting}
	{error}
	{onClose}
	onSubmit={submit}
>
	<div>
		<label class={field.label} for="idea-title">Title</label>
		<input
			id="idea-title"
			class="{field.input} {titleMissing ? 'border-warn' : ''} {shake ? 'mp-shake' : ''}"
			bind:value={form.title}
			oninput={() => (titleMissing = false)}
			onanimationend={() => (shake = false)}
			placeholder="What's the idea…"
			aria-invalid={titleMissing}
		/>
		{#if titleMissing}
			<p class="mt-1.5 flex items-center gap-1.5 text-xs text-warn">
				<Icon name="warning" size={13} weight={2} /> Title is required
			</p>
		{/if}
	</div>

	<div>
		<label class={field.label} for="idea-note">Note (optional)</label>
		<textarea
			id="idea-note"
			class="{field.input} resize-y"
			rows="3"
			bind:value={form.note}
			placeholder="Any detail worth keeping…"
		></textarea>
	</div>

	<div>
		<span class={field.label}>Tags</span>
		<TagInput bind:tags={form.tags} ariaLabel="Idea tags" placeholder="Add tags…" />
	</div>
</Drawer>
