<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { createCategory, deleteCategory, updateCategory, type Category } from '$lib/api';
	import { setStreakGraceDays } from '$lib/api/settings';
	import AccountSettings from '$lib/components/account/AccountSettings.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Tabs from '$lib/components/ui/Tabs.svelte';
	import { tabId, tabPanelId } from '$lib/components/ui/tabIds';
	import { button, field } from '$lib/components/ui';
	import { row } from 'mushpoint-design/utils/ui';
	import Pill from 'mushpoint-design/svelte/Pill.svelte';
	import SectionHeader from 'mushpoint-design/svelte/SectionHeader.svelte';
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import { stagger } from '$lib/motion';
	import { CATEGORY_COLOR_TOKENS, categoryColor } from '$lib/theme/category';
	import {
		theme,
		THEME_LABELS,
		THEME_PREVIEWS,
		THEMES,
		type ThemeName
	} from '$lib/theme/theme.svelte';

	let { data } = $props();

	const TABS = [
		{ value: 'account', label: 'Account' },
		{ value: 'appearance', label: 'Appearance' },
		{ value: 'tracking', label: 'Tracking' }
	] as const;
	type Tab = (typeof TABS)[number]['value'];

	/** The open tab lives in the URL, so it survives reloads and can be linked to. */
	const tab = $derived.by((): Tab => {
		const wanted = page.url.searchParams.get('tab');
		return TABS.find((t) => t.value === wanted)?.value ?? 'account';
	});

	function selectTab(next: Tab) {
		const url = new URL(page.url);
		if (next === 'account') url.searchParams.delete('tab');
		else url.searchParams.set('tab', next);
		goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	const panel = (value: Tab) => ({
		role: 'tabpanel',
		id: tabPanelId('settings', value),
		'aria-labelledby': tabId('settings', value)
	});

	let actionError = $state<unknown>(null);
	let busy = $state(false);
	let newCategoryName = $state('');
	let editingId = $state<number | null>(null);
	let editingName = $state('');
	let editingColor = $state<string | null>(null);
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

	function startEditing(category: Category) {
		editingId = category.id;
		editingName = category.name;
		editingColor = category.colorToken;
	}

	async function saveEditing(event: SubmitEvent) {
		event.preventDefault();
		if (editingId === null) return;

		const id = editingId;
		await run(() => updateCategory(id, { name: editingName, colorToken: editingColor }));
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

<PageHeader title="Settings" />

{#if actionError}
	<div class="page-gutter pb-4">
		<ErrorBanner error={actionError} onDismiss={() => (actionError = null)} />
	</div>
{/if}
{#if data.error}
	<div class="page-gutter pb-4"><ErrorBanner error={data.error} /></div>
{/if}

<Tabs
	tabs={TABS}
	value={tab}
	onChange={selectTab}
	id="settings"
	label="Settings sections"
	class="page-margin mb-2"
/>

<div class="max-w-2xl md:px-4">
	{#if tab === 'account'}
		<div {...panel('account')}>
			<AccountSettings
				username={data.profile?.username ?? null}
				avatarUrl={data.profile?.avatarUrl ?? null}
			/>
		</div>
	{:else if tab === 'appearance'}
		<div {...panel('appearance')}>
			<section class="border-b border-subtle pb-6 last:border-b-0">
				<SectionHeader title="Theme" />
				<div class="grid grid-cols-2 gap-3.5 px-4 pt-4 sm:flex sm:flex-wrap">
					{#each THEMES as name (name)}
						{@const preview = THEME_PREVIEWS[name]}
						<button
							type="button"
							disabled={busy}
							onclick={() => pickTheme(name)}
							aria-pressed={theme.current === name}
							class="min-w-0 rounded-2xl border-2 p-1 transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-55 {theme.current ===
							name
								? 'border-accent'
								: 'border-transparent'}"
						>
							<span class="block overflow-hidden rounded-xl border border-subtle">
								<span class="flex h-15 items-center gap-2 px-3.5" style="background:{preview.bg}">
									{#each preview.accents as swatch (swatch)}
										<span class="size-3.5 rounded-full" style="background:{swatch}"></span>
									{/each}
								</span>
								<span class="block px-3 py-3 text-left" style="background:{preview.surface}">
									<span class="text-md font-bold" style="color:{preview.text}">
										{THEME_LABELS[name]}
									</span>
								</span>
							</span>
						</button>
					{/each}
				</div>
			</section>
		</div>
	{:else}
		<div {...panel('tracking')}>
			<section class="mb-6 border-b border-subtle pb-6">
				<SectionHeader title="Categories" count={data.categories.length} />
				<p class="px-4 pt-3 pb-2 text-xs text-muted">
					Group goals by category. Deleting one leaves its goals uncategorized.
				</p>
				<div>
					{#each data.categories as category, index (category.id)}
						<div
							class="{row} mp-enter flex items-center gap-2.5 px-4 py-2"
							style="--mp-delay:{stagger(index, 30)}"
						>
							{#if editingId === category.id}
								<form class="flex flex-1 flex-col gap-2" onsubmit={saveEditing}>
									<div class="flex gap-2">
										<input
											class="{field.input} min-w-0 flex-1 py-1.5 text-md"
											bind:value={editingName}
											required
											aria-label="Rename {category.name}"
										/>
										<button type="submit" class={button.ghost} disabled={busy} aria-busy={busy}>
											{#if busy}<Spinner />{/if}
											{busy ? 'Saving…' : 'Save'}
										</button>
										<button type="button" class={button.ghost} onclick={() => (editingId = null)}>
											Cancel
										</button>
									</div>
									<div
										class="flex flex-wrap items-center gap-2"
										role="radiogroup"
										aria-label="Color for {category.name}"
									>
										<span class="text-xs text-muted">Color</span>
										{#each CATEGORY_COLOR_TOKENS as option (option.token)}
											{@const selected = (editingColor ?? 'accent-primary') === option.token}
											<button
												type="button"
												role="radio"
												aria-checked={selected}
												aria-label={option.label}
												title={option.label}
												disabled={busy}
												onclick={() => (editingColor = option.token)}
												class="mp-hit size-5 rounded-full border-2 transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent {selected
													? 'border-current'
													: 'border-transparent'}"
												style="background:{categoryColor(option.token)}"
											></button>
										{/each}
									</div>
								</form>
							{:else}
								<button
									type="button"
									class="mp-hit size-2.5 rounded-full outline-offset-2 transition-transform duration-150 hover:scale-150 focus-visible:outline-2 focus-visible:outline-accent"
									style="background:{categoryColor(category.colorToken)}"
									title="Change color"
									aria-label="Change color of {category.name}"
									onclick={() => startEditing(category)}
								></button>
								<span class="min-w-0 flex-1 text-md wrap-anywhere">{category.name}</span>
								{#if category.isDefault}
									<Pill tone="neutral">default</Pill>
								{/if}
								<button
									type="button"
									class="{button.bare} mp-hit"
									onclick={() => startEditing(category)}
								>
									<Icon name="edit" size={14} label="Edit {category.name}" />
								</button>
								<button
									type="button"
									class="{button.bare} mp-hit"
									disabled={busy}
									onclick={() => (deleting = { id: category.id, name: category.name })}
								>
									<Icon name="trash" size={14} label="Delete {category.name}" />
								</button>
							{/if}
						</div>
					{/each}

					<form class="px-4 pt-3" onsubmit={addCategory}>
						<input
							class="{field.dashed} w-full"
							bind:value={newCategoryName}
							placeholder="+ Add category…"
							aria-label="New category name"
						/>
					</form>
				</div>
			</section>

			<section class="pb-6">
				<SectionHeader title="Streaks" />
				<div class="flex items-center gap-4 px-4 pt-4">
					<div class="min-w-0 flex-1">
						<div class="mb-0.5 text-md font-semibold">Grace period</div>
						<div class="text-xs text-muted">
							Missing days within this window won't break a streak
						</div>
					</div>
					<button
						type="button"
						class="{button.icon} mp-hit"
						disabled={busy || !data.settings || grace === 0}
						onclick={() => nudgeGrace(-1)}
					>
						<Icon name="minus" size={13} label="Decrease grace period" />
					</button>
					<span class="min-w-13 text-center text-base font-bold tabular-nums">
						{#if data.settings}
							{grace}
							{grace === 1 ? 'day' : 'days'}
						{:else}
							&mdash;
						{/if}
					</span>
					<button
						type="button"
						class="{button.icon} mp-hit"
						disabled={busy || !data.settings || grace === 7}
						onclick={() => nudgeGrace(1)}
					>
						<Icon name="plus" size={13} label="Increase grace period" />
					</button>
				</div>
			</section>
		</div>
	{/if}
</div>

<ConfirmDialog
	open={deleting !== null}
	title="Delete “{deleting?.name ?? ''}”?"
	body="Goals in this category become uncategorized. This cannot be undone."
	{busy}
	onConfirm={removeCategory}
	onCancel={() => (deleting = null)}
/>
