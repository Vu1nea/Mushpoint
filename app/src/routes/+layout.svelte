<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';

	import { page } from '$app/state';
	import mushIcon from '$lib/assets/mush-icon.png';
	import Icon from '$lib/components/Icon.svelte';
	import { button } from '$lib/components/ui';
	import type { IconName } from '$lib/icons';
	import { THEME_LABELS, theme } from '$lib/theme/theme.svelte';

	let { children } = $props();

	/**
	 * Sidebar entries for the screens that exist. Dashboard (phase 7) is added
	 * here once it ships. There is no separate Project Manager screen — see
	 * the Architectural Pivot note in `docs/plans/goal_tracker_plan.md`.
	 */
	const NAV: { href: string; label: string; icon: IconName }[] = [
		{ href: '/goals', label: 'Goal Tracker', icon: 'goal' },
		{ href: '/tasks', label: 'Task Manager', icon: 'task' },
		{ href: '/ideas', label: 'Idea Vault', icon: 'idea' },
		{ href: '/vision-board', label: 'Vision Board', icon: 'vision' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	];

	const SIDEBAR_KEY = 'mushpoint:sidebar-open';

	let sidebarOpen = $state(true);

	onMount(() => {
		// A failure here only means the palette stays on the default, so it must
		// never take the app down with it.
		theme.init().catch((error) => console.error('could not load the saved theme', error));
		sidebarOpen = localStorage.getItem(SIDEBAR_KEY) !== 'false';
	});

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
		localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen));
	}

	const isCurrent = (href: string) => page.url.pathname.startsWith(href);

	const otherTheme = $derived(theme.current === 'nocturne' ? 'coquette' : 'nocturne');

	async function flipTheme() {
		try {
			await theme.set(otherTheme);
		} catch (error) {
			console.error('could not save the theme', error);
		}
	}
</script>

<svelte:head><link rel="icon" href={mushIcon} /></svelte:head>

<div class="flex h-screen w-full overflow-hidden bg-background font-sans text-content">
	<aside
		class="duration-250ms flex shrink-0 flex-col overflow-hidden border-r border-subtle bg-surface transition-[width] ease-out"
		style="width:{sidebarOpen ? '236px' : '76px'}"
	>
		<div class="flex items-center gap-2.5 overflow-hidden px-3.5 pt-4 pb-3 whitespace-nowrap">
			<img
				src={mushIcon}
				alt=""
				class="size-7 shrink-0 rounded-full object-cover"
				aria-hidden="true"
			/>
			{#if sidebarOpen}
				<span class="font-display text-base font-bold tracking-[0.2px]">Mushpoint</span>
			{/if}
		</div>

		{#if sidebarOpen}
			<p class="px-4 pt-1 pb-1.5 text-2xs text-muted/75">Workspace</p>
		{/if}

		<nav class="flex flex-1 flex-col gap-px overflow-y-auto px-2.5 py-1">
			{#each NAV as item (item.href)}
				<a
					href={item.href}
					aria-current={isCurrent(item.href) ? 'page' : undefined}
					class="mb-0.5 flex items-center gap-2.5 overflow-hidden rounded-control px-2.75 py-1.75 whitespace-nowrap transition-colors
						{isCurrent(item.href)
						? 'bg-surface-raised font-semibold text-content'
						: 'font-medium text-muted hover:bg-surface-raised hover:text-content'}"
				>
					<Icon name={item.icon} size={16} label={sidebarOpen ? undefined : item.label} />
					{#if sidebarOpen}
						<span class="text-sm">{item.label}</span>
					{/if}
				</a>
			{/each}
		</nav>

		<div class="flex items-center justify-between gap-2 border-t border-subtle px-3.5 py-3">
			{#if sidebarOpen}
				<span class="text-2xs tracking-[0.06em] text-muted uppercase">
					{THEME_LABELS[theme.current]}
				</span>
			{/if}
			<button
				type="button"
				class="relative h-5.5 w-10 shrink-0 rounded-full border border-subtle bg-background"
				role="switch"
				aria-checked={theme.current === 'coquette'}
				aria-label="Switch to the {THEME_LABELS[otherTheme]} theme"
				onclick={flipTheme}
			>
				<span
					class="absolute top-px size-4.5 rounded-full bg-accent transition-[left] duration-200"
					style="left:{theme.current === 'nocturne' ? '1px' : '19px'}"
				></span>
			</button>
		</div>
	</aside>

	<div class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
		<header class="flex shrink-0 items-center gap-2.5 border-b border-subtle px-6 py-3.5">
			<button type="button" class={button.bare} onclick={toggleSidebar}>
				<Icon name="sidebar" size={17} weight={1.7} label="Toggle sidebar" />
			</button>
			<span class="text-sm text-muted">Personal operating system</span>
		</header>

		<main class="flex-1 overflow-y-auto px-11 pt-9 pb-15">
			{@render children()}
		</main>
	</div>
</div>
