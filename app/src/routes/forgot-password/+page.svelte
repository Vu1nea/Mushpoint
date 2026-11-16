<script lang="ts">
	import mushIcon from '$lib/assets/mush-icon.png';
	import { requestPasswordReset } from '$lib/auth/session.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
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

<div class="mp-enter w-full max-w-sm rounded-card border border-subtle bg-surface p-7">
	<img src={mushIcon} alt="" class="mb-4 size-10 rounded-full object-cover" aria-hidden="true" />
	<h1 class="mb-1 font-display text-2xl font-bold">Reset your password</h1>

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

	<p class="mt-5 text-sm">
		<a class="font-semibold text-accent" href="/login">Back to sign in</a>
	</p>
</div>
