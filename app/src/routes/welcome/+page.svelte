<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { setUsername } from '$lib/api/account';
	import { AppError } from '$lib/api/error';
	import { USERNAME_PATTERN } from '$lib/api/types';
	import { signOut } from '$lib/auth/session.svelte';
	import AuthSheet from '$lib/components/auth/AuthSheet.svelte';
	import ErrorBanner from '$lib/components/ui/ErrorBanner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button, field } from '$lib/components/ui';

	let username = $state('');
	let busy = $state(false);
	/** Signing out also sets `busy`, but the spinner belongs to Continue only. */
	let leaving = $state(false);
	const saving = $derived(busy && !leaving);
	let error = $state<unknown>(null);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		const name = username.trim();
		if (!USERNAME_PATTERN.test(name)) {
			error = AppError.validation('Use 3 to 30 letters, numbers, underscores or dots.');
			return;
		}
		busy = true;
		try {
			await setUsername(name);
			await invalidateAll();
			await goto('/', { replaceState: true });
		} catch (e) {
			error = e;
		} finally {
			busy = false;
		}
	}

	async function leave() {
		leaving = true;
		busy = true;
		try {
			await signOut();
		} catch {
			// Signed out locally either way.
		}
		await goto('/login', { replaceState: true });
	}
</script>

<svelte:head><title>Welcome · Mushpoint</title></svelte:head>

<AuthSheet>
	<h1 class="mb-1 font-display text-xl font-bold">Pick a username</h1>
	<p class="mb-6 text-sm text-muted">
		This is how Mushpoint will greet you. You can change it later.
	</p>

	{#if error}
		<div class="mb-4"><ErrorBanner {error} onDismiss={() => (error = null)} /></div>
	{/if}

	<form class="flex flex-col gap-4" onsubmit={submit}>
		<label>
			<span class={field.label}>Username</span>
			<input
				class={field.input}
				autocomplete="username"
				autocapitalize="none"
				spellcheck="false"
				maxlength="30"
				name="username"
				bind:value={username}
				required
			/>
		</label>
		<button type="submit" class="{button.primary} mt-1 w-full" disabled={busy} aria-busy={saving}>
			{#if saving}<Spinner />{/if}
			Continue
		</button>
	</form>

	<button
		type="button"
		class="mt-6 w-full border-t border-subtle pt-4 text-left text-sm text-muted hover:text-content focus-visible:outline-2 focus-visible:outline-accent"
		onclick={leave}
	>
		Sign out
	</button>
</AuthSheet>
