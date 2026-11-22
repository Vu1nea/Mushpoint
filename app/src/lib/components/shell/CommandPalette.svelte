<script lang="ts">
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';

	import { goto } from '$app/navigation';
	import { listGoals } from '$lib/api/goals';
	import { listIdeas } from '$lib/api/ideas';
	import { listTasks } from '$lib/api/tasks';
	import type { Goal, Idea, Task } from '$lib/api/types';
	import { motion } from '$lib/motion';
	import { searchItems, type SearchHit } from '$lib/search';
	import { createRequestCounter, moveIndex } from '$lib/shell/paletteNav';
	import ErrorBanner from '../ui/ErrorBanner.svelte';
	import Icon from '../ui/Icon.svelte';
	import Spinner from '../ui/Spinner.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	const KIND_LABEL: Record<SearchHit['kind'], string> = {
		goal: 'Goal',
		task: 'Task',
		idea: 'Idea'
	};

	let data = $state<{ goals: Goal[]; tasks: Task[]; ideas: Idea[] } | null>(null);
	let loading = $state(false);
	let error = $state<unknown>(null);
	let query = $state('');
	let active = $state(0);
	let input = $state<HTMLInputElement>();
	let opener: HTMLElement | null = null;

	const hits = $derived(data ? searchItems(query, data) : []);

	const requests = createRequestCounter();

	/** Refetches on every open; the previous data stays searchable meanwhile. */
	async function load() {
		const token = requests.next();
		loading = true;
		error = null;
		try {
			const [goals, tasks, ideas] = await Promise.all([listGoals(), listTasks(), listIdeas()]);
			if (requests.isCurrent(token)) data = { goals, tasks, ideas };
		} catch (e) {
			if (requests.isCurrent(token)) error = e;
		} finally {
			if (requests.isCurrent(token)) loading = false;
		}
	}

	let wasOpen = false;
	$effect(() => {
		if (open && !wasOpen) {
			opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			query = '';
			active = 0;
			void load();
			void tick().then(() => input?.focus());
		} else if (!open && wasOpen) {
			// A response still in flight belongs to a closed palette; drop it.
			requests.next();
			loading = false;
			opener?.focus();
			opener = null;
		}
		wasOpen = open;
	});

	$effect(() => {
		// A new query starts again at the top of the list.
		void query;
		active = 0;
	});

	async function choose(hit: SearchHit) {
		onClose();
		await goto(hit.href);
	}

	function onKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			onClose();
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			active = moveIndex(active, event.key === 'ArrowDown' ? 1 : -1, hits.length);
			void tick().then(() =>
				document.getElementById(`palette-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
			);
		} else if (event.key === 'Enter') {
			const hit = hits[active];
			if (hit) {
				event.preventDefault();
				void choose(hit);
			}
		} else if (event.key === 'Tab') {
			// The dialog holds one focusable control; keep focus on it.
			event.preventDefault();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<button
		type="button"
		class="fixed inset-0 z-40 cursor-default bg-black/45"
		aria-label="Close search"
		tabindex="-1"
		onclick={onClose}
		transition:fade={{ duration: motion(150) }}
	></button>

	<div
		class="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
	>
		<div
			class="pointer-events-auto flex max-h-[70dvh] w-full max-w-xl flex-col overflow-hidden rounded-sheet border border-subtle bg-surface shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
			role="dialog"
			data-palette
			aria-modal="true"
			aria-label="Search"
		>
			<div class="flex items-center gap-2.5 border-b border-subtle px-4">
				<Icon name="search" size={16} class="shrink-0 text-muted" />
				<input
					bind:this={input}
					bind:value={query}
					type="text"
					role="combobox"
					class="min-h-12 flex-1 bg-transparent text-sm text-content placeholder:text-muted focus:outline-none"
					placeholder="Search goals, tasks and ideas"
					aria-label="Search goals, tasks and ideas"
					aria-expanded={hits.length > 0}
					aria-controls="palette-results"
					aria-autocomplete="list"
					aria-activedescendant={hits.length > 0 ? `palette-opt-${active}` : undefined}
					autocomplete="off"
					spellcheck="false"
				/>
				{#if loading && !data}<Spinner size={16} />{/if}
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto">
				{#if error}
					<div class="p-3">
						<ErrorBanner {error} />
					</div>
				{/if}
				<ul id="palette-results" role="listbox" aria-label="Results" class="p-1.5 empty:hidden">
					{#each hits as hit, i (hit.kind + hit.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<li
							id="palette-opt-{i}"
							role="option"
							aria-selected={i === active}
							class="flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm {i ===
							active
								? 'bg-track text-content'
								: 'text-content'}"
							onmousemove={() => (active = i)}
							onclick={() => choose(hit)}
						>
							<span
								class="w-10 shrink-0 text-2xs font-semibold tracking-[0.06em] text-muted uppercase"
								>{KIND_LABEL[hit.kind]}</span
							>
							<span class="min-w-0 flex-1 truncate">{hit.title}</span>
						</li>
					{/each}
				</ul>
				{#if !error && !(loading && !data)}
					{#if query.trim() === ''}
						<p class="px-4 py-6 text-center text-sm text-muted">
							Type to search your goals, tasks and ideas.
						</p>
					{:else if hits.length === 0}
						<p class="px-4 py-6 text-center text-sm text-muted">No results</p>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}
