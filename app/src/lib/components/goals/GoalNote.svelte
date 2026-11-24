<script lang="ts">
	import Icon from '../ui/Icon.svelte';
	import { button } from '../ui';

	interface Props {
		motivation: string | null | undefined;
		description: string | null | undefined;
		onEdit: () => void;
		class?: string;
	}

	let { motivation, description, onEdit, class: className = '' }: Props = $props();

	/** Long notes fold to a few lines so the aside never outgrows the screen. */
	const LONG = 220;
	let open = $state(false);
	const long = $derived((motivation?.length ?? 0) > LONG);
</script>

<aside class="flex flex-col gap-6 {className}" aria-label="Why this goal matters">
	{#if motivation}
		<div
			class="group relative mt-2 rounded-control bg-accent/15 px-5 pt-6 pb-5 shadow-[0_10px_24px_-12px_rgb(0_0_0/0.6)] lg:-rotate-1"
		>
			<!-- A strip of tape holds the note up; it is what makes this read as a note. -->
			<span
				class="pointer-events-none absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 rounded-[3px] bg-accent/40"
				aria-hidden="true"
			></span>
			<p
				class="font-display text-lg leading-snug font-medium whitespace-pre-line {long && !open
					? 'line-clamp-6'
					: ''}"
			>
				“{motivation}”
			</p>
			<button
				type="button"
				class="{button.bare} mp-hit absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
				onclick={onEdit}
			>
				<Icon name="edit" size={14} label="Edit motivation" />
			</button>
			{#if long}
				<button
					type="button"
					class="mt-2 text-xs font-semibold text-accent-ink hover:underline"
					aria-expanded={open}
					onclick={() => (open = !open)}
				>
					{open ? 'Show less' : 'Show more'}
				</button>
			{/if}
		</div>
	{:else}
		<button
			type="button"
			class="rounded-control border border-dashed border-accent/30 px-4 py-3 text-left text-sm text-muted transition-colors hover:border-accent/60 hover:bg-accent/5 hover:text-content"
			onclick={onEdit}
		>
			+ Add why this goal matters
		</button>
	{/if}

	{#if description}
		<div>
			<h3 class="mb-1 text-xs font-semibold tracking-[0.06em] text-muted uppercase">Description</h3>
			<p class="text-sm leading-relaxed whitespace-pre-line">{description}</p>
		</div>
	{/if}
</aside>
