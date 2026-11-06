// Web Locker popup module: export / import backup.

import { els, state } from "../state.js";
import { wlChrome } from "../lib/ext-api.js";
import { getActiveTab, reloadTabById, isMobileFirefox } from "../lib/tabs.js";
import { showImportMsg } from "../lib/ui.js";
import { renderLockedSites, updateLockStatus } from "./sites.js";

function exportBackup() {
  wlChrome.storage.local.get(["lockedSites", "autoLockTimeout"], (data) => {
    const lockedSites = data.lockedSites || [];
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      lockedSites: lockedSites,
      autoLockTimeout: data.autoLockTimeout || "5"
    };

    const json = JSON.stringify(backup, null, 2);

    // Firefox Android ignores the `download` attribute in a popup opened as
    // a tab, so keep the Blob download attempt but also copy to clipboard
    // as a fallback on mobile.
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const a = document.createElement("a");
      a.href = url;
      a.download = `web-locker-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { /* download not supported, clipboard fallback below */ }

    if (isMobileFirefox() && navigator.clipboard) {
      navigator.clipboard.writeText(json).catch(() => {}).finally(() => {
        showImportMsg(`Exported ${lockedSites.length} site(s). Backup also copied to clipboard (mobile download may be blocked).`, false);
      });
    } else {
      showImportMsg(`Exported ${lockedSites.length} site(s) successfully!`, false);
    }
  });
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);

      if (!data.version || !Array.isArray(data.lockedSites)) {
        throw new Error("Invalid backup file format.");
      }

      state.pendingImportedSites = {
        lockedSites: data.lockedSites.filter(s => typeof s === "string"),
        autoLockTimeout: data.autoLockTimeout || "5"
      };

      els.importModalDesc.textContent = `Restore ${state.pendingImportedSites.lockedSites.length} site(s)? Set a new 6-digit PIN to continue.`;
      els.importNewPin.value = "";
      els.importConfirmPin.value = "";
      els.importModalError.classList.add("hidden");
      els.importModal.classList.remove("hidden");
      els.importNewPin.focus();
    } catch (err) {
      showImportMsg("Invalid backup file. Please select a valid Web Locker backup.", true);
    }
  };
  reader.readAsText(file);
  els.importFileInput.value = "";
}

function confirmImport() {
  const newPin = els.importNewPin.value;
  const confirmPin = els.importConfirmPin.value;

  if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
    els.importModalError.textContent = "PIN must be 6 digits.";
    els.importModalError.classList.remove("hidden");
    return;
  }
  if (newPin !== confirmPin) {
    els.importModalError.textContent = "PIN confirmation does not match.";
    els.importModalError.classList.remove("hidden");
    return;
  }

  if (!state.pendingImportedSites) {
    els.importModal.classList.add("hidden");
    return;
  }

  const importedSites = state.pendingImportedSites;

  wlChrome.storage.local.set({
    pin: newPin,
    lockedSites: importedSites.lockedSites,
    autoLockTimeout: importedSites.autoLockTimeout
  }, () => {
    els.importModal.classList.add("hidden");
    state.pendingImportedSites = null;

    showImportMsg("Backup restored successfully!", false);

    // Refresh the dashboard
    wlChrome.storage.local.get("lockedSites", (data) => {
      renderLockedSites(data.lockedSites || []);
      updateLockStatus(data.lockedSites || []);
    });

    // Reload current tab if it's now locked by imported sites
    getActiveTab((activeTab) => {
      if (activeTab && activeTab.url) {
        try {
          const url = new URL(activeTab.url);
          const hostname = url.hostname;
          const isLocked = (importedSites.lockedSites || []).some(
            s => hostname === s || hostname.endsWith("." + s)
          );
          if (isLocked) {
            reloadTabById(activeTab.id);
          }
        } catch (e) { }
      }
    });
  });
}

export function initBackupEvents() {
  els.exportBtn.addEventListener("click", exportBackup);

  els.importBtn.addEventListener("click", () => {
    els.importFileInput.click();
  });

  els.importFileInput.addEventListener("change", handleImportFile);

  els.importCancelBtn.addEventListener("click", () => {
    els.importModal.classList.add("hidden");
    state.pendingImportedSites = null;
  });

  els.importConfirmBtn.addEventListener("click", confirmImport);

  els.importNewPin.addEventListener("keydown", (e) => {
    if (e.key === "Enter") els.importConfirmBtn.click();
  });
  els.importConfirmPin.addEventListener("keydown", (e) => {
    if (e.key === "Enter") els.importConfirmBtn.click();
  });
}
