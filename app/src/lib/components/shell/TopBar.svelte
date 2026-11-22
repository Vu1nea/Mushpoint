<script lang="ts">
	import Breadcrumb from 'mushpoint-design/svelte/Breadcrumb.svelte';
	import type { Crumb } from '$lib/shell/crumbs';
	import Avatar from '../account/Avatar.svelte';
	import Icon from '../ui/Icon.svelte';

	interface Props {
		crumbs: Crumb[];
		onSearch: () => void;
		name: string;
		avatarUrl: string | null;
		/** The search button, so the palette can hand focus back when it closes. */
		searchButton?: HTMLButtonElement;
	}

	let { crumbs, onSearch, name, avatarUrl, searchButton = $bindable() }: Props = $props();
</script>

<!-- Desktop only; phones have the mobile top bar. Sits on the canvas above the sheet. -->
<div class="hidden shrink-0 items-center gap-4 px-6 py-3 md:flex">
	<div class="min-w-0 flex-1">
		<Breadcrumb items={crumbs} />
	</div>
	<button
		bind:this={searchButton}
		type="button"
		class="flex w-64 items-center gap-2 rounded-control border border-subtle bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
		aria-label="Search"
		aria-keyshortcuts="Control+K Meta+K"
		aria-haspopup="dialog"
		onclick={onSearch}
	>
		<Icon name="search" size={15} />
		<span class="flex-1 text-left">Search</span>
		<kbd class="rounded-sm border border-subtle px-1.5 text-2xs text-muted">Ctrl K</kbd>
	</button>
	<a
		href="/settings"
		class="mp-hit flex shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
		aria-label="Your profile"
	>
		<Avatar {name} url={avatarUrl} />
	</a>
</div>
