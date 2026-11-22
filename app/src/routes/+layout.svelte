<script lang="ts">
	import './layout.css';
	import { onMount, untrack } from 'svelte';

	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import mushIcon from '$lib/assets/mush-icon.webp';
	import ErrorBanner from '$lib/components/ui/ErrorBanner.svelte';
	import CommandPalette from '$lib/components/shell/CommandPalette.svelte';
	import MobileMenuSheet from '$lib/components/shell/MobileMenuSheet.svelte';
	import MobileQuickAdd from '$lib/components/shell/MobileQuickAdd.svelte';
	import MobileTabBar from '$lib/components/shell/MobileTabBar.svelte';
	import MobileTopBar from '$lib/components/shell/MobileTopBar.svelte';
	import Sidebar from '$lib/components/shell/Sidebar.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import TopBar from '$lib/components/shell/TopBar.svelte';
	import { button } from '$lib/components/ui';
	import Sheet from 'mushpoint-design/svelte/Sheet.svelte';
	import type { IconName } from '$lib/icons';
	import { auth } from '$lib/auth/session.svelte';
	import { isPublicRoute } from '$lib/auth/routes';
	import { crumbsFor } from '$lib/shell/crumbs';
	import { theme } from '$lib/theme/theme.svelte';

	let { children, data } = $props();

	/**
	 * Sidebar entries for the screens that exist. There is no separate Project
	 * Manager screen — see the Architectural Pivot note in
	 * `docs/plans/goal_tracker_plan.md`.
	 */
	const NAV: { href: string; label: string; short: string; icon: IconName }[] = [
		{ href: '/', label: 'Dashboard', short: 'Dashboard', icon: 'dashboard' },
		{ href: '/goals', label: 'Goal Tracker', short: 'Goals', icon: 'goal' },
		{ href: '/tasks', label: 'Task Manager', short: 'Tasks', icon: 'task' },
		{ href: '/ideas', label: 'Idea Vault', short: 'Ideas', icon: 'idea' },
		{ href: '/vision-board', label: 'Vision Board', short: 'Vision', icon: 'vision' },
		{ href: '/settings', label: 'Settings', short: 'Settings', icon: 'settings' }
	];

	/** Settings has no nav entry of its own; the user row (your name) leads there. */
	const MAIN_NAV = NAV.filter((item) => item.href !== '/settings');

	/** The phone tab bar: every main screen. */
	const TABS = MAIN_NAV.map((item) => ({
		href: item.href,
		label: item.short,
		icon: item.icon
	}));

	const SIDEBAR_KEY = 'mushpoint:sidebar-open';

	let sidebarOpen = $state(true);

	/** Sign-in screens and onboarding stand alone, without the app shell. */
	const bare = $derived.by(() => {
		const path: string = page.url.pathname;
		return isPublicRoute(path) || path === '/welcome';
	});

	$effect(() => {
		// Re-read the saved theme whenever someone signs in or out. A failure here
		// only means the palette stays as it is, so it must never take the app down.
		void auth.email;
		untrack(() =>
			theme.init().catch((error) => console.error('could not load the saved theme', error))
		);
	});

	onMount(() => {
		sidebarOpen = localStorage.getItem(SIDEBAR_KEY) !== 'false';
	});

	let retrying = $state(false);

	/** Re-runs the loads; the shell comes back once the profile loads. */
	async function retry() {
		retrying = true;
		try {
			await invalidateAll();
		} finally {
			retrying = false;
		}
	}

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
		localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen));
	}

	const isCurrent = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	let paletteOpen = $state(false);

	/** Ctrl+K / Cmd+K toggles the command palette from anywhere in the shell. */
	function onGlobalKeydown(event: KeyboardEvent) {
		if (bare || data.error) return;
		if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			paletteOpen = !paletteOpen;
		}
	}

	let menuOpen = $state(false);
	let menuButton = $state<HTMLButtonElement>();

	function closeMenu(restoreFocus: boolean) {
		if (!menuOpen) return;
		menuOpen = false;
		if (restoreFocus) menuButton?.focus();
	}

	// A route change (link, back button, redirect) always dismisses the menu.
	afterNavigate(() => {
		menuOpen = false;
		paletteOpen = false;
	});
</script>

<svelte:window onkeydown={onGlobalKeydown} />

{#if navigating.to}
	<div
		class="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-accent"
		role="progressbar"
		aria-label="Loading"
	></div>
{/if}

{#if bare}
	<main
		class="flex min-h-screen w-full items-center justify-center bg-background px-4 py-10 font-sans text-content"
	>
		{@render children()}
	</main>
{:else if data.error}
	<main
		class="flex min-h-screen w-full items-center justify-center bg-background px-4 py-10 font-sans text-content"
	>
		<div class="mp-enter flex w-full max-w-sm flex-col gap-4">
			<ErrorBanner error={data.error} />
			<button
				type="button"
				class={button.primary}
				disabled={retrying}
				aria-busy={retrying}
				onclick={retry}
			>
				{#if retrying}<Spinner />{/if}
				Try again
			</button>
		</div>
	</main>
{:else}
	<div class="flex h-dvh w-full overflow-hidden bg-background font-sans text-content">
		<Sidebar
			open={sidebarOpen}
			items={MAIN_NAV}
			{isCurrent}
			onToggle={toggleSidebar}
			username={data.profile?.username ?? null}
			avatarUrl={data.profile?.avatarUrl ?? null}
		/>

		<div class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
			<MobileTopBar
				name={data.profile?.username ?? auth.email ?? ''}
				avatarUrl={data.profile?.avatarUrl ?? null}
				{menuOpen}
				onMenu={() => (menuOpen = true)}
				bind:menuButton
			/>
			<TopBar
				crumbs={crumbsFor(page.url.pathname)}
				onSearch={() => (paletteOpen = true)}
				name={data.profile?.username ?? auth.email ?? ''}
				avatarUrl={data.profile?.avatarUrl ?? null}
			/>
			<!-- One sheet on the canvas: full-bleed on phones, inset with a radius from `md`.
			     The page scrolls inside it. On phones the bottom padding clears the fixed tab
			     bar (3.5rem) and the home indicator; the scroll padding keeps a focused control
			     from scrolling under it (WCAG 2.4.11). -->
			<Sheet
				class="flex min-h-0 flex-1 flex-col overflow-hidden max-md:rounded-none max-md:border-0 md:mr-3 md:mb-3"
			>
				<main
					class="min-h-0 flex-1 scroll-pb-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] overflow-y-auto px-4 pt-5 pb-[calc(3.5rem+env(safe-area-inset-bottom)+2rem)] md:scroll-pb-0 md:px-11 md:pt-9 md:pb-15"
				>
					{@render children()}
				</main>
			</Sheet>
		</div>
	</div>

	<MobileTabBar items={TABS} {isCurrent} />
	<MobileQuickAdd />
	<CommandPalette open={paletteOpen} onClose={() => (paletteOpen = false)} />
	<MobileMenuSheet
		open={menuOpen}
		username={data.profile?.username ?? null}
		avatarUrl={data.profile?.avatarUrl ?? null}
		settingsCurrent={isCurrent('/settings')}
		onClose={closeMenu}
	/>
{/if}
