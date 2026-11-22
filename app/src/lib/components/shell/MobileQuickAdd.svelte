<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	import { invalidateAll } from '$app/navigation';
	import { motion } from '$lib/motion';
	import DashboardQuickAdd from '../dashboard/DashboardQuickAdd.svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';
	import Icon from '../ui/Icon.svelte';

	let open = $state(false);
	let error = $state<unknown>(null);
	let panel = $state<HTMLElement>();
	let fab = $state<HTMLButtonElement>();

	function show() {
		error = null;
		open = true;
	}

	function close(restoreFocus = true) {
		if (!open) return;
		open = false;
		if (restoreFocus) fab?.focus();
	}

	// Opening the sheet puts the cursor in the title field.
	$effect(() => {
		if (open && panel) panel.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
	});

	async function added() {
		await invalidateAll();
		close();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	}

	/** Keeps Tab inside the sheet while it is open (it is modal). */
	function trapTab(event: KeyboardEvent) {
		if (event.key !== 'Tab' || !panel) return;
		const focusable = [
			...panel.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		];
		if (focusable.length === 0) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<!-- Phones only: a floating + above the tab bar opens a quick-add sheet. -->
<button
	bind:this={fab}
	type="button"
	class="fixed right-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] z-30 grid size-14 place-items-center rounded-full bg-accent text-accent-contrast shadow-lg transition-transform active:scale-95 md:hidden"
	aria-label="Quick add"
	aria-haspopup="dialog"
	aria-expanded={open}
	onclick={show}
>
	<Icon name="plus" size={24} weight={2.4} />
</button>

{#if open}
	<button
		type="button"
		tabindex="-1"
		class="fixed inset-0 z-40 cursor-default bg-black/45 md:hidden"
		aria-label="Close quick add"
		onclick={() => close()}
		transition:fade={{ duration: motion(180) }}
	></button>

	<div
		bind:this={panel}
		class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-card border border-b-0 border-subtle bg-surface px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.3)] focus:outline-none md:hidden"
		role="dialog"
		aria-modal="true"
		aria-label="Quick add"
		tabindex="-1"
		onkeydown={trapTab}
		transition:fly={{ y: 320, duration: motion(220), opacity: 1 }}
	>
		<div class="mx-auto mb-1 h-1 w-10 rounded-full bg-subtle" aria-hidden="true"></div>
		<h2 class="font-display text-lg font-bold">Quick add</h2>

		{#if error}
			<ErrorBanner {error} onDismiss={() => (error = null)} />
		{/if}

		<DashboardQuickAdd stacked onAdded={added} onError={(e) => (error = e)} />
	</div>
{/if}
