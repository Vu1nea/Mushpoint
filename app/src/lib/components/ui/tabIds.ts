/** Id of the tab button for `value` in the tab set `id`. */
export function tabId(id: string, value: string): string {
	return `${id}-tab-${value}`;
}

/** Id of the panel the tab for `value` controls. */
export function tabPanelId(id: string, value: string): string {
	return `${id}-panel-${value}`;
}
