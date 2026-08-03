<script lang="ts">
	import { onMount } from 'svelte';

	import { percent } from '$lib/format';

	interface Props {
		/** 0–1 ratio, as returned by the backend. */
		value: number;
		label: string;
		size?: number;
		/** Any CSS color; defaults to the accent, categories pass their own token. */
		color?: string;
	}

	let { value, label, size = 46, color = 'var(--mp-accent)' }: Props = $props();

	const clamped = $derived(Math.min(1, Math.max(0, value)));

	// The ring sweeps up from empty on first paint, then tweens on every change.
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
	const angle = $derived(mounted ? clamped * 360 : 0);
</script>

<div
	class="relative grid shrink-0 place-items-center rounded-full"
	style="width:{size}px;height:{size}px;--mp-ring-angle:{angle}deg;
		background:conic-gradient({color} var(--mp-ring-angle), var(--mp-border) 0deg);
		transition:--mp-ring-angle 1.1s var(--mp-ease-out)"
	role="progressbar"
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={Math.round(clamped * 100)}
	aria-label={label}
>
	<div
		class="absolute inset-1 grid place-items-center rounded-full bg-surface text-2xs font-bold tabular-nums"
	>
		{percent(clamped)}
	</div>
</div>
