<script lang="ts">
	import type { IconName } from '$lib/icons';
	import Icon from './Icon.svelte';

	interface Props {
		icon: IconName;
		title: string;
		hint?: string;
	}

	let { icon, title, hint }: Props = $props();
</script>

<div class="rounded-xl border border-dashed border-subtle p-8 text-center text-muted">
	<Icon name={icon} size={28} class="mx-auto mb-3 opacity-70" />
	<p class="text-sm font-medium text-content">{title}</p>
	{#if hint}
		<p class="mt-1 text-sm">{hint}</p>
	{/if}
</div>
