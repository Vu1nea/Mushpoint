<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly, scale, type TransitionConfig } from 'svelte/transition';

	import { normalizeError } from 'mushpoint-design/utils/errors';
	import { motion } from '$lib/motion';
	import Icon from './Icon.svelte';
	import Spinner from './Spinner.svelte';
	import { button } from './';

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

	// Opening a form moves the user into it, so the first field takes focus.
	$effect(() => {
		if (!open || !panel) return;
		panel.querySelector<HTMLElement>('input, textarea, select')?.focus();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') onClose();
	}

	/** Below `md` the form is a bottom sheet that slides up; from `md` it is a
	 * centered dialog that scales in. Decided per open, from the viewport then. */
	function enter(node: Element): TransitionConfig {
		const desktop = window.matchMedia('(min-width: 48rem)').matches;
		return desktop
			? scale(node, { start: 0.96, duration: motion(180) })
			: fly(node, { y: '100%', opacity: 1, duration: motion(240) });
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
		transition:fade={{ duration: motion(180) }}
	></button>

	<!-- Placed by flex, not translate: a resting transform here would become the
	     containing block for the date and select popovers inside. The fly/scale
	     transitions only transform while animating. Below `md` it is a bottom
	     sheet (anchored by items-end, rounded top only); from `md` a centered dialog. -->
	<div
		class="pointer-events-none fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
	>
		<div
			class="pointer-events-auto flex max-h-[90dvh] w-full flex-col rounded-t-card border border-b-0 border-subtle bg-surface shadow-[0_20px_50px_rgba(0,0,0,0.35)] md:max-h-[85vh] md:w-110 md:max-w-full md:rounded-card md:border-b"
			role="dialog"
			aria-modal="true"
			aria-label={title}
			transition:enter
		>
			<div class="flex items-center justify-between border-b border-subtle px-5.5 py-4.5">
				<h2 class="font-display text-lg font-bold">{title}</h2>
				<button type="button" class="{button.bare} mp-hit" onclick={onClose}>
					<Icon name="close" size={18} weight={2} label="Close" />
				</button>
			</div>

			<form class="flex min-h-0 flex-1 flex-col" onsubmit={submit}>
				<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-5.5" bind:this={panel}>
					{@render children()}
				</div>

				<!-- Outside the scrolling body, so the submit button stays in view; the
				     bottom padding clears the home indicator when shown as a sheet. -->
				<div
					class="flex flex-col gap-3 border-t border-subtle px-5.5 pt-4.5 pb-[calc(1.125rem+env(safe-area-inset-bottom))] md:pb-4.5"
				>
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

					<button
						type="submit"
						class="{button.primary} w-full py-3"
						disabled={submitting}
						aria-busy={submitting}
					>
						{#if submitting}
							<Spinner size={15} />
						{/if}
						{submitting ? 'Saving…' : submitLabel}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
