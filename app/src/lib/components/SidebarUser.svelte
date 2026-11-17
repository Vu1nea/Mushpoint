<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth, signOut } from '$lib/auth/session.svelte';
	import Icon from './Icon.svelte';
	import Spinner from './Spinner.svelte';

	interface Props {
		/** False in the collapsed rail: every entry shrinks to its icon. */
		open: boolean;
		username: string | null;
		/** True on /settings: this row is the way into Settings. */
		current?: boolean;
	}

	let { open, username, current = false }: Props = $props();

	const name = $derived(username ?? auth.email ?? 'Account');

	let busy = $state(false);

	async function leave() {
		busy = true;
		try {
			await signOut();
		} catch (error) {
			// The local session is gone either way; the user still ends up signed out.
			console.error('sign out failed', error);
		} finally {
			busy = false;
		}
		await goto('/login', { replaceState: true });
	}

	const row = $derived(
		`flex items-center gap-2.5 overflow-hidden rounded-control px-2.75 py-1.75 whitespace-nowrap font-medium text-muted transition-colors hover:bg-surface-raised hover:text-content disabled:opacity-50`
	);
</script>

<div class="flex flex-col gap-px border-t border-subtle px-2.5 py-2">
	<!-- The single way into Settings: your name opens your account settings. -->
	<a
		href="/settings"
		class="{row} {current ? 'bg-surface-raised' : ''}"
		aria-current={current ? 'page' : undefined}
		title={open ? `${name} · Settings` : undefined}
	>
		<Icon name="user" size={16} label={open ? undefined : `Settings (${name})`} />
		{#if open}
			<span class="min-w-0 flex-1 truncate text-sm font-semibold text-content">{name}</span>
			<span class="sr-only">Settings</span>
			<Icon name="settings" size={14} />
		{/if}
	</a>
	<button
		type="button"
		class={row}
		disabled={busy}
		aria-busy={busy}
		aria-label={open ? undefined : 'Sign out'}
		onclick={leave}
	>
		<!-- Swaps in for the icon, so the collapsed sidebar row keeps its size. -->
		{#if busy}
			<Spinner size={16} />
		{:else}
			<Icon name="signout" size={16} label={open ? undefined : 'Sign out'} />
		{/if}
		{#if open}
			<span class="text-sm">Sign out</span>
		{/if}
	</button>
</div>
