<script lang="ts">
	interface Props {
		/** Name the fallback initial comes from (username, else email). */
		name: string;
		/** Signed picture URL; null, or a link that fails to load, shows the initial. */
		url: string | null;
		/** Size and text classes, e.g. `size-8 text-sm`. */
		class?: string;
	}

	let { name, url, class: sizing = 'size-8 text-sm' }: Props = $props();

	const initial = $derived(name.trim().charAt(0) || '?');
	/** The URL that failed; a fresh URL (after a reload or upload) gets another try. */
	let failedUrl = $state<string | null>(null);
	const showImage = $derived(url !== null && url !== failedUrl);
</script>

<!-- Decorative: every place it appears names the account in text or a label. -->
<span
	class="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-bold text-accent-contrast uppercase {sizing}"
	aria-hidden="true"
>
	{#if showImage}
		<img
			src={url}
			alt=""
			decoding="async"
			class="size-full object-cover"
			onerror={() => (failedUrl = url)}
		/>
	{:else}
		{initial}
	{/if}
</span>
