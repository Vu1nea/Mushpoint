<script lang="ts">
	import { onMount } from 'svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import mushIcon from '$lib/assets/mush-icon.webp';
	import { AppError } from '$lib/api/error';
	import { completeCallback, setNewPassword, type CallbackResult } from '$lib/auth/session.svelte';
	import ErrorBanner from '$lib/components/ui/ErrorBanner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button, field } from '$lib/components/ui';

	const MIN_PASSWORD = 8;

	let status = $state<'working' | 'recovery' | 'error'>('working');
	let password = $state('');
	let confirm = $state('');
	let busy = $state(false);
	let error = $state<unknown>(null);

	onMount(async () => {
		let result: CallbackResult;
		try {
			result = await completeCallback(page.url);
		} catch {
			result = 'error';
		}
		if (result === 'signed_in') await goto('/', { replaceState: true });
		else if (result === 'email_changed') await goto('/settings', { replaceState: true });
		else status = result;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		if (password.length < MIN_PASSWORD) {
			error = AppError.validation(`Use at least ${MIN_PASSWORD} characters for your password.`);
			return;
		}
		if (password !== confirm) {
			error = AppError.validation('The passwords do not match.');
			return;
		}
		busy = true;
		try {
			await setNewPassword(password);
			await goto('/', { replaceState: true });
		} catch (e) {
			error = e;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Mushpoint</title></svelte:head>

<div class="mp-enter w-full max-w-sm rounded-card border border-subtle bg-surface p-7">
	<img
		src={mushIcon}
		alt=""
		width="40"
		height="40"
		class="mb-4 size-10 rounded-full object-cover"
		aria-hidden="true"
	/>

	{#if status === 'working'}
		<p class="text-sm text-muted" role="status">Signing you in…</p>
	{:else if status === 'recovery'}
		<h1 class="mb-1 font-display text-2xl font-bold">Choose a new password</h1>
		<p class="mb-6 text-sm text-muted">You'll stay signed in afterwards</p>

		{#if error}
			<div class="mb-4"><ErrorBanner {error} onDismiss={() => (error = null)} /></div>
		{/if}

		<form class="flex flex-col gap-4" onsubmit={submit}>
			<label>
				<span class={field.label}>New password</span>
				<input
					class={field.input}
					type="password"
					autocomplete="new-password"
					name="password"
					bind:value={password}
					required
				/>
			</label>
			<label>
				<span class={field.label}>Confirm new password</span>
				<input
					class={field.input}
					type="password"
					autocomplete="new-password"
					name="confirm-password"
					bind:value={confirm}
					required
				/>
			</label>
			<button type="submit" class="{button.primary} mt-1 w-full" disabled={busy} aria-busy={busy}>
				{#if busy}<Spinner />{/if}
				Save password
			</button>
		</form>
	{:else}
		<h1 class="mb-1 font-display text-2xl font-bold">This link didn't work</h1>
		<p class="mb-6 text-sm text-muted">
			It may have expired, been used already, or been opened in a different browser than the one you
			requested it from.
		</p>
		<a class="{button.primary} w-full" href="/login">Go to sign in</a>
	{/if}
</div>
