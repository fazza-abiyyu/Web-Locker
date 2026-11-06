// Web Locker popup: shared UI helpers (resize + pesan status).

import { els } from "../state.js";

// Force popup engine re-measure tinggi popup setelah konten berubah.
// Chrome MV3 popup engine sering ngunci height di nilai awal, jadi kita
// perlu eksplisit update body height ke scrollHeight.
export function resizePopup() {
  requestAnimationFrame(() => {
    document.body.style.height = "auto";
    const h = document.body.scrollHeight;
    document.body.style.height = h + "px";
  });
}

export function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => {
    el.classList.add("hidden");
  }, 4000);
}

export function showSettingsMsg(msg, isError) {
  els.settingsMessage.textContent = msg;
  els.settingsMessage.className = isError ? "message-text error" : "message-text";
  els.settingsMessage.classList.remove("hidden");
  setTimeout(() => {
    els.settingsMessage.classList.add("hidden");
  }, 4000);
}

export function showLockoutMsg(msg, isError) {
  els.lockoutMessage.textContent = msg;
  els.lockoutMessage.className = isError ? "message-text error" : "message-text";
  els.lockoutMessage.classList.remove("hidden");
  setTimeout(() => {
    els.lockoutMessage.classList.add("hidden");
  }, 4000);
}

export function showImportMsg(msg, isError) {
  els.importMessage.textContent = msg;
  els.importMessage.className = isError ? "message-text error" : "message-text";
  els.importMessage.classList.remove("hidden");
  setTimeout(() => {
    els.importMessage.classList.add("hidden");
  }, 4000);
}
