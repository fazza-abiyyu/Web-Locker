// Web Locker popup: tab helpers.
// Firefox Android sering tidak punya `currentWindow` dan akses tabs terbatas,
// jadi query {active:true} dipakai sebagai fallback.

import { tabsApi } from "./ext-api.js";

export function getActiveTab(cb) {
  if (!tabsApi || !tabsApi.query) {
    cb(null);
    return;
  }
  try {
    tabsApi.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        cb(tabs[0]);
        return;
      }
      // Fallback: any active tab with an http(s) URL
      tabsApi.query({ active: true }, (fallbackTabs) => {
        const found = (fallbackTabs || []).find(t => t.url && /^https?:/.test(t.url)) || (fallbackTabs || [])[0] || null;
        cb(found);
      });
    });
  } catch (e) {
    try {
      tabsApi.query({ active: true }, (fallbackTabs) => {
        cb((fallbackTabs || [])[0] || null);
      });
    } catch (e2) {
      cb(null);
    }
  }
}

export function reloadTabById(tabId) {
  if (!tabsApi || !tabId) return;
  try {
    if (tabsApi.reload) {
      tabsApi.reload(tabId);
    } else if (tabsApi.update) {
      tabsApi.update(tabId, { url: undefined });
    }
  } catch (e) {
    // On Firefox Android reload can fail without "tabs" host access.
    // Lock state still applies on next navigation, so this is non-fatal.
  }
}

export function isMobileFirefox() {
  return /Android|Fennec|Mobile/i.test(navigator.userAgent || "");
}
