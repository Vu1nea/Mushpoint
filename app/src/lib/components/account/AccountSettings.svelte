<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import {
		deleteAccount,
		exportAccount,
		removeAvatar,
		setAvatar,
		setUsername
	} from '$lib/api/account';
	import { AppError } from '$lib/api/error';
	import { USERNAME_PATTERN } from '$lib/api/types';
	import { auth, changeEmail, changePassword, signOut } from '$lib/auth/session.svelte';
	import { downloadJson, exportFilename, withSignInEmail } from '$lib/download';
	import { ACCEPTED_IMAGE_TYPES } from '$lib/images';
	import Avatar from './Avatar.svelte';
	import ConfirmDialog from '../ui/ConfirmDialog.svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';
	import Spinner from '../ui/Spinner.svelte';
	import SectionHeader from 'mushpoint-design/svelte/SectionHeader.svelte';
	import { button, field } from '../ui';

	interface Props {
		username: string | null;
		avatarUrl: string | null;
	}

	let { username, avatarUrl }: Props = $props();

	const MIN_PASSWORD = 8;

	let error = $state<unknown>(null);
	let notice = $state<string | null>(null);
	/** The form whose request is in flight; every form is disabled while one runs. */
	let pending = $state<'avatar' | 'profile' | 'password' | 'export' | null>(null);
	const busy = $derived(pending !== null);

	let nameDraft = $state('');
	let emailDraft = $state('');
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	// Drafts follow the saved values whenever those change (load, save, sign-in).
	$effect.pre(() => {
		nameDraft = username ?? '';
	});
	$effect.pre(() => {
		emailDraft = auth.email ?? '';
	});

	let deleteOpen = $state(false);
	let deleteTyped = $state('');
	let deleting = $state(false);
	/** Emails are case-insensitive, so the typed address only has to match loosely. */
	const normalizeEmail = (email: string) => email.trim().toLowerCase();
	const deleteConfirmed = $derived(
		auth.email !== null && normalizeEmail(deleteTyped) === normalizeEmail(auth.email)
	);

	const nameDirty = $derived(nameDraft.trim() !== (username ?? ''));
	const emailDirty = $derived(normalizeEmail(emailDraft) !== normalizeEmail(auth.email ?? ''));
	const profileDirty = $derived(nameDirty || emailDirty);

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

	let fileInput = $state<HTMLInputElement>();

	async function pickAvatar(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		// Cleared so choosing the same file again still fires `change`.
		input.value = '';
		if (!file) return;
		// The layout reloads the profile, so every avatar shows the new picture.
		await run(
			'avatar',
			() => setAvatar(file).then(() => invalidateAll()),
			'Profile picture updated.'
		);
	}

	async function clearAvatar() {
		await run(
			'avatar',
			() => removeAvatar().then(() => invalidateAll()),
			'Profile picture removed.'
		);
	}

	function resetProfile() {
		nameDraft = username ?? '';
		emailDraft = auth.email ?? '';
	}

	async function saveProfile(event: SubmitEvent) {
		event.preventDefault();
		const name = nameDraft.trim();
		const email = emailDraft.trim();
		if (nameDirty && !USERNAME_PATTERN.test(name)) {
			error = AppError.validation('Use 3 to 30 letters, numbers, underscores or dots.');
			notice = null;
			return;
		}
		const changeName = nameDirty;
		const changeMail = emailDirty;
		const saved = await run(
			'profile',
			async () => {
				// The layout reloads the profile, so the sidebar shows the new name.
				if (changeName) await setUsername(name).then(() => invalidateAll());
				if (changeMail) await changeEmail(email);
			},
			changeMail ? 'Check both inboxes to confirm the email change.' : 'Profile saved.'
		);
		// The current address stays until both inboxes confirm; the pending one shows below.
		if (saved && changeMail) emailDraft = auth.email ?? '';
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

	async function downloadData() {
		await run(
			'export',
			async () =>
				downloadJson(exportFilename(), withSignInEmail(await exportAccount(), auth.email)),
			'Your data was downloaded.'
		);
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

{#if error}
	<div class="mb-4 px-4"><ErrorBanner {error} onDismiss={() => (error = null)} /></div>
{/if}
{#if notice}
	<p class="mb-4 px-4 text-sm text-muted" role="status">{notice}</p>
{/if}

<section class="mb-6 border-b border-subtle pb-6">
	<SectionHeader title="Profile" />
	<div class="my-5 flex items-center gap-4 px-4">
		<Avatar name={username ?? auth.email ?? ''} url={avatarUrl} class="size-16 text-2xl" />
		<div class="flex min-w-0 flex-col gap-1.5">
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class={button.ghost}
					disabled={busy}
					aria-busy={pending === 'avatar'}
					onclick={() => fileInput?.click()}
				>
					{#if pending === 'avatar'}<Spinner />{/if}
					{avatarUrl ? 'Change picture' : 'Upload picture'}
				</button>
				{#if avatarUrl}
					<button type="button" class={button.ghost} disabled={busy} onclick={clearAvatar}>
						Remove
					</button>
				{/if}
			</div>
			<p class="text-xs text-muted">PNG, JPEG, WebP or GIF, up to 5 MB.</p>
		</div>
		<input
			bind:this={fileInput}
			type="file"
			accept={ACCEPTED_IMAGE_TYPES.join(',')}
			class="hidden"
			aria-label="Profile picture"
			onchange={pickAvatar}
		/>
	</div>
	<form class="flex flex-col gap-4 px-4" onsubmit={saveProfile}>
		<label>
			<span class={field.label}>Username</span>
			<input
				class={field.input}
				name="username"
				bind:value={nameDraft}
				autocomplete="username"
				autocapitalize="none"
				spellcheck="false"
				maxlength="30"
				required
			/>
		</label>
		<label>
			<span class={field.label}>Email</span>
			<input
				class={field.input}
				type="email"
				name="email"
				bind:value={emailDraft}
				autocomplete="email"
				required
			/>
			{#if auth.pendingEmail}
				<span class="mt-1.5 block text-xs wrap-anywhere text-muted" role="status">
					Changing to <strong class="text-content">{auth.pendingEmail}</strong>, waiting for
					confirmation from both inboxes.
				</span>
			{/if}
		</label>
		{#if profileDirty || pending === 'profile'}
			<div class="flex justify-end gap-2">
				<button type="button" class={button.ghost} disabled={busy} onclick={resetProfile}>
					Cancel
				</button>
				<button
					type="submit"
					class={button.primary}
					disabled={busy}
					aria-busy={pending === 'profile'}
				>
					{#if pending === 'profile'}<Spinner />{/if}
					{pending === 'profile' ? 'Saving…' : 'Save'}
				</button>
			</div>
		{/if}
	</form>
</section>

<section class="mb-6 border-b border-subtle pb-6">
	<SectionHeader title="Password" />
	<form class="mt-5 flex flex-col gap-4 px-4" onsubmit={savePassword}>
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
		<div class="flex justify-end">
			<button type="submit" class={button.ghost} disabled={busy} aria-busy={pending === 'password'}>
				{#if pending === 'password'}<Spinner />{/if}
				{pending === 'password' ? 'Saving…' : 'Update password'}
			</button>
		</div>
	</form>
</section>

<section class="mb-6">
	<SectionHeader title="Your data" />
	<div class="flex flex-wrap items-center gap-4 px-4 pt-4">
		<div class="min-w-48 flex-1">
			<div class="mb-0.5 text-md font-semibold">Download your data</div>
			<p class="text-xs text-muted">
				A JSON file with your profile, settings, goals, tasks, habits, ideas and vision board. Links
				to your images in it work for 24 hours.
			</p>
		</div>
		<button
			type="button"
			class={button.ghost}
			disabled={busy}
			aria-busy={pending === 'export'}
			onclick={downloadData}
		>
			{#if pending === 'export'}<Spinner />{/if}
			{pending === 'export' ? 'Preparing…' : 'Download my data'}
		</button>
	</div>
</section>

<section class="border-t border-danger/40 pt-6 pb-6">
	<SectionHeader title="Danger zone" />
	<div class="flex flex-wrap items-center gap-4 px-4 pt-4">
		<div class="min-w-48 flex-1">
			<div class="mb-0.5 text-md font-semibold">Delete account</div>
			<div class="text-xs text-muted">Removes your login and everything you track</div>
		</div>
		<button type="button" class={button.danger} disabled={busy} onclick={openDelete}>
			Delete account
		</button>
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
		<span class="{field.label} wrap-anywhere">Type <strong>{auth.email}</strong> to confirm</span>
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
