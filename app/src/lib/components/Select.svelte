<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import Select from 'mushpoint-design/svelte/Select.svelte';

	let { value = $bindable(), ...rest }: ComponentProps<typeof Select> = $props();
</script>

<Select bind:value {...rest} />
