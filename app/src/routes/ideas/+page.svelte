<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createIdea, deleteIdea, promoteIdea, type GoalInput, type Idea } from '$lib/api';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import DataTable from 'mushpoint-design/svelte/DataTable.svelte';
	import Pill from 'mushpoint-design/svelte/Pill.svelte';
	import RowMenu from 'mushpoint-design/svelte/RowMenu.svelte';
	import Toolbar from 'mushpoint-design/svelte/Toolbar.svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';
	import GoalDrawer from '$lib/components/goals/GoalDrawer.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import IdeaDrawer from '$lib/components/ideas/IdeaDrawer.svelte';
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import TagInput from 'mushpoint-design/svelte/TagInput.svelte';
	import { button, chip, field } from '$lib/components/ui';
	import { formatDate } from '$lib/format';
	import { filterIdeas, tagSummary } from '$lib/ideaList';

	let { data } = $props();

	let busy = $state(false);
	let actionError = $state<unknown>(null);

	let drawerOpen = $state(false);
	let editingIdea = $state<Idea | null>(null);
	let deletingIdea = $state<Idea | null>(null);

	let promoteDrawerOpen = $state(false);
	let promotingIdea = $state<Idea | null>(null);

	let query = $state('');
	/** The tag filter is server-side (`?tag=`), so only the query narrows here. */
	const rows = $derived(filterIdeas(data.ideas, { query, tag: null }));
	const empty = $derived(
		data.ideas.length > 0
			? 'No ideas match.'
			: data.activeTag
				? `No ideas tagged “${data.activeTag}” yet.`
				: 'No ideas yet. Capture one above.'
	);

	const columns = [
		{ key: 'title', label: 'Idea' },
		{ key: 'tags', label: 'Tags', width: '14rem', hideBelow: 'md' as const },
		{ key: 'created', label: 'Created', width: '8rem', hideBelow: 'md' as const },
		{ key: 'actions', label: '', width: '3rem', align: 'end' as const }
	];
	const MAX_TAGS = 3;

	let quickAdd = $state({ title: '', note: '', tags: [] as string[] });

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

	async function addIdea(event: SubmitEvent) {
		event.preventDefault();
		const title = quickAdd.title.trim();
		if (!title) return;

		const input = { title, note: quickAdd.note.trim() || null, tagNames: quickAdd.tags };
		quickAdd = { title: '', note: '', tags: [] };
		await run(() => createIdea(input));
	}

	function edit(idea: Idea) {
		editingIdea = idea;
		drawerOpen = true;
	}

	async function removeIdea() {
		if (busy) return;
		const idea = deletingIdea;
		if (!idea) return;
		deletingIdea = null;
		await run(() => deleteIdea(idea.id));
	}

	function promote(idea: Idea) {
		promotingIdea = idea;
		promoteDrawerOpen = true;
	}

	function closePromoteDrawer() {
		promoteDrawerOpen = false;
		promotingIdea = null;
	}

	/** The server creates the goal and records the promotion together, so a
	 * failure leaves the drawer open with nothing created and a retry is safe. */
	async function createPromotedGoal(input: GoalInput) {
		if (!promotingIdea) throw new Error('no idea is being promoted');
		return (await promoteIdea(promotingIdea.id, input)).goal;
	}
</script>

<svelte:head><title>Ideas · Mushpoint</title></svelte:head>

<PageHeader
	title="Ideas"
	subtitle="{data.ideas.length} {data.ideas.length === 1 ? 'idea' : 'ideas'}"
