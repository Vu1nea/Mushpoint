<script lang="ts">
	import { percent } from '$lib/format';

	interface Props {
		/** 0–1 ratio, as returned by the backend. */
		value: number;
		label?: string;
		showValue?: boolean;
	}

	let { value, label, showValue = true }: Props = $props();

	const clamped = $derived(Math.min(1, Math.max(0, value)));
</script>

<div class="flex items-center gap-3">
	<div
		class="h-2 flex-1 overflow-hidden rounded-full bg-track"
		role="progressbar"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={Math.round(clamped * 100)}
		aria-label={label}
	>
		<!--
			The fill is full width and slid into place, so progress tweens on the
			compositor instead of relayouting the bar on every value change. Its
			rounded left end sits outside the clipped track, which keeps the visible
			right end round at any value.
		-->
		<div
			class="h-full w-full rounded-full bg-accent"
			style="transform: translateX({(clamped - 1) *
				100}%); transition: transform var(--mp-duration-base) var(--mp-ease-out);"
		></div>
	</div>
	{#if showValue}
		<span class="w-10 shrink-0 text-right text-xs text-muted tabular-nums">{percent(clamped)}</span>
	{/if}
</div>
