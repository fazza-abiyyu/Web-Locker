// Web Locker content script module: in-page lock screen (PIN entry + lockout).
// Content scripts share one isolated scope, so files load in manifest order
// (see manifest.json content_scripts).

function initLockScreen() {
  // Check if lock screen already exists
  if (document.getElementById("web-locker-root")) return;

  const ui = buildLockScreenUi();
  const { root, overlay, container, pinDisplay, dots, messageError, messageInfo, keypad } = ui;

  document.documentElement.appendChild(root);

  // Input States
  let pinInput = "";
  let lockoutCountdownTimer = null;
  let errorHideTimer = null;

  function showError(msg, autoHide) {
    messageError.textContent = msg;
    messageError.classList.remove("hidden");
    messageError.classList.remove("hiding");
    // Force reflow to ensure transition works
    void messageError.offsetWidth;
    if (errorHideTimer) {
      clearTimeout(errorHideTimer);
      errorHideTimer = null;
    }
    if (autoHide) {
      errorHideTimer = setTimeout(() => {
        messageError.classList.add("hiding");
        setTimeout(() => {
          messageError.classList.add("hidden");
          messageError.classList.remove("hiding");
        }, 300);
      }, 3000);
    }
  }

  function showInfo(msg) {
    messageInfo.textContent = msg;
    messageInfo.classList.remove("hidden");
  }

  function hideError() {
    if (errorHideTimer) {
      clearTimeout(errorHideTimer);
      errorHideTimer = null;
    }
    messageError.classList.add("hidden");
    messageError.classList.remove("hiding");
  }

  function hideInfo() {
    messageInfo.classList.add("hidden");
  }

  function updateLockoutInfoText() {
    if (!isContextValid()) return;
    wlChrome.storage.local.get(["lockoutAttempts", "lockoutDuration"], (data) => {
      // No longer showing persistent lockout info text
    });
  }

  function updateDots() {
    dots.forEach((dot, index) => {
      if (index < pinInput.length) {
        dot.classList.add("filled");
      } else {
        dot.classList.remove("filled");
      }
    });
  }

  function getLockoutCountdownText(lockoutUntil) {
    const remaining = Math.max(0, lockoutUntil - Date.now());
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function enterLockoutState(lockoutUntil) {
    // Disable keypad (keep visible)
    keypad.classList.add("keypad-disabled");
    hideError();
    showError(`Too many attempts. Try again in ${getLockoutCountdownText(lockoutUntil)}`, false);
    showInfo("PIN temporarily locked");

    const updateCountdown = () => {
      const remaining = lockoutUntil - Date.now();
      if (remaining <= 0) {
        exitLockoutState();
        return;
      }
      messageError.textContent = `Too many attempts. Try again in ${getLockoutCountdownText(lockoutUntil)}`;
    };
    updateCountdown();
    lockoutCountdownTimer = setInterval(updateCountdown, 1000);
  }

  function exitLockoutState() {
    if (lockoutCountdownTimer) {
      clearInterval(lockoutCountdownTimer);
      lockoutCountdownTimer = null;
    }
    keypad.classList.remove("keypad-disabled");
    hideError();
    hideInfo();
    wlChrome.storage.local.set({ lockoutUntil: null, lockoutFailedAttempts: 0 });
  }

  function checkAndApplyLockout() {
    if (!isContextValid()) return;
    wlChrome.storage.local.get(["lockoutUntil"], (data) => {
      if (data.lockoutUntil && data.lockoutUntil > Date.now()) {
        enterLockoutState(data.lockoutUntil);
      } else if (data.lockoutUntil) {
        // Expired, clear it
        wlChrome.storage.local.set({ lockoutUntil: null, lockoutFailedAttempts: 0 });
        updateLockoutInfoText();
      } else {
        updateLockoutInfoText();
      }
    });
  }

  // Check lockout state on init
  checkAndApplyLockout();

  function handleKeyPress(key) {
    if (keypad.classList.contains("keypad-disabled")) return;

    hideError();
    hideInfo();

    if (key === "clear") {
      pinInput = "";
      updateDots();
    } else if (key === "backspace") {
      pinInput = pinInput.slice(0, -1);
      updateDots();
    } else if (/^\d$/.test(key)) {
      if (pinInput.length < 6) {
        pinInput += key;
        updateDots();

        if (pinInput.length === 6) {
          verifyPin(pinInput);
        }
      }
    }
  }

  // Keypad Click Event Listeners
  overlay.querySelectorAll(".key-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-key");
      handleKeyPress(key);
    });
  });

  // Keyboard Support
  const onKeyDown = (e) => {
    if (/^\d$/.test(e.key)) {
      handleKeyPress(e.key);
    } else if (e.key === "Backspace") {
      handleKeyPress("backspace");
    } else if (e.key === "Escape") {
      handleKeyPress("clear");
    }
  };
  window.addEventListener("keydown", onKeyDown);

  function verifyPin(enteredPin) {
    if (!isContextValid()) return;
    wlChrome.storage.local.get(["pin", "lockoutFailedAttempts", "lockoutAttempts", "lockoutDuration"], (data) => {
      if (!isContextValid()) return;
      const actualPin = data.pin;
      const maxAttempts = data.lockoutAttempts !== undefined ? parseInt(data.lockoutAttempts, 10) : 5;
      const durationMinutes = data.lockoutDuration !== undefined ? parseInt(data.lockoutDuration, 10) : 5;
      const failedAttempts = data.lockoutFailedAttempts || 0;

      if (enteredPin === actualPin) {
        // Success: Unlock site for this tab
        wlChrome.storage.local.set({ lockoutFailedAttempts: 0, lockoutUntil: null });
        wlChrome.runtime.sendMessage({ action: "unlockSiteForTab", hostname: wlHostname }, () => {
          // Fade out animations
          overlay.style.opacity = "0";
          window.removeEventListener("keydown", onKeyDown);
          if (lockoutCountdownTimer) {
            clearInterval(lockoutCountdownTimer);
            lockoutCountdownTimer = null;
          }
          setTimeout(() => {
            removeBlocker();
            if (root.parentNode) {
              root.parentNode.removeChild(root);
            }
            startIdleTimer();
          }, 400);
        });
      } else {
        const newFailedAttempts = failedAttempts + 1;

        if (maxAttempts > 0 && newFailedAttempts >= maxAttempts) {
          // Trigger lockout
          const lockoutUntil = Date.now() + (durationMinutes * 60 * 1000);
          wlChrome.storage.local.set({
            lockoutFailedAttempts: newFailedAttempts,
            lockoutUntil: lockoutUntil
          });

          // Show shake + lockout
          container.classList.add("shake");
          setTimeout(() => {
            container.classList.remove("shake");
          }, 500);
          pinInput = "";
          updateDots();
          enterLockoutState(lockoutUntil);
        } else {
          wlChrome.storage.local.set({ lockoutFailedAttempts: newFailedAttempts });

          // Fail: Trigger shake animation and clear
          container.classList.add("shake");
          setTimeout(() => {
            container.classList.remove("shake");
            pinInput = "";
            updateDots();
          }, 500);

          // Show error with auto-hide + remaining attempts
          if (maxAttempts > 0) {
            const remaining = maxAttempts - newFailedAttempts;
            showError("Wrong PIN. Try again.", true);
            showInfo(`${remaining} attempt(s) remaining`);
          } else {
            showError("Wrong PIN. Try again.", true);
            hideInfo();
          }
        }
      }
    });
  }
}
