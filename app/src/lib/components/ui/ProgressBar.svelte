<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import ProgressBar from 'mushpoint-design/svelte/ProgressBar.svelte';

	let props: ComponentProps<typeof ProgressBar> = $props();
</script>

<ProgressBar {...props} />
