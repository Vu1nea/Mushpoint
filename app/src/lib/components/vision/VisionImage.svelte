<!-- app/src/lib/components/vision/VisionImage.svelte -->
<script lang="ts">
	interface Props {
		/** A vision item's signed `imageUrl`; null renders nothing. */
		src: string | null;
		alt?: string;
		class?: string;
	}

	let { src, alt = '', class: className = '' }: Props = $props();
</script>

{#if src}
	<!-- Boards can hold many full-size uploads: fetch only what scrolls into view,
	     and decode off the main thread. -->
	<img {src} {alt} class={className} loading="lazy" decoding="async" />
{/if}
