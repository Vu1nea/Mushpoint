<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import Tooltip from 'mushpoint-design/svelte/Tooltip.svelte';

	let props: ComponentProps<typeof Tooltip> = $props();

	/**
	 * The upstream caption opens on mouseenter and focusin. Keyboard focus is
	 * covered; a tap reaches it through the mouse events touch browsers emulate
	 * after a tap. iOS Safari only emulates those for elements it considers
	 * clickable, so a caption on a plain (non-button) icon never showed there.
	 * A click listener bound directly on the element (Svelte's delegated
	 * `onclick` doesn't count) makes the subtree clickable for iOS.
	 */
	function tappable(node: HTMLElement) {
		const noop = () => {};
		node.addEventListener('click', noop);
		return () => node.removeEventListener('click', noop);
	}
</script>

<!-- display: contents, so the wrapper adds no box and the layout is unchanged. -->
<span class="contents" {@attach tappable}>
	<Tooltip {...props} />
</span>
