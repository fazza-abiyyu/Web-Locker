// Web Locker content script state shared by modules.
// Content scripts share one isolated scope, so files load in manifest order
// (see manifest.json content_scripts).

var wlHostname = window.location.hostname;

// <style id="web-locker-blocker"> yang menyembunyikan halaman sebelum verifikasi.
var wlBlockerStyle = null;

// Idle / auto-lock state.
var wlIdleCheckInterval = null;
var wlActivityListeners = [];
var wlLastActivity = Date.now();
