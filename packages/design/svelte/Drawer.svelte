<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	import { motion } from '../utils/motion';
	import { normalizeError } from '../utils/errors';
	import { button } from '../utils/ui';
	import Icon from './Icon.svelte';

	interface Props {
		open: boolean;
		title: string;
		submitLabel: string;
		submitting?: boolean;
		/** Set when the last save failed; shown above the submit button with a retry. */
		error?: unknown;
		onClose: () => void;
		onSubmit: () => void;
		children: Snippet;
	}

	let {
		open,
		title,
		submitLabel,
		submitting = false,
		error = null,
		onClose,
		onSubmit,
		children
	}: Props = $props();

	let panel = $state<HTMLElement>();

	// Opening a drawer moves the user into it, so the first field takes focus.
	$effect(() => {
		if (!open || !panel) return;
		panel.querySelector<HTMLElement>('input, textarea, select')?.focus();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') onClose();
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		onSubmit();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<button
		type="button"
		class="fixed inset-0 z-40 cursor-default bg-black/45"
		aria-label="Close {title}"
		onclick={onClose}
		transition:fade={{ duration: motion(250) }}
	></button>

	<div
		class="fixed inset-y-0 right-0 z-50 flex w-110 max-w-[92vw] flex-col border-l border-subtle bg-surface shadow-[-8px_0_30px_rgba(0,0,0,0.25)]"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		transition:fly={{ x: 440, duration: motion(300) }}
	>
		<div class="flex items-center justify-between border-b border-subtle px-5.5 py-5">
			<h2 class="font-display text-lg font-bold">{title}</h2>
			<button type="button" class={button.bare} onclick={onClose}>
				<Icon name="close" size={18} weight={2} label="Close" />
			</button>
		</div>

		<form class="flex min-h-0 flex-1 flex-col" onsubmit={submit}>
			<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-5.5" bind:this={panel}>
				{@render children()}
			</div>

			<div class="flex flex-col gap-3 border-t border-subtle px-5.5 py-4.5">
				{#if error}
					{@const failure = normalizeError(error)}
					<div
						class="mp-enter flex items-start gap-2.5 rounded-[10px] border border-warn/35 bg-warn/10 px-3.5 py-3"
						role="alert"
					>
						<Icon name="warning" size={16} weight={2} class="mt-px text-warn" />
						<div class="flex-1">
							<p class="text-sm font-semibold text-warn">Couldn't save</p>
							<p class="text-xs text-muted">{failure.message}</p>
						</div>
						<button
							type="submit"
							class="shrink-0 rounded-md border border-warn px-2.5 py-1.5 text-xs font-semibold text-warn"
							disabled={submitting}
						>
							Retry
						</button>
					</div>
				{/if}

				<button type="submit" class="{button.primary} w-full py-3" disabled={submitting}>
					{#if submitting}
						<Icon name="spinner" size={15} weight={2.5} class="mp-spin" />
					{/if}
					{submitting ? 'Saving…' : submitLabel}
				</button>
			</div>
		</form>
	</div>
{/if}
