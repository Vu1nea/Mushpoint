<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		count?: number;
		/** `lead` titles the main column's lists; `rail` titles the supporting cards. */
		tier?: 'lead' | 'rail';
		sub?: Snippet;
		actions?: Snippet;
	}

	let { title, count, tier = 'rail', sub, actions }: Props = $props();
</script>

<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 dash-pad pt-4 pb-3">
	<div class="min-w-0">
		<h2
			class="flex items-baseline gap-2 text-content {tier === 'lead'
				? 'font-display text-xl font-semibold'
				: 'text-base font-semibold'}"
		>
			{title}
			{#if count !== undefined}
				<span class="text-xs font-semibold text-muted tabular-nums">{count}</span>
			{/if}
		</h2>
		{#if sub}<div class="mt-0.5 text-sm text-muted">{@render sub()}</div>{/if}
	</div>
	{#if actions}<div class="flex items-center gap-2">{@render actions()}</div>{/if}
</div>
