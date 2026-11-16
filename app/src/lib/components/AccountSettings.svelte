<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { deleteAccount, setUsername } from '$lib/api/account';
	import { AppError } from '$lib/api/error';
	import { USERNAME_PATTERN } from '$lib/api/types';
	import { auth, changeEmail, changePassword, signOut } from '$lib/auth/session.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import ErrorBanner from './ErrorBanner.svelte';
	import Icon from './Icon.svelte';
	import Spinner from './Spinner.svelte';
	import { button, field, sectionHeading } from './ui';

	interface Props {
		username: string | null;
	}

	let { username }: Props = $props();

	const MIN_PASSWORD = 8;
	const card = 'rounded-card border border-subtle bg-surface p-4.5';

	let error = $state<unknown>(null);
	let notice = $state<string | null>(null);
	/** The form whose request is in flight; every form is disabled while one runs. */
	let pending = $state<'name' | 'email' | 'password' | null>(null);
	const busy = $derived(pending !== null);

	let editingName = $state(false);
	let nameDraft = $state('');
	let newEmail = $state('');
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	let deleteOpen = $state(false);
	let deleteTyped = $state('');
	let deleting = $state(false);
	/** Emails are case-insensitive, so the typed address only has to match loosely. */
	const normalizeEmail = (email: string) => email.trim().toLowerCase();
	const deleteConfirmed = $derived(
		auth.email !== null && normalizeEmail(deleteTyped) === normalizeEmail(auth.email)
	);

	/** Runs one form's action, showing its failure or its success notice. */
	async function run(
		form: NonNullable<typeof pending>,
		action: () => Promise<unknown>,
		success: string | null = null
	) {
		pending = form;
		error = null;
		notice = null;
		try {
			await action();
			notice = success;
			return true;
		} catch (e) {
			error = e;
			return false;
		} finally {
			pending = null;
		}
	}

	async function saveName(event: SubmitEvent) {
		event.preventDefault();
		const name = nameDraft.trim();
		if (!USERNAME_PATTERN.test(name)) {
			error = AppError.validation('Use 3 to 30 letters, numbers, underscores or dots.');
			notice = null;
			return;
		}
		// The layout reloads the profile, so the sidebar shows the new name.
		if (await run('name', () => setUsername(name).then(() => invalidateAll()))) editingName = false;
	}

	async function saveEmail(event: SubmitEvent) {
		event.preventDefault();
		const email = newEmail.trim();
		// The pending address also stays under the current one until it is confirmed.
		if (await run('email', () => changeEmail(email), 'Check both inboxes to confirm the change.')) {
			newEmail = '';
		}
	}

	async function savePassword(event: SubmitEvent) {
		event.preventDefault();
		if (newPassword.length < MIN_PASSWORD) {
			error = AppError.validation(`Use at least ${MIN_PASSWORD} characters for your password.`);
			notice = null;
			return;
		}
		if (newPassword !== confirmPassword) {
			error = AppError.validation('The passwords do not match.');
			notice = null;
			return;
		}
		if (
			await run('password', () => changePassword(currentPassword, newPassword), 'Password changed.')
		) {
			currentPassword = newPassword = confirmPassword = '';
		}
	}

	function openDelete() {
		deleteTyped = '';
		deleteOpen = true;
	}

	async function removeAccount() {
		// The dialog disables the button, but the handler checks again on its own.
		if (!deleteConfirmed || deleting) return;
		deleting = true;
		error = null;
		try {
			await deleteAccount();
		} catch (e) {
			error = e;
			deleting = false;
			deleteOpen = false;
			return;
		}
		// The login is already gone on the server; only the local session is left.
		await signOut().catch(() => {});
		await goto('/login?deleted=1', { replaceState: true });
	}
</script>

