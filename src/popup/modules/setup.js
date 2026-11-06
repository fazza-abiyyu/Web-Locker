// Web Locker popup module: initial PIN setup view.

import { els } from "../state.js";
import { wlChrome } from "../lib/ext-api.js";
import { showError } from "../lib/ui.js";
import { initDashboard } from "./dashboard.js";

export function showSetupView() {
  els.setupView.classList.remove("hidden");
  els.mainView.classList.add("hidden");
}

export function showMainView() {
  els.setupView.classList.add("hidden");
  els.mainView.classList.remove("hidden");
}

export function initSetupEvents() {
  els.saveInitialPinBtn.addEventListener("click", () => {
    const pin = els.setupPinInput.value;
    const confirmPin = els.setupPinConfirmInput.value;

    if (pin.length !== 6 || confirmPin.length !== 6) {
      showError(els.setupError, "PIN must be 6 digits.");
      return;
    }
    if (!/^\d{6}$/.test(pin) || !/^\d{6}$/.test(confirmPin)) {
      showError(els.setupError, "PIN may only contain numbers.");
      return;
    }
    if (pin !== confirmPin) {
      showError(els.setupError, "PIN confirmation does not match.");
      return;
    }

    wlChrome.storage.local.set({ pin, lockedSites: [] }, () => {
      showMainView();
      initDashboard([]);
    });
  });
}
