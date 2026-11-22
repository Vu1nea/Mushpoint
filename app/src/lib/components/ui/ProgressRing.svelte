<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import ProgressRing from 'mushpoint-design/svelte/ProgressRing.svelte';

	let props: ComponentProps<typeof ProgressRing> = $props();
</script>

<ProgressRing {...props} />
