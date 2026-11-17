<script lang="ts">
	import type { IconName } from '$lib/icons';
	import Icon from './Icon.svelte';

	interface Props {
		items: { href: string; label: string; icon: IconName }[];
		isCurrent: (href: string) => boolean;
	}

	let { items, isCurrent }: Props = $props();
</script>

<!-- Phones only: the main screens, one thumb away. Sits under the modals (z-40/50). -->
<nav
	aria-label="Primary"
	class="fixed inset-x-0 bottom-0 z-30 border-t border-subtle bg-surface pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] md:hidden"
>
	<ul class="grid h-14 grid-cols-5">
		{#each items as item (item.href)}
			{@const current = isCurrent(item.href)}
			<li class="flex">
				<a
					href={item.href}
					aria-current={current ? 'page' : undefined}
					class="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-2xs transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent
					{current ? 'font-semibold text-accent' : 'font-medium text-muted hover:text-content'}"
				>
					<Icon name={item.icon} size={20} weight={current ? 2 : 1.8} />
					<span>{item.label}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>
