<script lang="ts">
	import { iconMarkup, type IconName } from '../icons';
	import Tooltip from './Tooltip.svelte';

	interface Props {
		name: IconName;
		size?: number;
		/** Give an icon a label when it carries meaning on its own — also shown as a hover caption. */
		label?: string;
		/** Stroke weight; the design draws outlines at 1.8 and emphasis at 2.4. */
		weight?: number;
		class?: string;
	}

	let { name, size = 20, label, weight = 1.8, class: className = '' }: Props = $props();

	// Icon geometry is package-owned static markup, never user input.
	const markup = $derived(iconMarkup(name));
</script>

{#snippet svg()}
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width={weight}
		stroke-linecap="round"
		stroke-linejoin="round"
		class="shrink-0 {className}"
		role={label ? 'img' : 'presentation'}
		aria-label={label}
		aria-hidden={label ? undefined : 'true'}
	>
		{@html markup}
	</svg>
{/snippet}

{#if label}
	<Tooltip text={label}>
		{@render svg()}
	</Tooltip>
{:else}
	{@render svg()}
{/if}
