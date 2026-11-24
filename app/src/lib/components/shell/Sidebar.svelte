<script lang="ts" module>
	import type { IconName } from '$lib/icons';

	export type NavItem = { href: string; label: string; icon: IconName };
</script>

<script lang="ts">
	import mushIcon from '$lib/assets/mush-icon.webp';
	import Icon from '../ui/Icon.svelte';
	import MadeByCredit from './MadeByCredit.svelte';
	import SidebarUser from './SidebarUser.svelte';
	import ThemeSwitch from './ThemeSwitch.svelte';

	interface Props {
		open: boolean;
		items: NavItem[];
		isCurrent: (href: string) => boolean;
		onToggle: () => void;
		username: string | null;
		avatarUrl: string | null;
	}

	let { open, items, isCurrent, onToggle, username, avatarUrl }: Props = $props();

	const row = $derived(
		`mb-px flex items-center gap-2.5 overflow-hidden rounded-control px-2.75 py-1.75 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${open ? '' : 'justify-center'}`
	);
</script>

<!-- Desktop only; phones get the top bar, tab bar and menu sheet instead. The rail
     sits straight on the canvas, no panel of its own. -->
<aside
	class="duration-250ms hidden shrink-0 flex-col overflow-hidden transition-[width] ease-out md:flex"
	style="width:{open ? '236px' : '76px'}"
>
	<div
		class="flex items-center gap-2.5 overflow-hidden px-4.5 pt-4 pb-3 whitespace-nowrap {open
			? ''
			: 'justify-center'}"
	>
		<img
			src={mushIcon}
			alt=""
			width="32"
			height="32"
			class="size-8 shrink-0 rounded-full object-cover"
			aria-hidden="true"
		/>
		{#if open}
			<span class="font-display text-base font-bold tracking-[0.2px]">Mushpoint</span>
		{/if}
	</div>

	<div class="flex flex-1 flex-col overflow-y-auto px-2.5 py-1">
		<p
			class="px-3 pt-2 pb-1.5 text-2xs font-semibold tracking-[0.08em] text-muted uppercase {open
				? ''
				: 'sr-only'}"
		>
			Workspace
		</p>
		<nav aria-label="Workspace" class="flex flex-col">
			{#each items as item (item.href)}
				<a
					href={item.href}
					aria-current={isCurrent(item.href) ? 'page' : undefined}
					class="{row} {isCurrent(item.href)
						? 'bg-surface font-semibold text-content'
						: 'font-medium text-muted hover:bg-surface hover:text-content'}"
				>
					<Icon name={item.icon} size={16} label={open ? undefined : item.label} />
					{#if open}<span class="text-sm">{item.label}</span>{/if}
				</a>
			{/each}
		</nav>
	</div>

	<div class="px-2.5 pb-1">
		<button
			type="button"
			class="{row} w-full font-medium text-muted hover:bg-surface hover:text-content"
			aria-expanded={open}
			onclick={onToggle}
		>
			<Icon
				name={open ? 'chevrons-left' : 'chevrons-right'}
				size={16}
				label={open ? undefined : 'Expand sidebar'}
			/>
			{#if open}<span class="text-sm">Collapse</span>{/if}
		</button>
	</div>

	<div class="px-2.5">
		<p
			class="px-3 pt-2 pb-1.5 text-2xs font-semibold tracking-[0.08em] text-muted uppercase {open
				? ''
				: 'sr-only'}"
		>
			Account
		</p>
		<SidebarUser {open} {username} {avatarUrl} current={isCurrent('/settings')} />
	</div>

	<div class="flex flex-col gap-1 px-4.5 py-3">
		<ThemeSwitch showLabel={open} />
		{#if open}
			<MadeByCredit />
		{/if}
	</div>
</aside>
