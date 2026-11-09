<!-- app/src/lib/components/VisionImage.svelte -->
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
	<img {src} {alt} class={className} />
{/if}
