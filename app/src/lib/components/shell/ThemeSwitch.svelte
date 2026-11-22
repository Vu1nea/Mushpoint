<script lang="ts">
	import { THEME_LABELS, theme } from '$lib/theme/theme.svelte';

	interface Props {
		/** Shows the current theme's name beside the switch. */
		showLabel?: boolean;
	}

	let { showLabel = true }: Props = $props();

	const otherTheme = $derived(theme.current === 'nocturne' ? 'coquette' : 'nocturne');

	async function flipTheme() {
		try {
			await theme.set(otherTheme);
		} catch (error) {
			console.error('could not save the theme', error);
		}
	}
</script>

<div class="flex items-center justify-between gap-2">
	{#if showLabel}
		<span class="text-2xs tracking-[0.06em] text-muted uppercase">
			{THEME_LABELS[theme.current]}
		</span>
	{/if}
	<button
		type="button"
		class="relative h-5.5 w-10 shrink-0 rounded-full border border-subtle bg-background"
		role="switch"
		aria-checked={theme.current === 'coquette'}
		aria-label="Switch to the {THEME_LABELS[otherTheme]} theme"
		onclick={flipTheme}
	>
		<span
			class="absolute top-px size-4.5 rounded-full bg-accent transition-[left] duration-200"
			style="left:{theme.current === 'nocturne' ? '1px' : '19px'}"
		></span>
	</button>
</div>
