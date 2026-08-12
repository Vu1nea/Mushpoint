<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import Drawer from 'mushpoint-design/svelte/Drawer.svelte';

	let props: ComponentProps<typeof Drawer> = $props();
</script>

<Drawer {...props} />
