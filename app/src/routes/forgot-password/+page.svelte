<script lang="ts">
	import { requestPasswordReset } from '$lib/auth/session.svelte';
	import AuthSheet from '$lib/components/auth/AuthSheet.svelte';
	import ErrorBanner from '$lib/components/ui/ErrorBanner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button, field } from '$lib/components/ui';

	let email = $state('');
	let busy = $state(false);
	let error = $state<unknown>(null);
	let sent = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		try {
			await requestPasswordReset(email.trim());
			sent = true;
		} catch (e) {
			error = e;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Reset password · Mushpoint</title></svelte:head>

<AuthSheet>
	<h1 class="mb-1 font-display text-xl font-bold">Reset your password</h1>

	{#if sent}
		<p class="mb-6 text-sm text-muted" role="status">
			If an account exists for that email, we sent a reset link.
		</p>
	{:else}
		<p class="mb-6 text-sm text-muted">We'll email you a link to choose a new one</p>

		{#if error}
			<div class="mb-4"><ErrorBanner {error} onDismiss={() => (error = null)} /></div>
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
			<button type="submit" class="{button.primary} mt-1 w-full" disabled={busy} aria-busy={busy}>
				{#if busy}<Spinner />{/if}
				Send reset link
			</button>
		</form>
	{/if}

	<p class="mt-6 border-t border-subtle pt-4 text-sm">
		<a class="font-semibold text-accent-ink" href="/login">Back to sign in</a>
	</p>
</AuthSheet>
