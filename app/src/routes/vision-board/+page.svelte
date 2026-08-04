<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { deleteVisionItem, reorderVisionItems, type VisionItem } from '$lib/api';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import VisionBoard from '$lib/components/VisionBoard.svelte';
	import VisionItemDrawer from '$lib/components/VisionItemDrawer.svelte';

	let { data } = $props();

	let busy = $state(false);
	let actionError = $state<unknown>(null);

	let drawerOpen = $state(false);
	let editingItem = $state<VisionItem | null>(null);
	let deletingItem = $state<VisionItem | null>(null);

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

	function addNew() {
		editingItem = null;
		drawerOpen = true;
	}

	function edit(item: VisionItem) {
		editingItem = item;
		drawerOpen = true;
	}

	async function removeItem() {
		const item = deletingItem;
		if (!item) return;
		deletingItem = null;
		await run(() => deleteVisionItem(item.id));
	}

	function reorder(orderedIds: number[]) {
		return run(() => reorderVisionItems(orderedIds));
	}
</script>

<svelte:head><title>Vision Board · Mushpoint</title></svelte:head>

<header class="mb-6">
	<h1 class="mb-1 font-display text-3xl font-bold">Vision Board</h1>
	<p class="text-sm text-muted">Images and quotes worth seeing every day</p>
</header>

{#if data.error}
	<div class="mb-6"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="mb-6"><ErrorBanner error={actionError} onDismiss={() => (actionError = null)} /></div>
{/if}

<VisionBoard
	items={data.items}
	{busy}
	onReorder={reorder}
	onEdit={edit}
	onDelete={(item) => (deletingItem = item)}
	onAddNew={addNew}
/>

<VisionItemDrawer
	open={drawerOpen}
	item={editingItem}
	onClose={() => (drawerOpen = false)}
	onSaved={invalidateAll}
/>

<ConfirmDialog
	open={deletingItem !== null}
	title="Delete this vision item?"
	body="This cannot be undone."
	{busy}
	onConfirm={removeItem}
	onCancel={() => (deletingItem = null)}
/>
