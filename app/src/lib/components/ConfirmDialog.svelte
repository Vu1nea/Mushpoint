<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import ConfirmDialog from 'mushpoint-design/svelte/ConfirmDialog.svelte';

	let props: ComponentProps<typeof ConfirmDialog> = $props();
</script>

<ConfirmDialog {...props} />
