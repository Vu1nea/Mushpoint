<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createCategory, deleteCategory, updateCategory } from '$lib/api';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { button, card, field } from '$lib/components/ui';
	import {
		theme,
		THEME_LABELS,
		THEME_SWATCHES,
		THEMES,
		type ThemeName
	} from '$lib/theme/theme.svelte';

	let { data } = $props();

	let actionError = $state<unknown>(null);
	let busy = $state(false);
	let newCategoryName = $state('');
	let editingId = $state<number | null>(null);
	let editingName = $state('');

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
		const name = newCategoryName;
		newCategoryName = '';
		await run(() => createCategory({ name, colorToken: null }));
	}

	function startEditing(id: number, name: string) {
		editingId = id;
		editingName = name;
	}

	async function saveEditing(event: SubmitEvent) {
		event.preventDefault();
		if (editingId === null) return;
		await run(() => updateCategory(editingId!, { name: editingName, colorToken: null }));
		if (!actionError) editingId = null;
	}

	async function removeCategory(id: number, name: string) {
		if (!confirm(`Delete “${name}”? Goals in it become uncategorized.`)) return;
		await run(() => deleteCategory(id));
	}
</script>

<svelte:head><title>Settings · Mushpoint</title></svelte:head>

<h1 class="mb-6 text-2xl font-semibold">Settings</h1>

{#if actionError}
	<div class="mb-4"><ErrorBanner error={actionError} onDismiss={() => (actionError = null)} /></div>
{/if}
{#if data.error}
	<div class="mb-4"><ErrorBanner error={data.error} /></div>
{/if}

<section class="mb-8">
	<h2 class="mb-1 text-lg font-medium">Theme</h2>
	<p class="mb-3 text-sm text-muted">Applies everywhere and is remembered between launches.</p>

	<div class="grid gap-3 sm:grid-cols-2">
		{#each THEMES as name (name)}
			<button
				type="button"
				disabled={busy}
				onclick={() => pickTheme(name)}
				aria-pressed={theme.current === name}
				class="rounded-xl border p-4 text-left transition-colors
					{theme.current === name ? 'border-accent' : 'border-subtle hover:border-accent/60'}"
			>
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium">{THEME_LABELS[name]}</span>
					{#if theme.current === name}
						<Icon name="check" size={16} class="text-accent" />
					{/if}
				</div>
				<div class="mt-3 flex gap-1.5">
					{#each THEME_SWATCHES[name] as swatch (swatch)}
						<span
							class="size-6 rounded-full border border-subtle"
							style="background-color: {swatch}"
							aria-hidden="true"
						></span>
					{/each}
				</div>
			</button>
		{/each}
	</div>
</section>

<section>
	<h2 class="mb-1 text-lg font-medium">Categories</h2>
	<p class="mb-3 text-sm text-muted">
		The five defaults ship with the app; add your own or rename any of them.
	</p>

	<ul class="{card} mb-3 grid">
		{#each data.categories as category (category.id)}
			<li class="flex items-center gap-3 border-b border-subtle py-2 last:border-b-0">
				{#if editingId === category.id}
					<form class="flex flex-1 gap-2" onsubmit={saveEditing}>
						<input
							class="{field.input} py-1 text-sm"
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
					<span class="flex-1 text-sm">{category.name}</span>
					{#if category.isDefault}
						<span class="text-xs text-muted">default</span>
					{/if}
					<button
						type="button"
						class={button.icon}
						onclick={() => startEditing(category.id, category.name)}
					>
						<Icon name="edit" size={15} label="Rename {category.name}" />
					</button>
					<button
						type="button"
						class={button.icon}
						disabled={busy}
						onclick={() => removeCategory(category.id, category.name)}
					>
						<Icon name="trash" size={15} label="Delete {category.name}" />
					</button>
				{/if}
			</li>
		{/each}
	</ul>

	<form class="flex gap-2" onsubmit={addCategory}>
		<input
			class="{field.input} py-1.5 text-sm"
			bind:value={newCategoryName}
			placeholder="New category"
			required
			aria-label="New category name"
		/>
		<button type="submit" class={button.ghost} disabled={busy}>
			<Icon name="plus" size={15} /> Add
		</button>
	</form>
</section>
