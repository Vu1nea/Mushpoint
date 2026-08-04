<!-- app/src/lib/components/VisionItemDrawer.svelte -->
<script lang="ts">
	import { createVisionItem, updateVisionItem, type VisionItem } from '$lib/api';
	import { pickAndCopyImage } from '$lib/images';
	import Drawer from './Drawer.svelte';
	import Icon from './Icon.svelte';
	import VisionImage from './VisionImage.svelte';
	import { button, field } from './ui';

	interface Props {
		open: boolean;
		/** Null creates an item; an item edits it in place. */
		item?: VisionItem | null;
		onClose: () => void;
		onSaved: () => Promise<void> | void;
	}

	let { open, item = null, onClose, onSaved }: Props = $props();

	let submitting = $state(false);
	let picking = $state(false);
	let error = $state<unknown>(null);
	let contentMissing = $state(false);
	let shake = $state(false);

	let form = $state({ imagePath: null as string | null, quoteText: '' });

	// Each opening starts from the record being edited, or from a blank item.
	$effect(() => {
		if (!open) return;
		error = null;
		contentMissing = false;
		form = {
			imagePath: item?.imagePath ?? null,
			quoteText: item?.quoteText ?? ''
		};
	});

	async function pickImage() {
		picking = true;
		try {
			const picked = await pickAndCopyImage();
			if (picked) {
				form.imagePath = picked;
				contentMissing = false;
			}
		} catch (failure) {
			error = failure;
		} finally {
			picking = false;
		}
	}

	async function submit() {
		const quoteText = form.quoteText.trim();
		if (!form.imagePath && !quoteText) {
			contentMissing = true;
			shake = true;
			return;
		}

		submitting = true;
		error = null;
		const input = { imagePath: form.imagePath, quoteText: quoteText || null };

		try {
			await (item ? updateVisionItem(item.id, input) : createVisionItem(input));
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
	title={item ? 'Edit Vision Item' : 'New Vision Item'}
	submitLabel={item ? 'Save' : 'Create'}
	{submitting}
	{error}
	{onClose}
	onSubmit={submit}
>
	<div>
		<span class={field.label}>Image (optional)</span>
		{#if form.imagePath}
			<div class="mb-2 overflow-hidden rounded-control border border-subtle">
				<VisionImage path={form.imagePath} class="h-40 w-full object-cover" />
			</div>
		{/if}
		<div class="flex gap-2">
			<button type="button" class={button.ghost} disabled={picking} onclick={pickImage}>
				{#if picking}
					<Icon name="spinner" size={14} weight={2.5} class="mp-spin" />
				{/if}
				{form.imagePath ? 'Replace image' : 'Choose image…'}
			</button>
			{#if form.imagePath}
				<button type="button" class={button.ghost} onclick={() => (form.imagePath = null)}>
					Remove image
				</button>
			{/if}
		</div>
	</div>

	<div>
		<label class={field.label} for="vision-quote">Quote (optional)</label>
		<textarea
			id="vision-quote"
			class="{field.input} resize-y {shake ? 'mp-shake' : ''}"
			rows="3"
			bind:value={form.quoteText}
			oninput={() => (contentMissing = false)}
			onanimationend={() => (shake = false)}
			placeholder="A line worth seeing every day…"
		></textarea>
	</div>

	{#if contentMissing}
		<p class="flex items-center gap-1.5 text-xs text-warn">
			<Icon name="warning" size={13} weight={2} /> Add an image, a quote, or both
		</p>
	{/if}
</Drawer>
