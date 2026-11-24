<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/** Plain text, or a snippet when part of the line needs its own styling. */
		subtitle?: string | Snippet;
		/** Sits under a back link that already supplies the top spacing. */
		flush?: boolean;
		actions?: Snippet;
	}

	let { title, subtitle, flush = false, actions }: Props = $props();
</script>

<header
	class="flex flex-wrap items-start justify-between gap-3 page-gutter pb-4 {flush
		? 'pt-2'
		: 'pt-5 md:pt-7'}"
>
	<div class="min-w-0">
		<h1 class="font-display text-2xl font-bold text-content md:text-3xl">{title}</h1>
		{#if subtitle}
			<p class="mt-1 text-sm text-muted">
				{#if typeof subtitle === 'string'}{subtitle}{:else}{@render subtitle()}{/if}
			</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
	{/if}
</header>
