// Web Locker popup module: dashboard tabs, site toggle, PIN settings.

import { els, state } from "../state.js";
import { wlChrome } from "../lib/ext-api.js";
import { getActiveTab, reloadTabById } from "../lib/tabs.js";
import { resizePopup, showSettingsMsg, showLockoutMsg } from "../lib/ui.js";
import { updateLockStatus, renderLockedSites } from "./sites.js";
import { requestPinConfirmation } from "./pin-modal.js";

function initTabSwitching() {
  els.tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      els.tabBtns.forEach(b => b.classList.remove("active"));
      els.tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");
      resizePopup();
    });
  });
}

function loadActiveTabInfo(lockedSites) {
  getActiveTab((activeTab) => {
    if (activeTab && activeTab.url) {
      try {
        const url = new URL(activeTab.url);
        state.currentHostname = url.hostname;

        if (["http:", "https:"].includes(url.protocol)) {
          els.currentHostname.textContent = state.currentHostname;
          updateLockStatus(lockedSites);
        } else {
          // Internal pages like chrome://, etc.
          els.currentHostname.textContent = "Browser Internal Page";
          els.toggleLockBtn.disabled = true;
          els.toggleLockBtn.style.opacity = "0.5";
          els.toggleLockBtn.textContent = "Cannot be locked";
        }
      } catch (e) {
        els.currentHostname.textContent = "Unsupported URL";
        els.toggleLockBtn.disabled = true;
      }
    }
  });
}

function saveToggleLock(sites) {
  wlChrome.storage.local.set({ lockedSites: sites }, () => {
    updateLockStatus(sites);
    renderLockedSites(sites);
    // Reload active tab to immediately apply locker overlay if locked,
    // or unlock if removed.
    getActiveTab((activeTab) => {
      if (activeTab) {
        reloadTabById(activeTab.id);
      }
    });
  });
}

function bindToggleLock() {
  els.toggleLockBtn.addEventListener("click", () => {
    if (!state.currentHostname) return;

    wlChrome.storage.local.get("lockedSites", (data) => {
      let sites = data.lockedSites || [];
      if (state.isCurrentSiteLocked) {
        // Unlock it -> REQUIRES PIN
        requestPinConfirmation(() => {
          sites = sites.filter(s => s !== state.currentHostname);
          saveToggleLock(sites);
        });
      } else {
        // Lock it -> NO PIN REQUIRED
        if (!sites.includes(state.currentHostname)) {
          sites.push(state.currentHostname);
        }
        saveToggleLock(sites);
      }
    });
  });
}

function addSite() {
  const inputVal = els.newSiteInput.value.trim().toLowerCase();
  if (!inputVal) return;

  // Basic host verification
  let cleanHost = inputVal;
  try {
    if (inputVal.includes("://")) {
      const urlObj = new URL(inputVal);
      cleanHost = urlObj.hostname;
    } else {
      // Make it a full URL temporarily to parse correctly
      const urlObj = new URL("http://" + inputVal);
      cleanHost = urlObj.hostname;
    }
  } catch (e) {
    // Fallback to whatever input they wrote if parsing fails
  }

  if (!cleanHost || cleanHost.split(".").length < 2) {
    alert("Enter a valid domain name.");
    return;
  }

  wlChrome.storage.local.get("lockedSites", (data) => {
    const sites = data.lockedSites || [];
    if (!sites.includes(cleanHost)) {
      sites.push(cleanHost);
      wlChrome.storage.local.set({ lockedSites: sites }, () => {
        renderLockedSites(sites);
        els.newSiteInput.value = "";
        updateLockStatus(sites);
      });
    }
  });
}

function bindAddSite() {
  els.addSiteBtn.addEventListener("click", addSite);

  // Enter Key to Add Site
  els.newSiteInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      els.addSiteBtn.click();
    }
  });
}

