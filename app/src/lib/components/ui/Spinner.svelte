<script lang="ts">
	/**
	 * Inline spinner for a button whose request is pending.
	 *
	 * Draws in `currentColor` so it matches the button's text, and is hidden from
	 * assistive tech: the button keeps its own label (and should set `aria-busy`).
	 * The `mp-spin` animation stops under `prefers-reduced-motion`.
	 */
	import Icon from './Icon.svelte';

	interface Props {
		/** Match the icon or text size it sits beside, so the button doesn't grow. */
		size?: number;
		class?: string;
	}

	let { size = 14, class: className = '' }: Props = $props();
</script>

<Icon name="spinner" {size} weight={2.5} class="mp-spin {className}" />
