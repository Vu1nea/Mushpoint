<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createIdea, deleteIdea, promoteIdea, type Goal, type Idea } from '$lib/api';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import GoalDrawer from '$lib/components/GoalDrawer.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import IdeaDrawer from '$lib/components/IdeaDrawer.svelte';
	import TagInput from '$lib/components/TagInput.svelte';
	import { button, chip, field } from '$lib/components/ui';
	import { stagger } from '$lib/motion';

	let { data } = $props();

	let busy = $state(false);
	let actionError = $state<unknown>(null);

	let drawerOpen = $state(false);
	let editingIdea = $state<Idea | null>(null);
	let deletingIdea = $state<Idea | null>(null);

	let promoteDrawerOpen = $state(false);
	let promotingIdea = $state<Idea | null>(null);

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

	/** The idea only drops out of the inbox once the new goal exists and the
	 * promotion is recorded — both must succeed before the page reloads. */
	async function onGoalCreated(newGoal: Goal) {
		if (!promotingIdea) return;
		await run(() => promoteIdea(promotingIdea!.id, newGoal.id));
	}
</script>

<svelte:head><title>Idea Vault · Mushpoint</title></svelte:head>

<header class="mb-6 flex items-start justify-between gap-4">
	<div>
		<h1 class="mb-1 font-display text-3xl font-bold">Idea Vault</h1>
		<p class="text-sm text-muted">Capture it now, sort it later</p>
	</div>
	<button
		type="button"
		class={button.primary}
		onclick={() => {
			editingIdea = null;
			drawerOpen = true;
		}}
	>
		<Icon name="plus" size={15} weight={2.4} />
		New Idea
	</button>
</header>

{#if data.error}
	<div class="mb-6"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="mb-6"><ErrorBanner error={actionError} onDismiss={() => (actionError = null)} /></div>
{/if}

<form
	class="mb-6 flex flex-col gap-3 rounded-card border border-subtle bg-surface p-4 sm:flex-row sm:items-start"
	onsubmit={addIdea}
>
	<div class="flex flex-1 flex-col gap-2">
		<input
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
		<TagInput bind:tags={quickAdd.tags} ariaLabel="Tags for the new idea" placeholder="Add tags…" />
	</div>
	<button type="submit" class={button.primary} disabled={busy}>
		<Icon name="plus" size={15} weight={2.4} />
		Add Idea
	</button>
</form>

{#if data.tags.length > 0}
	<nav class="mb-6 flex flex-wrap gap-2" aria-label="Filter ideas by tag">
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

{#if data.ideas.length === 0 && !data.error}
	<p class="px-5 py-12 text-center text-md text-muted">
		{data.activeTag
			? `No ideas tagged “${data.activeTag}” yet.`
			: 'No ideas yet — capture one above.'}
	</p>
{:else}
	<ul class="flex flex-col gap-2.5">
		{#each data.ideas as idea, index (idea.id)}
			<li class="mp-enter" style="--mp-delay:{stagger(index)}">
				<article class="rounded-card border border-subtle bg-surface p-4">
					<div class="flex items-start gap-3">
						<div class="min-w-0 flex-1">
							<p class="truncate text-base font-semibold">{idea.title}</p>
							{#if idea.note}
								<p class="mt-1 line-clamp-2 text-sm text-muted">{idea.note}</p>
							{/if}
							{#if idea.tags.length > 0}
								<div class="mt-2 flex flex-wrap gap-1.5">
									{#each idea.tags as tag (tag.id)}
										<span
											class="rounded-full bg-accent/15 px-2.5 py-0.5 text-2xs font-semibold text-accent"
										>
											{tag.name}
										</span>
									{/each}
								</div>
							{/if}
						</div>
						<div class="flex shrink-0 gap-1">
							<button type="button" class={button.icon} onclick={() => edit(idea)}>
								<Icon name="edit" size={14} label="Edit {idea.title}" />
							</button>
							<button type="button" class={button.icon} onclick={() => promote(idea)}>
								<Icon name="goal" size={14} label="Promote {idea.title} to a goal" />
							</button>
							<button
								type="button"
								class={button.icon}
								disabled={busy}
								onclick={() => (deletingIdea = idea)}
							>
								<Icon name="trash" size={14} label="Delete {idea.title}" />
							</button>
						</div>
					</div>
				</article>
			</li>
		{/each}
	</ul>
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
	onSaved={onGoalCreated}
/>

<ConfirmDialog
	open={deletingIdea !== null}
	title="Delete “{deletingIdea?.title ?? ''}”?"
	body="This cannot be undone."
	{busy}
	onConfirm={removeIdea}
	onCancel={() => (deletingIdea = null)}
/>
