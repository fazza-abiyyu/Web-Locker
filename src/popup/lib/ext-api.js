// Web Locker popup: cross-browser extension API shim.

export const extApi = typeof globalThis.browser !== "undefined" ? globalThis.browser : globalThis.chrome;
export const wlChrome = globalThis.chrome || extApi;
export const tabsApi = extApi.tabs || wlChrome.tabs;
