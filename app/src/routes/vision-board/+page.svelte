<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { deleteVisionItem, reorderVisionItems, type VisionItemView } from '$lib/api';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import { button } from '$lib/components/ui';
	import VisionBoard from '$lib/components/vision/VisionBoard.svelte';
	import VisionItemDrawer from '$lib/components/vision/VisionItemDrawer.svelte';
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
	const items = $derived.by(() => {
		const order = pendingOrder;
		if (!order) return data.items;
		const byId = new Map(data.items.map((item) => [item.id, item]));
		const ordered = order.flatMap((id) => byId.get(id) ?? []);
		const missing = data.items.filter((item) => !order.includes(item.id));
		return [...ordered, ...missing];
	});

	function reorder(orderedIds: number[]) {
		actionError = null;
		return optimistic({
			key: 'vision-order',
			apply: () => (pendingOrder = orderedIds),
			revert: () => (pendingOrder = null),
			call: () => reorderVisionItems(orderedIds),
			refresh: invalidateAll,
			onError: (error) => (actionError = error),
			settle: () => (pendingOrder = null)
		});
	}
</script>

<svelte:head><title>Vision Board · Mushpoint</title></svelte:head>

<PageHeader title="Vision Board">
	{#snippet actions()}
		<button type="button" class="{button.primary} shrink-0" onclick={addNew}>
			<Icon name="plus" size={15} weight={2.4} />
			Add Item
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
