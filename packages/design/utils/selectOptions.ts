/** Pure option/group helpers for Select.svelte — no DOM, no Svelte. */

export interface SelectOption {
	value: string;
	label: string;
}

export interface SelectGroup {
	label: string;
	options: SelectOption[];
}

export type SelectItem = SelectOption | SelectGroup;

export function isGroup(item: SelectItem): item is SelectGroup {
	return 'options' in item;
}

export function flattenOptions(items: SelectItem[]): SelectOption[] {
	return items.flatMap((item) => (isGroup(item) ? item.options : [item]));
}

export function labelFor(items: SelectItem[], value: string): string | undefined {
	return flattenOptions(items).find((option) => option.value === value)?.label;
}
