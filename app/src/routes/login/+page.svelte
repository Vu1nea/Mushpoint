<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import mushIcon from '$lib/assets/mush-icon.png';
	import { safeNext } from '$lib/auth/routes';
	import { EMAIL_NOT_CONFIRMED, resendConfirmation, signIn } from '$lib/auth/session.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import { button, field } from '$lib/components/ui';

	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state<unknown>(null);
	let resent = $state(false);

	const deleted = $derived(page.url.searchParams.get('deleted'));
	const unconfirmed = $derived(error instanceof Error && error.message === EMAIL_NOT_CONFIRMED);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		resent = false;
		try {
			await signIn(email.trim(), password);
			await goto(safeNext(page.url.searchParams.get('next')), { replaceState: true });
		} catch (e) {
			error = e;
		} finally {
			busy = false;
		}
	}

	async function resend() {
		busy = true;
		try {
			await resendConfirmation(email.trim());
			resent = true;
			error = null;
		} catch (e) {
			error = e;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Sign in · Mushpoint</title></svelte:head>

<div class="mp-enter w-full max-w-sm rounded-card border border-subtle bg-surface p-7">
	<img src={mushIcon} alt="" class="mb-4 size-10 rounded-full object-cover" aria-hidden="true" />
	<h1 class="mb-1 font-display text-2xl font-bold">Sign in</h1>
	<p class="mb-6 text-sm text-muted">Welcome back to Mushpoint</p>

	{#if deleted === '1'}
		<p class="mb-4 text-sm text-muted" role="status">Your account was deleted.</p>
	{:else if deleted === 'pending'}
		<p class="mb-4 text-sm text-muted" role="status">
			We couldn't finish deleting your account. Sign in again to retry.
		</p>
	{/if}
	{#if error}
		<div class="mb-4"><ErrorBanner {error} onDismiss={() => (error = null)} /></div>
	{/if}
	{#if unconfirmed}
		<button type="button" class="{button.ghost} mb-4 w-full" disabled={busy} onclick={resend}>
			Resend email
		</button>
	{/if}
	{#if resent}
		<p class="mb-4 text-sm text-muted" role="status">
			We sent a new confirmation link. Check your inbox.
		</p>
	{/if}

	<form class="flex flex-col gap-4" onsubmit={submit}>
		<label>
			<span class={field.label}>Email</span>
			<input
				class={field.input}
				type="email"
				autocomplete="email"
				name="email"
				bind:value={email}
				required
			/>
		</label>
		<label>
			<span class={field.label}>Password</span>
			<PasswordInput
				autocomplete="current-password"
				name="password"
				bind:value={password}
				required
			/>
		</label>
		<button type="submit" class="{button.primary} mt-1 w-full" disabled={busy}>Sign in</button>
	</form>

	<div class="mt-5 flex justify-between text-sm">
		<a class="text-muted hover:text-content" href="/forgot-password">Forgot password?</a>
		<a class="font-semibold text-accent" href="/signup">Create an account</a>
	</div>
</div>
