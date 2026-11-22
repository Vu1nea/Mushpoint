<script lang="ts">
	import type { Snippet } from 'svelte';

	import Sheet from 'mushpoint-design/svelte/Sheet.svelte';
	import mushIcon from '$lib/assets/mush-icon.webp';

	let { children }: { children: Snippet } = $props();
</script>

<!-- The one centred sheet every signed-out screen sits on: mark and wordmark, then the form. -->
<Sheet class="mp-enter w-full max-w-sm p-6 sm:p-8">
	<div class="mb-6 flex items-center gap-2.5">
		<img
			src={mushIcon}
			alt=""
			width="32"
			height="32"
			class="size-8 rounded-full object-cover"
			aria-hidden="true"
		/>
		<span class="font-display text-md font-bold text-content">Mushpoint</span>
	</div>
	{@render children()}
</Sheet>
