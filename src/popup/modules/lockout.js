// Web Locker popup module: lockout state & countdown.

import { els, state } from "../state.js";
import { wlChrome } from "../lib/ext-api.js";

export function checkLockout(callback) {
  wlChrome.storage.local.get(["lockoutUntil"], (data) => {
    const now = Date.now();
    if (data.lockoutUntil && data.lockoutUntil > now) {
      callback(true, data.lockoutUntil);
    } else {
      // Expired or not set, clear it
      if (data.lockoutUntil) {
        wlChrome.storage.local.set({ lockoutUntil: null, lockoutFailedAttempts: 0 });
      }
      callback(false, 0);
    }
  });
}

export function getLockoutCountdownText(lockoutUntil) {
  const now = Date.now();
  const remaining = Math.max(0, lockoutUntil - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function startLockoutCountdown(lockoutUntil) {
  // Update the lockout text in the modal
  if (!els.lockoutCountdownText) return;

  const update = () => {
    const text = getLockoutCountdownText(lockoutUntil);
    els.lockoutCountdownText.textContent = `Locked out. Try again in ${text}`;
    const remaining = lockoutUntil - Date.now();
    if (remaining <= 0) {
      // Time expired
      els.verifyModal.classList.add("hidden");
      if (state.lockoutCountdownInterval) {
        clearInterval(state.lockoutCountdownInterval);
        state.lockoutCountdownInterval = null;
      }
      wlChrome.storage.local.set({ lockoutUntil: null, lockoutFailedAttempts: 0 });
    }
  };
  update();
  const interval = setInterval(update, 1000);
  state.lockoutCountdownInterval = interval;
}

export function stopLockoutCountdown() {
  if (state.lockoutCountdownInterval) {
    clearInterval(state.lockoutCountdownInterval);
    state.lockoutCountdownInterval = null;
  }
}
