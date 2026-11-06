<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import DatePicker from 'mushpoint-design/svelte/DatePicker.svelte';

	let { value = $bindable(), ...rest }: ComponentProps<typeof DatePicker> = $props();
</script>

<DatePicker bind:value {...rest} />
