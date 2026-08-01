<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createCategory, deleteCategory, updateCategory } from '$lib/api';
	import { setStreakGraceDays } from '$lib/api/settings';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { button, field, sectionHeading } from '$lib/components/ui';
	import { stagger } from '$lib/motion';
	import { categoryColor } from '$lib/theme/category';
	import {
		theme,
		THEME_LABELS,
		THEME_PREVIEWS,
		THEMES,
		type ThemeName
	} from '$lib/theme/theme.svelte';

	let { data } = $props();

	let actionError = $state<unknown>(null);
	let busy = $state(false);
	let newCategoryName = $state('');
	let editingId = $state<number | null>(null);
	let editingName = $state('');
	let deleting = $state<{ id: number; name: string } | null>(null);

	async function run(action: () => Promise<unknown>) {
		busy = true;
		actionError = null;
		try {
			await action();
			await invalidateAll();
		} catch (error) {
			actionError = error;
		} finally {
			busy = false;
		}
	}

	async function pickTheme(name: ThemeName) {
		busy = true;
		actionError = null;
		try {
			await theme.set(name);
		} catch (error) {
			actionError = error;
		} finally {
			busy = false;
		}
	}

	async function addCategory(event: SubmitEvent) {
		event.preventDefault();
		const name = newCategoryName.trim();
		if (!name) return;
		newCategoryName = '';
		await run(() => createCategory({ name, colorToken: null }));
	}

	async function saveEditing(event: SubmitEvent) {
		event.preventDefault();
		if (editingId === null) return;

		const id = editingId;
		const category = data.categories.find((entry) => entry.id === id);
		await run(() =>
			updateCategory(id, { name: editingName, colorToken: category?.colorToken ?? null })
		);
		if (!actionError) editingId = null;
	}

	async function removeCategory() {
		const target = deleting;
		if (!target) return;
		deleting = null;
		await run(() => deleteCategory(target.id));
	}

	const grace = $derived(data.settings?.streakGraceDays ?? 2);

	/** The schema and the backend both cap this at 0–7; the buttons just agree. */
	async function nudgeGrace(delta: number) {
		if (!data.settings) return;
		const next = Math.min(7, Math.max(0, grace + delta));
		if (next === grace) return;
		await run(() => setStreakGraceDays(next));
	}
</script>

<svelte:head><title>Settings · Mushpoint</title></svelte:head>

<header class="mb-6">
	<h1 class="mb-1 font-display text-3xl font-bold">Settings</h1>
	<p class="text-sm text-muted">How Mushpoint looks and what it tracks</p>
</header>

{#if actionError}
	<div class="mb-4"><ErrorBanner error={actionError} onDismiss={() => (actionError = null)} /></div>
{/if}
{#if data.error}
	<div class="mb-4"><ErrorBanner error={data.error} /></div>
{/if}

<section class="mb-8">
	<h2 class="{sectionHeading} mb-3">Theme</h2>
	<div class="flex flex-wrap gap-3.5">
		{#each THEMES as name (name)}
			{@const preview = THEME_PREVIEWS[name]}
			<button
				type="button"
				disabled={busy}
				onclick={() => pickTheme(name)}
				aria-pressed={theme.current === name}
				class="w-[220px] rounded-2xl border-2 p-1 transition-transform duration-150 hover:-translate-y-0.5 {theme.current ===
				name
					? 'border-accent'
					: 'border-transparent'}"
			>
				<span class="block overflow-hidden rounded-xl border border-subtle">
					<span class="flex h-[60px] items-center gap-2 px-3.5" style="background:{preview.bg}">
						{#each preview.accents as swatch (swatch)}
							<span class="size-3.5 rounded-full" style="background:{swatch}"></span>
						{/each}
					</span>
					<span class="block px-3 py-3 text-left" style="background:{preview.surface}">
						<span class="text-[13.5px] font-bold" style="color:{preview.text}">
							{THEME_LABELS[name]}
						</span>
					</span>
				</span>
			</button>
		{/each}
	</div>
</section>

<section class="mb-8">
	<h2 class="{sectionHeading} mb-3">Categories</h2>
	<div class="flex max-w-[420px] flex-col gap-2">
		{#each data.categories as category, index (category.id)}
			<div
				class="mp-enter flex items-center gap-2.5 rounded-[10px] border border-subtle bg-surface px-3.5 py-2.5"
				style="--mp-delay:{stagger(index, 30)}"
			>
				{#if editingId === category.id}
					<form class="flex flex-1 gap-2" onsubmit={saveEditing}>
						<input
							class="{field.input} py-1.5 text-[13.5px]"
							bind:value={editingName}
							required
							aria-label="Rename {category.name}"
						/>
						<button type="submit" class={button.ghost} disabled={busy}>Save</button>
						<button type="button" class={button.ghost} onclick={() => (editingId = null)}>
							Cancel
						</button>
					</form>
				{:else}
					<span
						class="size-2.5 rounded-full"
						style="background:{categoryColor(category.colorToken)}"
						aria-hidden="true"
					></span>
					<span class="flex-1 text-[13.5px]">{category.name}</span>
					{#if category.isDefault}
						<span class="text-[11px] text-muted">default</span>
					{/if}
					<button
						type="button"
						class={button.bare}
						onclick={() => {
							editingId = category.id;
							editingName = category.name;
						}}
					>
						<Icon name="edit" size={14} label="Rename {category.name}" />
					</button>
					<button
						type="button"
						class={button.bare}
						disabled={busy}
						onclick={() => (deleting = { id: category.id, name: category.name })}
					>
						<Icon name="trash" size={14} label="Delete {category.name}" />
					</button>
				{/if}
			</div>
		{/each}

		<form onsubmit={addCategory}>
			<input
				class="{field.dashed} w-full"
				bind:value={newCategoryName}
				placeholder="+ Add category…"
				aria-label="New category name"
			/>
		</form>
	</div>
</section>

<section class="mb-8">
	<h2 class="{sectionHeading} mb-3">Streaks</h2>
	<div class="flex max-w-[420px] items-center gap-4 rounded-xl border border-subtle bg-surface p-4">
		<div class="flex-1">
			<div class="mb-0.5 text-[13.5px] font-semibold">Grace period</div>
			<div class="text-xs text-muted">Missing days within this window won't break a streak</div>
		</div>
		<button
			type="button"
			class={button.icon}
			disabled={busy || !data.settings || grace === 0}
			aria-label="Decrease grace period"
			onclick={() => nudgeGrace(-1)}
		>
			<Icon name="minus" size={13} />
		</button>
		<span class="min-w-[52px] text-center text-[15px] font-bold tabular-nums">
			{#if data.settings}
				{grace}
				{grace === 1 ? 'day' : 'days'}
			{:else}
				&mdash;
			{/if}
		</span>
		<button
			type="button"
			class={button.icon}
			disabled={busy || !data.settings || grace === 7}
			aria-label="Increase grace period"
			onclick={() => nudgeGrace(1)}
		>
			<Icon name="plus" size={13} />
		</button>
	</div>
</section>

<section>
	<h2 class="{sectionHeading} mb-3">About</h2>
	<p class="text-[13px] text-muted">Mushpoint · v0.1.0 · local-first, no cloud sync</p>
</section>

<ConfirmDialog
	open={deleting !== null}
	title="Delete “{deleting?.name ?? ''}”?"
	body="Goals in this category become uncategorized. This cannot be undone."
	{busy}
	onConfirm={removeCategory}
	onCancel={() => (deleting = null)}
/>
