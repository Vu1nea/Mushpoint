<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import Checkbox from 'mushpoint-design/svelte/Checkbox.svelte';

	let props: ComponentProps<typeof Checkbox> = $props();
</script>

<Checkbox {...props} />
