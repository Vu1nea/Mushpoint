<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';

	let props: ComponentProps<typeof ErrorBanner> = $props();
</script>

<ErrorBanner {...props} />
