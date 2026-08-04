<script lang="ts">
	import { onMount } from 'svelte';

	import { percent } from '$lib/format';

	interface Props {
		/** 0–1 ratio, as returned by the backend. */
		value: number;
		label?: string;
		showValue?: boolean;
		/** Track height in pixels: 8 on a goal, 6 inside a subgoal row. */
		height?: number;
		color?: string;
		/** Entrance stagger for lists of bars, e.g. from `stagger(index)`. */
		delay?: string;
	}

	let {
		value,
		label,
		showValue = true,
		height = 8,
		color = 'var(--mp-accent)',
		delay = '0ms'
	}: Props = $props();

	const clamped = $derived(Math.min(1, Math.max(0, value)));

	// Bars fill from empty on first paint, matching the ring. The flip to the
	// real value is deferred a frame so the browser actually paints 0% first —
	// flipping synchronously in onMount can land in the same paint as the
	// initial render, which skips the transition entirely.
	let mounted = $state(false);
	onMount(() => {
		requestAnimationFrame(() => {
			mounted = true;
		});
	});
	const shown = $derived(mounted ? clamped : 0);
</script>

<div class="flex items-center gap-3">
	<div
		class="flex-1 overflow-hidden rounded-full bg-track"
		style="height:{height}px"
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
			class="h-full w-full rounded-full"
			style="background:{color}; transform: translateX({(shown - 1) *
				100}%); transition: transform 0.9s var(--mp-ease-bounce) {delay};"
		></div>
	</div>
	{#if showValue}
		<span class="w-10 shrink-0 text-right text-xs text-muted tabular-nums">{percent(clamped)}</span>
	{/if}
</div>
