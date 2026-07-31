<script lang="ts">
	import type { Snippet } from 'svelte';

	import { field } from './ui';
	import Icon from './Icon.svelte';

	interface Props {
		/** Bound selection. Options are supplied as children so groups stay possible. */
		value: string;
		id?: string;
		ariaLabel?: string;
		disabled?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		value = $bindable(),
		id,
		ariaLabel,
		disabled = false,
		class: className = '',
		children
	}: Props = $props();
</script>

<!-- The native chevron is dropped and redrawn so the control matches the theme. -->
<div class="relative {className}">
	<select
		{id}
		{disabled}
		aria-label={ariaLabel}
		bind:value
		class="{field.input} cursor-pointer appearance-none pr-9 font-medium disabled:cursor-not-allowed disabled:opacity-60"
	>
		{@render children()}
	</select>
	<Icon
		name="chevron-down"
		size={12}
		weight={2.2}
		class="pointer-events-none absolute top-1/2 right-[13px] -translate-y-1/2 text-muted"
	/>
</div>
