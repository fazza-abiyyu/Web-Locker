// Web Locker popup module: PIN confirmation modal + verification.

import { els, state } from "../state.js";
import { wlChrome } from "../lib/ext-api.js";
import { checkLockout, startLockoutCountdown, stopLockoutCountdown } from "./lockout.js";

export function requestPinConfirmation(onSuccess, onCancel) {
  checkLockout((isLocked, lockoutUntil) => {
    if (isLocked) {
      // Show locked state
      state.modalOnSuccess = onSuccess;
      state.modalOnCancel = onCancel || null;
      els.confirmActionPinInput.value = "";
      els.modalError.classList.add("hidden");
      els.lockoutCountdownText.classList.remove("hidden");
      // Disable input and confirm button
      els.confirmActionPinInput.disabled = true;
      els.modalConfirmBtn.disabled = true;
      els.modalConfirmBtn.style.opacity = "0.5";
      els.verifyModal.classList.remove("hidden");
      startLockoutCountdown(lockoutUntil);
      return;
    }

    // Normal flow - ensure input is enabled
    stopLockoutCountdown();
    els.confirmActionPinInput.disabled = false;
    els.modalConfirmBtn.disabled = false;
    els.modalConfirmBtn.style.opacity = "";
    els.lockoutCountdownText.classList.add("hidden");

    state.modalOnSuccess = onSuccess;
    state.modalOnCancel = onCancel || null;
    els.confirmActionPinInput.value = "";
    els.modalError.classList.add("hidden");
    els.verifyModal.classList.remove("hidden");
    els.confirmActionPinInput.focus();
  });
}

function processModalConfirmation() {
  if (els.confirmActionPinInput.disabled) return;

  const enteredPin = els.confirmActionPinInput.value;
  wlChrome.storage.local.get(["pin", "lockoutFailedAttempts", "lockoutAttempts", "lockoutDuration"], (data) => {
    const maxAttempts = data.lockoutAttempts !== undefined ? parseInt(data.lockoutAttempts, 10) : 5;
    const durationMinutes = data.lockoutDuration !== undefined ? parseInt(data.lockoutDuration, 10) : 5;
    const failedAttempts = data.lockoutFailedAttempts || 0;

    if (enteredPin === data.pin) {
      // Success - reset failed attempts
      wlChrome.storage.local.set({ lockoutFailedAttempts: 0, lockoutUntil: null });
      stopLockoutCountdown();
      els.verifyModal.classList.add("hidden");
      els.confirmActionPinInput.disabled = false;
      els.modalConfirmBtn.disabled = false;
      els.modalConfirmBtn.style.opacity = "";
      els.lockoutCountdownText.classList.add("hidden");
      if (state.modalOnSuccess) {
        state.modalOnSuccess();
        state.modalOnSuccess = null;
      }
    } else {
      const newFailedAttempts = failedAttempts + 1;

      if (maxAttempts > 0 && newFailedAttempts >= maxAttempts) {
        // Trigger lockout
        const lockoutUntil = Date.now() + (durationMinutes * 60 * 1000);
        wlChrome.storage.local.set({
          lockoutFailedAttempts: newFailedAttempts,
          lockoutUntil: lockoutUntil
        });
        els.modalError.textContent = `Wrong PIN. Locked out for ${durationMinutes} minute(s).`;
        els.modalError.classList.remove("hidden");
        els.confirmActionPinInput.value = "";
        els.confirmActionPinInput.disabled = true;
        els.modalConfirmBtn.disabled = true;
        els.modalConfirmBtn.style.opacity = "0.5";
        els.lockoutCountdownText.classList.remove("hidden");
        startLockoutCountdown(lockoutUntil);
      } else {
        wlChrome.storage.local.set({ lockoutFailedAttempts: newFailedAttempts });
        const remaining = maxAttempts - newFailedAttempts;
        if (maxAttempts > 0) {
          els.modalError.textContent = `Incorrect PIN. ${remaining} attempt(s) remaining.`;
        } else {
          els.modalError.textContent = "Incorrect PIN.";
        }
        els.modalError.classList.remove("hidden");
        els.confirmActionPinInput.value = "";
      }
    }
  });
}

export function initPinModalEvents() {
  els.modalCancelBtn.addEventListener("click", () => {
    els.verifyModal.classList.add("hidden");
    stopLockoutCountdown();
    els.confirmActionPinInput.disabled = false;
    els.modalConfirmBtn.disabled = false;
    els.modalConfirmBtn.style.opacity = "";
    els.lockoutCountdownText.classList.add("hidden");
    if (state.modalOnCancel) {
      state.modalOnCancel();
    }
    state.modalOnSuccess = null;
    state.modalOnCancel = null;
  });

  els.modalConfirmBtn.addEventListener("click", processModalConfirmation);
  els.confirmActionPinInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      processModalConfirmation();
    }
  });
  els.confirmActionPinInput.addEventListener("input", () => {
    if (els.confirmActionPinInput.value.length === 6) {
      processModalConfirmation();
    }
  });
}
