<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';

	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import Icon from '$lib/components/Icon.svelte';
	import type { IconName } from '$lib/icons';
	import { theme } from '$lib/theme/theme.svelte';

	let { children } = $props();

	/** Sidebar entries for the screens that exist; later phases append here. */
	const NAV: { href: string; label: string; icon: IconName }[] = [
		{ href: '/goals', label: 'Goals', icon: 'goal' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	];

	onMount(() => {
		// A failure here only means the palette stays on the default, so it must
		// never take the app down with it.
		theme.init().catch((error) => console.error('could not load the saved theme', error));
	});

	const isCurrent = (href: string) => page.url.pathname.startsWith(href);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen bg-background text-content">
	<aside class="flex w-56 shrink-0 flex-col border-r border-subtle bg-surface p-4">
		<div class="mb-6 flex items-center gap-2">
			<span
				class="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-contrast"
				aria-hidden="true">M</span
			>
			<div>
				<p class="text-sm font-semibold">Mushpoint</p>
				<p class="text-xs text-muted">Personal operating system</p>
			</div>
		</div>

		<nav class="flex flex-col gap-1">
			{#each NAV as item (item.href)}
				<a
					href={item.href}
					aria-current={isCurrent(item.href) ? 'page' : undefined}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
						{isCurrent(item.href)
						? 'bg-surface-raised font-medium text-content'
						: 'text-muted hover:bg-surface-raised hover:text-content'}"
				>
					<Icon name={item.icon} size={18} />
					{item.label}
				</a>
			{/each}
		</nav>
	</aside>

	<main class="flex-1 overflow-x-auto p-8">
		{@render children()}
	</main>
</div>
