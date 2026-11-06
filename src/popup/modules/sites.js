// Web Locker popup module: locked sites list + status indicator.

import { els, state, SVG_LOCKED_PATH, SVG_UNLOCKED_PATH } from "../state.js";
import { wlChrome } from "../lib/ext-api.js";
import { getActiveTab, reloadTabById } from "../lib/tabs.js";
import { requestPinConfirmation } from "./pin-modal.js";

export function updateLockStatus(lockedSites) {
  if (!state.currentHostname) return;

  state.isCurrentSiteLocked = lockedSites.some(site =>
    state.currentHostname === site || state.currentHostname.endsWith("." + site)
  );

  if (state.isCurrentSiteLocked) {
    els.statusIcon.className = "status-icon locked";
    els.lockIconSvg.innerHTML = "";
    const pathLocked = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathLocked.setAttribute("d", SVG_LOCKED_PATH);
    els.lockIconSvg.appendChild(pathLocked);
    els.statusText.textContent = "Locked";
    els.statusText.style.color = "var(--error-color)";
    els.toggleLockBtn.textContent = "Unlock This Website";
  } else {
    els.statusIcon.className = "status-icon unlocked";
    els.lockIconSvg.innerHTML = "";
    const pathUnlocked = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathUnlocked.setAttribute("d", SVG_UNLOCKED_PATH);
    els.lockIconSvg.appendChild(pathUnlocked);
    els.statusText.textContent = "Unlocked";
    els.statusText.style.color = "var(--success-color)";
    els.toggleLockBtn.textContent = "Lock This Website";
  }
}

export function renderLockedSites(lockedSites) {
  els.lockedSitesList.innerHTML = "";

  if (lockedSites.length === 0) {
    els.lockedSitesList.innerHTML = `<li class="site-item" style="color: var(--text-muted); justify-content: center; font-style: italic;">No locked websites</li>`;
    return;
  }

  lockedSites.forEach(site => {
    const li = document.createElement("li");
    li.className = "site-item";

    const span = document.createElement("span");
    span.textContent = site;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      `;
    deleteBtn.addEventListener("click", () => {
      removeSite(site);
    });

    li.appendChild(span);
    li.appendChild(deleteBtn);
    els.lockedSitesList.appendChild(li);
  });
}

export function removeSite(siteToRemove) {
  requestPinConfirmation(() => {
    wlChrome.storage.local.get("lockedSites", (data) => {
      const sites = data.lockedSites || [];
      const updatedSites = sites.filter(s => s !== siteToRemove);

      wlChrome.storage.local.set({ lockedSites: updatedSites }, () => {
        renderLockedSites(updatedSites);
        updateLockStatus(updatedSites);
        // Refresh active tab if we just unlocked its domain
        getActiveTab((activeTab) => {
          if (activeTab && activeTab.url) {
            try {
              const url = new URL(activeTab.url);
              if (url.hostname === siteToRemove || url.hostname.endsWith("." + siteToRemove)) {
                reloadTabById(activeTab.id);
              }
            } catch (e) { }
          }
        });
      });
    });
  });
}
