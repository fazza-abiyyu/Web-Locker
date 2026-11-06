// Web Locker content script entry point.
// Loaded last, after every module in src/ (see manifest.json content_scripts).

(function bootWebLocker() {
  // Only run in the top-level frame (don't block inside iframes like ads or widgets)
  if (window.self !== window.top) return;

  // Prevent double injection
  if (window.hasWebLockerInjected) return;
  window.hasWebLockerInjected = true;

  // 1. Instantly hide the html page to prevent any leak of the original page
  //    content before verification
  showInitialBlocker();

  // 2. Check lock status with background worker
  if (!isContextValid()) {
    removeBlocker();
    return;
  }

  wlChrome.runtime.sendMessage({ action: "checkLockStatus", hostname: wlHostname }, (response) => {
    if (wlChrome.runtime.lastError || !response) {
      removeBlocker();
      return;
    }

    if (!response.isLocked) {
      // Not locked, reveal page immediately
      removeBlocker();
      if (response.isDomainLocked) {
        startIdleTimer();
      }
      return;
    }

    // Site is locked: reveal html but hide all children except our locker root
    showLockedBlocker();

    // Initialize lock UI once DOM is loaded enough (or right away since we are at document_start)
    if (document.body) {
      initLockScreen();
    } else {
      document.addEventListener("DOMContentLoaded", initLockScreen);
    }
  });
})();
