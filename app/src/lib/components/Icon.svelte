<script lang="ts">
	import { iconPath, type IconName } from '$lib/icons';
	import { theme } from '$lib/theme/theme.svelte';

	interface Props {
		name: IconName;
		size?: number;
		/** Give an icon a label when it carries meaning on its own. */
		label?: string;
		class?: string;
	}

	let { name, size = 20, label, class: className = '' }: Props = $props();

	const path = $derived(iconPath(name, theme.current));
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	role={label ? 'img' : 'presentation'}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	<path d={path} />
</svg>
