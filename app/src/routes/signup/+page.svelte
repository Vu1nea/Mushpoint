<script lang="ts">
	import { AppError } from '$lib/api/error';
	import { resendConfirmation, signUp } from '$lib/auth/session.svelte';
	import AuthSheet from '$lib/components/auth/AuthSheet.svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';
	import PasswordInput from '$lib/components/ui/PasswordInput.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button, field } from '$lib/components/ui';

	const MIN_PASSWORD = 8;

	let email = $state('');
	let password = $state('');
	let confirm = $state('');
	let busy = $state(false);
	let error = $state<unknown>(null);
	let sent = $state(false);
	let resent = $state(false);

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
			await signUp(email.trim(), password);
			sent = true;
		} catch (e) {
			error = e;
		} finally {
			busy = false;
		}
	}

	async function resend() {
		busy = true;
		error = null;
		try {
			await resendConfirmation(email.trim());
			resent = true;
		} catch (e) {
			error = e;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Create an account · Mushpoint</title></svelte:head>

<AuthSheet>
	{#if error}
		<div class="mb-4"><ErrorBanner {error} onDismiss={() => (error = null)} /></div>
	{/if}

	{#if sent}
		<h1 class="mb-1 font-display text-xl font-bold">Check your email to confirm your account</h1>
		<p class="mb-6 text-sm text-muted">
			We sent a link to <span class="font-semibold wrap-anywhere text-content">{email.trim()}</span
			>. Open it in this browser to finish signing up.
		</p>
		{#if resent}
			<p class="mb-4 text-sm text-muted" role="status">We sent it again.</p>
		{/if}
		<button
			type="button"
			class="{button.ghost} w-full"
			disabled={busy}
			aria-busy={busy}
			onclick={resend}
		>
			{#if busy}<Spinner />{/if}
			Resend email
		</button>
		<p class="mt-6 border-t border-subtle pt-4 text-sm">
			<a class="font-semibold text-accent-ink" href="/login">Back to sign in</a>
		</p>
	{:else}
		<h1 class="mb-1 font-display text-xl font-bold">Create an account</h1>
		<p class="mb-6 text-sm text-muted">Start tracking your goals with Mushpoint</p>

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
				<PasswordInput autocomplete="new-password" name="password" bind:value={password} required />
			</label>
			<label>
				<span class={field.label}>Confirm password</span>
				<PasswordInput
					autocomplete="new-password"
					name="confirm-password"
					bind:value={confirm}
					required
				/>
			</label>
			<button type="submit" class="{button.primary} mt-1 w-full" disabled={busy} aria-busy={busy}>
				{#if busy}<Spinner />{/if}
				Create account
			</button>
		</form>

		<p class="mt-6 border-t border-subtle pt-4 text-sm text-muted">
			Already have an account? <a class="font-semibold text-accent-ink" href="/login">Sign in</a>
		</p>
	{/if}
</AuthSheet>
