// The whole app talks to a Tauri backend that only exists in the browser
// process, so nothing is server-rendered or prerendered.
export const ssr = false;
export const prerender = false;