>
	{#snippet actions()}
		<button
			type="button"
			class="{button.primary} shrink-0"
			onclick={() => document.getElementById('new-idea-title')?.focus()}
		>
			<Icon name="plus" size={15} weight={2.4} />
			New Idea
		</button>
	{/snippet}
</PageHeader>

{#if data.error}
	<div class="page-gutter pb-4"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="page-gutter pb-4">
		<ErrorBanner error={actionError} onDismiss={() => (actionError = null)} />
	</div>
{/if}

<div class="mb-4 border-y border-subtle">
	<form class="flex flex-col gap-3 page-gutter py-3 md:flex-row md:items-start" onsubmit={addIdea}>
		<div class="flex min-w-0 flex-1 flex-col gap-2">
			<input
				id="new-idea-title"
				class="{field.dashed} w-full"
				bind:value={quickAdd.title}
				placeholder="Capture an idea…"
				aria-label="New idea title"
			/>
			<input
				class="{field.dashed} w-full text-sm"
				bind:value={quickAdd.note}
				placeholder="Optional note…"
				aria-label="New idea note"
			/>
			<TagInput
				bind:tags={quickAdd.tags}
				ariaLabel="Tags for the new idea"
				placeholder="Add tags…"
			/>
		</div>
		<button type="submit" class="{button.primary} shrink-0" disabled={busy} aria-busy={busy}>
			{#if busy}
				<Spinner size={15} />
			{:else}
				<Icon name="plus" size={15} weight={2.4} />
			{/if}
			{busy ? 'Adding…' : 'Add Idea'}
		</button>
	</form>
</div>

<div class="page-gutter pb-3">
	<Toolbar>
		<input
			type="search"
			class="{field.input} max-w-64 min-w-40 flex-1"
			placeholder="Search ideas"
			aria-label="Search ideas"
			bind:value={query}
		/>
		{#if data.tags.length > 0}
			<nav class="flex flex-wrap items-center gap-1" aria-label="Filter ideas by tag">
				<a
					href="/ideas"
					aria-current={!data.activeTag ? 'page' : undefined}
					class={chip(!data.activeTag)}
				>
					All
				</a>
				{#each data.tags as tag (tag.id)}
					<a
						href="/ideas?tag={encodeURIComponent(tag.name)}"
						aria-current={data.activeTag === tag.name ? 'page' : undefined}
						class={chip(data.activeTag === tag.name)}
					>
						{tag.name}
					</a>
				{/each}
			</nav>
		{/if}
	</Toolbar>
</div>

{#if !data.error}
	<div class="page-gutter">
		<DataTable
			{columns}
			{rows}
			rowKey={(idea) => idea.id}
			{empty}
			ariaLabel="Ideas"
			onRowClick={edit}
		>
			{#snippet cell(idea, key)}
				{#if key === 'title'}
					<div class="min-w-0">
						<button
							type="button"
							class="block max-w-full truncate text-left focus-visible:outline-2 focus-visible:outline-accent"
							onclick={(event) => {
								event.stopPropagation();
								edit(idea);
							}}>{idea.title}</button
						>
						{#if idea.note}
							<p class="truncate text-xs text-muted">{idea.note}</p>
						{/if}
					</div>
				{:else if key === 'tags'}
					{@const summary = tagSummary(idea.tags, MAX_TAGS)}
					<span class="flex flex-wrap items-center gap-1">
						{#each summary.shown as tag (tag.id)}
							<Pill tone="neutral">{tag.name}</Pill>
						{/each}
						{#if summary.more > 0}
							<span class="text-xs text-muted">+{summary.more}</span>
						{/if}
					</span>
				{:else if key === 'created'}
					<span class="text-xs text-muted">{formatDate(idea.createdAt)}</span>
				{:else}
					<RowMenu
						label="Actions for {idea.title}"
						items={[
							{ label: 'Edit', onSelect: () => edit(idea) },
							{ label: 'Promote to goal', onSelect: () => promote(idea) },
							{ label: 'Delete', danger: true, onSelect: () => (deletingIdea = idea) }
						]}
					/>
				{/if}
			{/snippet}
		</DataTable>
	</div>
{/if}

<IdeaDrawer
	open={drawerOpen}
	idea={editingIdea}
	onClose={() => (drawerOpen = false)}
	onSaved={invalidateAll}
/>

<GoalDrawer
	open={promoteDrawerOpen}
	categories={data.categories}
	prefill={promotingIdea ? { title: promotingIdea.title, description: promotingIdea.note } : null}
	onClose={closePromoteDrawer}
	create={createPromotedGoal}
	onSaved={() => invalidateAll()}
/>

<ConfirmDialog
	open={deletingIdea !== null}
	title="Delete “{deletingIdea?.title ?? ''}”?"
	body="This cannot be undone."
	{busy}
	onConfirm={removeIdea}
	onCancel={() => (deletingIdea = null)}
/>
