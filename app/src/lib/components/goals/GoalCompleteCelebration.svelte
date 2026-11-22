<script lang="ts">
	import { fade, scale } from 'svelte/transition';

	import { motion } from '$lib/motion';

	interface Props {
		open: boolean;
		title: string;
		onClose: () => void;
	}

	let { open, title, onClose }: Props = $props();

	const PHRASES = [
		'Knocked another one down!',
		'You crushed it!',
		'Look at you go!',
		"That's one for the books!",
		'Nailed it!',
		'Another win in the bag!',
		'You did the thing!',
		'EGGcelent!',
		'Goal secured!'
	];

	/** Re-rolled each time the modal opens, not on every render. */
	let phrase = $state(PHRASES[0]);
	$effect(() => {
		if (open) phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
	});

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<button
		type="button"
		class="fixed inset-0 z-40 cursor-default bg-black/50"
		aria-label="Close"
		onclick={onClose}
		transition:fade={{ duration: motion(180) }}
	></button>

	<div
		class="fixed top-1/2 left-1/2 z-50 w-[90vw] max-w-90 -translate-x-1/2 -translate-y-1/2 rounded-card border border-subtle bg-surface p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="celebrate-title"
		transition:scale={{ start: 0.9, duration: motion(220) }}
	>
		<!-- Placeholder art — swap for real illustration/animation later. -->
		<div
			class="mx-auto mb-4 grid size-24 place-items-center rounded-full border border-dashed border-subtle bg-background text-5xl"
			aria-hidden="true"
		>
			🎉
		</div>
		<h2 id="celebrate-title" class="mb-2 font-display text-xl font-bold">{phrase}</h2>
		<p class="mb-6 text-md leading-relaxed text-muted italic">"{title}"</p>
		<button
			type="button"
			class="rounded-control bg-accent px-5 py-2.5 text-md font-bold text-accent-contrast transition-opacity hover:opacity-90"
			onclick={onClose}
		>
			Nice!
		</button>
	</div>
{/if}
