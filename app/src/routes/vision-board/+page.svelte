<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { deleteVisionItem, reorderVisionItems, type VisionItemView } from '$lib/api';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import VisionBoard from '$lib/components/VisionBoard.svelte';
	import VisionItemDrawer from '$lib/components/VisionItemDrawer.svelte';
	import { optimistic } from '$lib/optimistic';

	let { data } = $props();

	let busy = $state(false);
	let actionError = $state<unknown>(null);

	let drawerOpen = $state(false);
	let editingItem = $state<VisionItemView | null>(null);
	let deletingItem = $state<VisionItemView | null>(null);

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

	function edit(item: VisionItemView) {
		editingItem = item;
		drawerOpen = true;
	}

	async function removeItem() {
		const item = deletingItem;
		if (!item) return;
		deletingItem = null;
		await run(() => deleteVisionItem(item.id));
	}

	/** The order the user just chose, shown until fresh data arrives. */
	let pendingOrder = $state<number[] | null>(null);
	$effect(() => {
		void data.items;
		pendingOrder = null;
	});
	const items = $derived.by(() => {
		const order = pendingOrder;
		if (!order) return data.items;
		const byId = new Map(data.items.map((item) => [item.id, item]));
		return order.flatMap((id) => byId.get(id) ?? []);
	});

	function reorder(orderedIds: number[]) {
		actionError = null;
		return optimistic({
			key: 'vision-order',
			apply: () => (pendingOrder = orderedIds),
			revert: () => (pendingOrder = null),
			call: () => reorderVisionItems(orderedIds),
			refresh: invalidateAll,
			onError: (error) => (actionError = error)
		});
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
	{items}
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
