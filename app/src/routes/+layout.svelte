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
	 * Sidebar entries for the screens that exist. There is no separate Project
	 * Manager screen — see the Architectural Pivot note in
	 * `docs/plans/goal_tracker_plan.md`.
	 */
	const NAV: { href: string; label: string; icon: IconName }[] = [
		{ href: '/', label: 'Dashboard', icon: 'dashboard' },
		{ href: '/goals', label: 'Goal Tracker', icon: 'goal' },
		{ href: '/tasks', label: 'Task Manager', icon: 'task' },
		{ href: '/ideas', label: 'Idea Vault', icon: 'idea' },
		{ href: '/vision-board', label: 'Vision Board', icon: 'vision' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	];

	const SIDEBAR_KEY = 'mushpoint:sidebar-open';

	let sidebarOpen = $state(true);
	let osName = $state('personal operating system');

	onMount(() => {
		// A failure here only means the palette stays on the default, so it must
		// never take the app down with it.
		theme.init().catch((error) => console.error('could not load the saved theme', error));
		sidebarOpen = localStorage.getItem(SIDEBAR_KEY) !== 'false';
		osName = detectOsName();
	});

	function detectOsName(): string {
		const ua = navigator.userAgent;
		if (ua.includes('Windows')) return 'Windows';
		if (ua.includes('Mac OS X') || ua.includes('Macintosh')) return 'macOS';
		if (ua.includes('Linux')) return 'Linux';
		return '';
	}

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
		localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen));
	}

	const isCurrent = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));

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
				class="size-8 shrink-0 rounded-full object-cover"
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

		<div class="flex flex-col gap-1 border-t border-subtle px-3.5 py-3">
			<div class="flex items-center justify-between gap-2">
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
			{#if sidebarOpen}
				<span class="flex items-center gap-1.5 text-2xs text-muted/60">
					Made by
					<a target="_blank" class="no-underline" href="https://github.com/Vu1nea" rel='external'>Vu1nea</a>
					<svg
						viewBox="0 0 24 24"
						class="size-4 shrink-0 text-accent"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							d="M15,24c-.553,0-1-.447-1-1v-1.398c0-1.505,.805-2.853,2.1-3.516,3.022-1.55,4.9-4.62,4.9-8.013,0-3.455-1.928-6.55-5.03-8.078l.03,6.005c0,2.206-1.794,4-4,4s-4-1.794-4-4V2.012C4.928,3.523,3,6.618,3,10.073c0,3.393,1.878,6.463,4.9,8.013,1.295,.663,2.1,2.011,2.1,3.516v1.398c0,.553-.447,1-1,1s-1-.447-1-1v-1.398c0-.739-.397-1.421-1.012-1.736-3.693-1.894-5.988-5.646-5.988-9.792C1,5.852,3.355,2.068,7.146,.2c.61-.3,1.321-.263,1.901,.101,.597,.371,.953,1.011,.953,1.711v5.988c0,1.103,.897,2,2,2s2-.897,2-2V2.012c0-.7,.356-1.34,.953-1.711,.581-.362,1.293-.399,1.9-.101,3.791,1.868,6.146,5.651,6.146,9.873,0,4.146-2.295,7.898-5.988,9.792-.614,.315-1.012,.997-1.012,1.736v1.398c0,.553-.447,1-1,1Z"
						/>
					</svg>
				</span>
			{/if}
		</div>
	</aside>

	<div class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
		<header class="flex shrink-0 items-center gap-2.5 border-b border-subtle px-6 py-3.5">
			<button type="button" class={button.bare} onclick={toggleSidebar}>
				<Icon name="sidebar" size={17} weight={1.7} label="Toggle sidebar" />
			</button>
			<span class="text-sm text-muted">{osName}</span>
		</header>

		<main class="flex-1 overflow-y-auto px-11 pt-9 pb-15">
			{@render children()}
		</main>
	</div>
</div>
