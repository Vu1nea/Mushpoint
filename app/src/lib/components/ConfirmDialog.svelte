<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	import { motion } from '$lib/motion';

	interface Props {
		open: boolean;
		title: string;
		body: string;
		confirmLabel?: string;
		busy?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
		/** Extra content between the body and the action buttons, e.g. a choice checkbox. */
		children?: Snippet;
	}

	let {
		open,
		title,
		body,
		confirmLabel = 'Delete',
		busy = false,
		onConfirm,
		onCancel,
		children
	}: Props = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') onCancel();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<button
		type="button"
		class="fixed inset-0 z-40 cursor-default bg-black/50"
		aria-label="Cancel"
		onclick={onCancel}
		transition:fade={{ duration: motion(180) }}
	></button>

	<div
		class="fixed top-1/2 left-1/2 z-50 w-[90vw] max-w-90 -translate-x-1/2 -translate-y-1/2 rounded-card border border-subtle bg-surface p-4.5 shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="confirm-title"
		transition:scale={{ start: 0.94, duration: motion(180) }}
	>
		<h2 id="confirm-title" class="mb-2.5 font-display text-lg font-bold">{title}</h2>
		<p class="mb-5 text-md leading-relaxed text-muted">{body}</p>
		{#if children}
			<div class="mb-5">
				{@render children()}
			</div>
		{/if}
		<div class="flex justify-end gap-2.5">
			<button
				type="button"
				class="rounded-control border border-subtle px-4 py-2.5 text-md font-semibold text-content transition-colors hover:bg-surface-raised"
				onclick={onCancel}
			>
				Cancel
			</button>
			<button
				type="button"
				class="rounded-control bg-warn px-4 py-2.5 text-md font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
				disabled={busy}
				onclick={onConfirm}
			>
				{busy ? 'Deleting…' : confirmLabel}
			</button>
		</div>
	</div>
{/if}
