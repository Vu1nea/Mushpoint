<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	import { goto } from '$app/navigation';
	import { auth, signOut } from '$lib/auth/session.svelte';
	import { motion } from '$lib/motion';
	import { THEME_LABELS, theme } from '$lib/theme/theme.svelte';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import MadeByCredit from './MadeByCredit.svelte';
	import Spinner from './Spinner.svelte';
	import ThemeSwitch from './ThemeSwitch.svelte';

	interface Props {
		open: boolean;
		username: string | null;
		avatarUrl: string | null;
		settingsCurrent: boolean;
		/**
		 * `restoreFocus` is false when the sheet closes because the user followed a
		 * link: the new page owns focus then, not the menu button.
		 */
		onClose: (restoreFocus: boolean) => void;
	}

	let { open, username, avatarUrl, settingsCurrent, onClose }: Props = $props();

	let panel = $state<HTMLElement>();

	// Opening the sheet moves focus into it.
	$effect(() => {
		if (open && panel) panel.focus();
	});

	let leaving = $state(false);

	async function leave() {
		leaving = true;
		try {
			await signOut();
		} catch (error) {
			// The local session is gone either way; the user still ends up signed out.
			console.error('sign out failed', error);
		} finally {
			leaving = false;
		}
		onClose(false);
		await goto('/login', { replaceState: true });
	}

	const row =
		'flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors hover:bg-surface-raised disabled:opacity-50';

	function handleWindowKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			event.preventDefault();
			onClose(true);
		}
	}

	/** Keeps Tab inside the sheet while it is open (it is modal). */
	function trapTab(event: KeyboardEvent) {
		if (event.key !== 'Tab' || !panel) return;
		const focusable = [
			...panel.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		];
		if (focusable.length === 0) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	/** Any link in the sheet navigates away, so the sheet gets out of the way. */
	function closeOnLink(event: MouseEvent) {
		if ((event.target as Element | null)?.closest('a')) onClose(false);
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
	<button
		type="button"
		tabindex="-1"
		class="fixed inset-0 z-40 cursor-default bg-black/45 md:hidden"
		aria-label="Close account menu"
		onclick={() => onClose(true)}
		transition:fade={{ duration: motion(180) }}
	></button>

	<!-- Phones only: account sheet that rises from the bottom, where the thumb is. -->
	<div
		bind:this={panel}
		id="mobile-menu"
		class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-y-auto rounded-t-card border border-b-0 border-subtle bg-surface pr-[env(safe-area-inset-right)] pb-[calc(0.75rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] shadow-[0_-10px_40px_rgba(0,0,0,0.3)] focus:outline-none md:hidden"
		role="dialog"
		aria-modal="true"
		aria-label="Account"
		tabindex="-1"
		onkeydown={trapTab}
		onclick={closeOnLink}
		transition:fly={{ y: 320, duration: motion(220), opacity: 1 }}
	>
		<div class="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-subtle" aria-hidden="true"></div>

		<div class="flex items-center gap-3 border-b border-subtle px-5 pt-2 pb-4">
			<Avatar name={username ?? auth.email ?? ''} url={avatarUrl} class="size-10 text-base" />
			<div class="min-w-0">
				<p class="truncate text-base font-semibold">{username ?? 'Account'}</p>
				{#if auth.email}
					<p class="truncate text-xs text-muted">{auth.email}</p>
				{/if}
			</div>
		</div>

		<div class="flex flex-col gap-0.5 px-2 py-2">
			<a
				href="/settings"
				aria-current={settingsCurrent ? 'page' : undefined}
				class="{row} text-content {settingsCurrent ? 'bg-surface-raised' : ''}"
			>
				<Icon name="settings" size={18} />
				Settings
			</a>
			<div class="{row} justify-between hover:bg-transparent">
				<span class="flex items-center gap-3 text-content">
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="8.5" />
						<path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
					</svg>
					Theme
					<span class="text-xs text-muted">{THEME_LABELS[theme.current]}</span>
				</span>
				<ThemeSwitch showLabel={false} />
			</div>
			<button type="button" class="{row} text-muted" disabled={leaving} onclick={leave}>
				{#if leaving}<Spinner size={18} />{:else}<Icon name="signout" size={18} />{/if}
				Sign out
			</button>
		</div>

		<div class="px-5 pt-1"><MadeByCredit /></div>
	</div>
{/if}
