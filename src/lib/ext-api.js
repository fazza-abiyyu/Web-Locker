// Web Locker content script helper: cross-browser extension API shim.
// Content scripts share one isolated scope, so files load in manifest order
// (see manifest.json content_scripts).

var extApi = typeof globalThis.browser !== "undefined" ? globalThis.browser : globalThis.chrome;
var wlChrome = globalThis.chrome || extApi;

function isContextValid() {
  return typeof wlChrome !== "undefined" && wlChrome.runtime && !!wlChrome.runtime.id;
}
