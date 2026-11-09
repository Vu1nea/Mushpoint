<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth, signOut } from '$lib/auth/session.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		/** False in the collapsed rail: every entry shrinks to its icon. */
		open: boolean;
		username: string | null;
	}

	let { open, username }: Props = $props();

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

	const row =
		'flex items-center gap-2.5 overflow-hidden rounded-control px-2.75 py-1.75 whitespace-nowrap font-medium text-muted transition-colors hover:bg-surface-raised hover:text-content disabled:opacity-50';
</script>

<div class="flex flex-col gap-px border-t border-subtle px-2.5 py-2">
	<a href="/settings" class={row} title={open ? name : undefined}>
		<Icon name="user" size={16} label={open ? undefined : name} />
		{#if open}
			<span class="min-w-0 truncate text-sm font-semibold text-content">{name}</span>
		{/if}
	</a>
	<button type="button" class={row} disabled={busy} onclick={leave}>
		<Icon name="signout" size={16} label={open ? undefined : 'Sign out'} />
		{#if open}
			<span class="text-sm">Sign out</span>
		{/if}
	</button>
</div>
