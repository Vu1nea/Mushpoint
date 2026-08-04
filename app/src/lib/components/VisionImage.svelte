<!-- app/src/lib/components/VisionImage.svelte -->
<script lang="ts">
	import { resolveImageSrc } from '$lib/images';

	interface Props {
		/** A relative path as stored on a VisionItem, e.g. `images/<uuid>.png`. */
		path: string;
		alt?: string;
		class?: string;
	}

	let { path, alt = '', class: className = '' }: Props = $props();

	let src = $state<string | null>(null);

	$effect(() => {
		src = null;
		resolveImageSrc(path).then((resolved) => {
			src = resolved;
		});
	});
</script>

{#if src}
	<img {src} {alt} class={className} />
{/if}
