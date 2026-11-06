// Web Locker content script module: idle detection & auto-lock timeout.
// Content scripts share one isolated scope, so files load in manifest order
// (see manifest.json content_scripts).

function startIdleTimer() {
  stopIdleTimer();

  if (!isContextValid()) return;

  wlChrome.storage.local.get("autoLockTimeout", (data) => {
    if (!isContextValid()) return;
    const timeoutMinutes = data.autoLockTimeout !== undefined ? parseInt(data.autoLockTimeout, 10) : 5;

    // If 0, it locks strictly on page load/navigation
    if (timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    wlLastActivity = Date.now();

    const updateActivity = () => {
      wlLastActivity = Date.now();
    };

    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
      wlActivityListeners.push({ event, listener: updateActivity });
    });

    wlIdleCheckInterval = setInterval(() => {
      if (!isContextValid()) {
        stopIdleTimer();
        return;
      }
      if (Date.now() - wlLastActivity > timeoutMs) {
        wlChrome.runtime.sendMessage({ action: "lockSiteForTab", hostname: wlHostname }, () => {
          stopIdleTimer();
          triggerLock();
        });
      }
    }, 5000);
  });
}

function stopIdleTimer() {
  if (wlIdleCheckInterval) {
    clearInterval(wlIdleCheckInterval);
    wlIdleCheckInterval = null;
  }
  wlActivityListeners.forEach(({ event, listener }) => {
    window.removeEventListener(event, listener);
  });
  wlActivityListeners = [];
}
