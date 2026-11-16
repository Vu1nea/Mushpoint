<script lang="ts">
	import mushIcon from '$lib/assets/mush-icon.png';
	import { AppError } from '$lib/api/error';
	import { resendConfirmation, signUp } from '$lib/auth/session.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
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

<div class="mp-enter w-full max-w-sm rounded-card border border-subtle bg-surface p-7">
	<img src={mushIcon} alt="" class="mb-4 size-10 rounded-full object-cover" aria-hidden="true" />

	{#if error}
		<div class="mb-4"><ErrorBanner {error} onDismiss={() => (error = null)} /></div>
	{/if}

	{#if sent}
		<h1 class="mb-1 font-display text-2xl font-bold">Check your email to confirm your account</h1>
		<p class="mb-6 text-sm text-muted">
			We sent a link to <span class="font-semibold text-content">{email.trim()}</span>. Open it in
			this browser to finish signing up.
		</p>
		{#if resent}
			<p class="mb-4 text-sm text-muted" role="status">We sent it again.</p>
		{/if}
		<button type="button" class="{button.ghost} w-full" disabled={busy} onclick={resend}>
			Resend email
		</button>
		<p class="mt-5 text-sm">
			<a class="font-semibold text-accent" href="/login">Back to sign in</a>
		</p>
	{:else}
		<h1 class="mb-1 font-display text-2xl font-bold">Create an account</h1>
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
			<button type="submit" class="{button.primary} mt-1 w-full" disabled={busy}>
				Create account
			</button>
		</form>

		<p class="mt-5 text-sm text-muted">
			Already have an account? <a class="font-semibold text-accent" href="/login">Sign in</a>
		</p>
	{/if}
</div>