<section class="mb-8">
	<h2 class="{sectionHeading} mb-3">Account</h2>

	{#if error}
		<div class="mb-3 max-w-105"><ErrorBanner {error} onDismiss={() => (error = null)} /></div>
	{/if}
	{#if notice}
		<p class="mb-3 max-w-105 text-sm text-muted" role="status">{notice}</p>
	{/if}

	<div class="flex max-w-105 flex-col gap-3">
		<div class={card}>
			<div class="mb-1.5 text-xs font-semibold text-muted">Username</div>
			{#if editingName}
				<form class="flex gap-2" onsubmit={saveName}>
					<input
						class="{field.input} py-1.5 text-md"
						name="username"
						bind:value={nameDraft}
						autocomplete="username"
						autocapitalize="none"
						spellcheck="false"
						maxlength="30"
						required
						aria-label="New username"
					/>
					<button type="submit" class={button.ghost} disabled={busy} aria-busy={pending === 'name'}>
						{#if pending === 'name'}<Spinner />{/if}
						{pending === 'name' ? 'Saving…' : 'Save'}
					</button>
					<button type="button" class={button.ghost} onclick={() => (editingName = false)}>
						Cancel
					</button>
				</form>
			{:else}
				<div class="flex items-center gap-2.5">
					<span class="flex-1 text-md">{username ?? '—'}</span>
					<button
						type="button"
						class={button.bare}
						onclick={() => {
							nameDraft = username ?? '';
							editingName = true;
						}}
					>
						<Icon name="edit" size={14} label="Change username" />
					</button>
				</div>
			{/if}
		</div>

		<form class={card} onsubmit={saveEmail}>
			<div class="mb-1.5 text-xs font-semibold text-muted">Email</div>
			<p class="mb-3 text-md">{auth.email ?? '—'}</p>
			{#if auth.pendingEmail}
				<p class="mb-3 text-xs text-muted" role="status">
					Changing to <strong class="text-content">{auth.pendingEmail}</strong>, waiting for
					confirmation from both inboxes.
				</p>
			{/if}
			<div class="flex items-end gap-2">
				<label class="flex-1">
					<span class={field.label}>New email</span>
					<input
						class="{field.input} py-1.5 text-md"
						type="email"
						autocomplete="email"
						name="email"
						bind:value={newEmail}
						required
					/>
				</label>
				<button type="submit" class={button.ghost} disabled={busy} aria-busy={pending === 'email'}>
					{#if pending === 'email'}<Spinner />{/if}
					{pending === 'email' ? 'Saving…' : 'Change'}
				</button>
			</div>
		</form>

		<form class="{card} flex flex-col gap-3" onsubmit={savePassword}>
			<div class="text-xs font-semibold text-muted">Password</div>
			<label>
				<span class={field.label}>Current password</span>
				<input
					class={field.input}
					type="password"
					autocomplete="current-password"
					name="current-password"
					bind:value={currentPassword}
					required
				/>
			</label>
			<label>
				<span class={field.label}>New password</span>
				<input
					class={field.input}
					type="password"
					autocomplete="new-password"
					name="new-password"
					bind:value={newPassword}
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
					bind:value={confirmPassword}
					required
				/>
			</label>
			<button
				type="submit"
				class="{button.ghost} self-start"
				disabled={busy}
				aria-busy={pending === 'password'}
			>
				{#if pending === 'password'}<Spinner />{/if}
				{pending === 'password' ? 'Saving…' : 'Change password'}
			</button>
		</form>

		<div class="{card} flex items-center gap-4">
			<div class="flex-1">
				<div class="mb-0.5 text-md font-semibold">Delete account</div>
				<div class="text-xs text-muted">Removes your login and everything you track</div>
			</div>
			<button type="button" class={button.danger} disabled={busy} onclick={openDelete}>
				Delete account
			</button>
		</div>
	</div>
</section>

<ConfirmDialog
	open={deleteOpen}
	title="Delete your account?"
	body="Your login, goals, tasks, ideas and vision board are deleted. This cannot be undone."
	confirmLabel="Delete account"
	busy={deleting}
	disabled={!deleteConfirmed}
	onConfirm={removeAccount}
	onCancel={() => {
		if (!deleting) deleteOpen = false;
	}}
>
	<label>
		<span class={field.label}>Type <strong>{auth.email}</strong> to confirm</span>
		<input
			class={field.input}
			type="email"
			autocomplete="off"
			spellcheck="false"
			name="confirm-email"
			bind:value={deleteTyped}
			aria-label="Type your email to confirm"
		/>
	</label>
</ConfirmDialog>