function bindChangePin() {
  els.changePinBtn.addEventListener("click", () => {
    const oldPin = els.oldPinInput.value;
    const newPin = els.newPinInput.value;
    const confirmNewPin = els.confirmNewPinInput.value;

    wlChrome.storage.local.get("pin", (data) => {
      if (oldPin !== data.pin) {
        showSettingsMsg("Old PIN is incorrect.", true);
        return;
      }
      if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
        showSettingsMsg("New PIN must be 6 digits.", true);
        return;
      }
      if (newPin !== confirmNewPin) {
        showSettingsMsg("PIN confirmation does not match.", true);
        return;
      }

      wlChrome.storage.local.set({ pin: newPin }, () => {
        showSettingsMsg("PIN updated successfully!", false);
        els.oldPinInput.value = "";
        els.newPinInput.value = "";
        els.confirmNewPinInput.value = "";
      });
    });
  });
}

function bindAutoLockTimeout() {
  wlChrome.storage.local.get("autoLockTimeout", (data) => {
    // Default to 5 minutes if not set
    const currentTimeout = data.autoLockTimeout !== undefined ? data.autoLockTimeout : "5";
    els.timeoutSelect.value = currentTimeout;
  });

  els.timeoutSelect.addEventListener("change", () => {
    const selectedValue = els.timeoutSelect.value;
    wlChrome.storage.local.set({ autoLockTimeout: selectedValue }, () => {
      showSettingsMsg("Auto-lock timeout updated!", false);
    });
  });
}

function bindLockoutSettings() {
  wlChrome.storage.local.get(["lockoutAttempts", "lockoutDuration"], (data) => {
    const defaultAttempts = data.lockoutAttempts !== undefined ? data.lockoutAttempts : "5";
    const defaultDuration = data.lockoutDuration !== undefined ? data.lockoutDuration : "5";
    els.lockoutAttemptsSelect.value = defaultAttempts;
    els.lockoutAttemptsSelect.dataset.current = defaultAttempts;
    els.lockoutDurationSelect.value = defaultDuration;
    els.lockoutDurationSelect.dataset.current = defaultDuration;
    // Save defaults to storage if not already set
    if (data.lockoutAttempts === undefined || data.lockoutDuration === undefined) {
      wlChrome.storage.local.set({
        lockoutAttempts: defaultAttempts,
        lockoutDuration: defaultDuration
      });
    }
  });

  els.lockoutAttemptsSelect.addEventListener("change", () => {
    const newValue = els.lockoutAttemptsSelect.value;
    const oldValue = els.lockoutAttemptsSelect.dataset.current || "5";
    requestPinConfirmation(
      () => {
        els.lockoutAttemptsSelect.dataset.current = newValue;
        wlChrome.storage.local.set({ lockoutAttempts: newValue }, () => {
          showLockoutMsg("Lockout attempts updated!", false);
        });
      },
      () => {
        els.lockoutAttemptsSelect.value = oldValue;
      }
    );
  });

  els.lockoutDurationSelect.addEventListener("change", () => {
    const newValue = els.lockoutDurationSelect.value;
    const oldValue = els.lockoutDurationSelect.dataset.current || "5";
    requestPinConfirmation(
      () => {
        els.lockoutDurationSelect.dataset.current = newValue;
        wlChrome.storage.local.set({ lockoutDuration: newValue }, () => {
          showLockoutMsg("Lockout duration updated!", false);
        });
      },
      () => {
        els.lockoutDurationSelect.value = oldValue;
      }
    );
  });
}

export function initDashboard(lockedSites) {
  // 1. Tab Switching
  initTabSwitching();

  // 2. Fetch Active Tab URL Information
  loadActiveTabInfo(lockedSites);

  // 3. Render list of locked sites
  renderLockedSites(lockedSites);

  // 4. Toggle Current Site Lock Click Handlers
  bindToggleLock();

  // 5. Add Custom Site Event
  bindAddSite();

  // 6. Update PIN Settings Event
  bindChangePin();

  // 7. Auto-lock Timeout Event
  bindAutoLockTimeout();

  // 8. Lockout Settings
  bindLockoutSettings();
}
