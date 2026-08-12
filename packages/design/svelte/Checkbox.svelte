<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		checked: boolean;
		label: string;
		/** Show the label next to the box; off when the row already names the item. */
		showLabel?: boolean;
		disabled?: boolean;
		title?: string;
		onchange: (checked: boolean) => void;
	}

	let { checked, label, showLabel = false, disabled = false, title, onchange }: Props = $props();
</script>

<label
	class="relative inline-flex items-center gap-2.5 text-md {disabled
		? 'cursor-not-allowed opacity-60'
		: 'cursor-pointer'}"
	{title}
>
	<!-- The native box is kept for keyboard and screen readers; the span is the paint. -->
	<input
		type="checkbox"
		class="peer absolute size-4.25 cursor-[inherit] opacity-0"
		{checked}
		{disabled}
		aria-label={showLabel ? undefined : label}
		onchange={(event) => onchange(event.currentTarget.checked)}
	/>
	<span
		class="grid size-4.25 shrink-0 place-items-center rounded-md border-[1.5px] transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent {checked
			? 'border-accent-secondary bg-accent-secondary text-accent-contrast'
			: 'border-subtle bg-transparent'}"
	>
		{#if checked}
			<Icon name="check" size={10} weight={3.5} />
		{/if}
	</span>
	{#if showLabel}
		<span>{label}</span>
	{/if}
</label>
