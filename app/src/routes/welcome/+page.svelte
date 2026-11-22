<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import mushIcon from '$lib/assets/mush-icon.webp';
	import { setUsername } from '$lib/api/account';
	import { AppError } from '$lib/api/error';
	import { USERNAME_PATTERN } from '$lib/api/types';
	import { signOut } from '$lib/auth/session.svelte';
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

<div class="mp-enter w-full max-w-sm rounded-card border border-subtle bg-surface p-7">
	<img
		src={mushIcon}
		alt=""
		width="40"
		height="40"
		class="mb-4 size-10 rounded-full object-cover"
		aria-hidden="true"
	/>
	<h1 class="mb-1 font-display text-2xl font-bold">Pick a username</h1>
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

	<button type="button" class="mt-5 text-sm text-muted hover:text-content" onclick={leave}>
		Sign out
	</button>
</div>
