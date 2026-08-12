<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import TagInput from 'mushpoint-design/svelte/TagInput.svelte';

	let { tags = $bindable(), ...rest }: ComponentProps<typeof TagInput> = $props();
</script>

<TagInput bind:tags {...rest} />
