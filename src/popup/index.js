// Web Locker popup entry point.
// Module script berjalan setelah DOM ter-parse, jadi referensi elemen sudah siap.

import { wlChrome } from "./lib/ext-api.js";
import { resizePopup } from "./lib/ui.js";
import { initPinModalEvents } from "./modules/pin-modal.js";
import { initBackupEvents } from "./modules/backup.js";
import { initSetupEvents, showSetupView, showMainView } from "./modules/setup.js";
import { initDashboard } from "./modules/dashboard.js";

function init() {
  initSetupEvents();
  initPinModalEvents();
  initBackupEvents();

  // Check if PIN is already set
  wlChrome.storage.local.get(["pin", "lockedSites"], (data) => {
    if (!data.pin) {
      showSetupView();
    } else {
      showMainView();
      initDashboard(data.lockedSites || []);
    }
  });

  // Auto-resize popup setiap konten DOM berubah
  // (tab switch, list update, modal show/hide, message).
  const resizeObserver = new MutationObserver(resizePopup);
  resizeObserver.observe(document.body, { childList: true, subtree: true, attributes: true });

  // Initial resize setelah render awal
  resizePopup();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
