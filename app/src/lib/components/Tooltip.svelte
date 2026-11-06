<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import Tooltip from 'mushpoint-design/svelte/Tooltip.svelte';

	let props: ComponentProps<typeof Tooltip> = $props();
</script>

<Tooltip {...props} />
