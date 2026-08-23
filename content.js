(function () {
  // Only run in the top-level frame (don't block inside iframes like ads or widgets)
  if (window.self !== window.top) return;

  // Prevent double injection
  if (window.hasWebLockerInjected) return;
  window.hasWebLockerInjected = true;

  const hostname = window.location.hostname;

  function isContextValid() {
    return typeof chrome !== "undefined" && chrome.runtime && !!chrome.runtime.id;
  }

  // 1. Instantly hide the html page to prevent any leak of the original page content before verification
  const blockerStyle = document.createElement("style");
  blockerStyle.setAttribute("id", "web-locker-blocker");
  blockerStyle.innerHTML = `
    html {
      display: none !important;
      overflow: hidden !important;
    }
  `;
  document.documentElement.appendChild(blockerStyle);

  // 2. Check lock status with background worker
  if (!isContextValid()) {
    removeBlocker();
  } else {
    chrome.runtime.sendMessage({ action: "checkLockStatus", hostname }, (response) => {
      if (chrome.runtime.lastError || !response) {
        removeBlocker();
        return;
      }

      if (!response.isLocked) {
        // Not locked, reveal page immediately
        removeBlocker();
        if (response.isDomainLocked) {
          startIdleTimer();
        }
        return;
      }

      // Site is locked: adjust blocker style to reveal html but hide all children except our locker root
      blockerStyle.innerHTML = `
        html, body {
          overflow: hidden !important;
          height: 100vh !important;
          width: 100vw !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        body > :not(#web-locker-root) {
          display: none !important;
        }
      `;

      // Initialize lock UI once DOM is loaded enough (or right away since we are at document_start)
      if (document.body) {
        initLockScreen();
      } else {
        document.addEventListener("DOMContentLoaded", initLockScreen);
      }
    });
  }

  function removeBlocker() {
    if (blockerStyle && blockerStyle.parentNode) {
      blockerStyle.parentNode.removeChild(blockerStyle);
    }
  }

  // --- Idle & Timeout Handling ---
  let idleCheckInterval = null;
  let activityListeners = [];
  let lastActivity = Date.now();

  function startIdleTimer() {
    stopIdleTimer();

    if (!isContextValid()) return;

    chrome.storage.local.get("autoLockTimeout", (data) => {
      if (!isContextValid()) return;
      const timeoutMinutes = data.autoLockTimeout !== undefined ? parseInt(data.autoLockTimeout, 10) : 5;
      
      // If 0, it locks strictly on page load/navigation
      if (timeoutMinutes <= 0) return;

      const timeoutMs = timeoutMinutes * 60 * 1000;
      lastActivity = Date.now();

      const updateActivity = () => {
        lastActivity = Date.now();
      };

      const events = ["mousemove", "keydown", "click", "scroll"];
      events.forEach(event => {
        window.addEventListener(event, updateActivity, { passive: true });
        activityListeners.push({ event, listener: updateActivity });
      });

      idleCheckInterval = setInterval(() => {
        if (!isContextValid()) {
          stopIdleTimer();
          return;
        }
        if (Date.now() - lastActivity > timeoutMs) {
          chrome.runtime.sendMessage({ action: "lockSiteForTab", hostname }, () => {
            stopIdleTimer();
            triggerLock();
          });
        }
      }, 5000);
    });
  }

  function stopIdleTimer() {
    if (idleCheckInterval) {
      clearInterval(idleCheckInterval);
      idleCheckInterval = null;
    }
    activityListeners.forEach(({ event, listener }) => {
      window.removeEventListener(event, listener);
    });
    activityListeners = [];
  }

  function triggerLock() {
    // 1. Re-add blocker style if not already in document
    if (!document.getElementById("web-locker-blocker")) {
      document.documentElement.appendChild(blockerStyle);
    }
    blockerStyle.innerHTML = `
      html, body {
        overflow: hidden !important;
        height: 100vh !important;
        width: 100vw !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      body > :not(#web-locker-root) {
        display: none !important;
      }
    `;

    // 2. Load lock screen
    initLockScreen();
  }

  function initLockScreen() {
    // Check if lock screen already exists
    if (document.getElementById("web-locker-root")) return;

    const root = document.createElement("div");
    root.id = "web-locker-root";
    // Set style of root to ensure it behaves correctly outside Shadow DOM
    root.style.position = "fixed";
    root.style.top = "0";
    root.style.left = "0";
    root.style.width = "100vw";
    root.style.height = "100vh";
    root.style.zIndex = "2147483647";

    const shadow = root.attachShadow({ mode: "open" });

    // Embed content.css styles directly to bypass CSP and prevent FOUC
    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }

      .locker-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #000000;
        z-index: 2147483647;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #e5e5e7;
        overflow: hidden;
        box-sizing: border-box;
      }

      .locker-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: #000000;
        padding: 18px 22px;
        max-width: 380px;
        width: 88%;
        box-sizing: border-box;
        text-align: center;
      }

      .locker-logo {
        width: 58px;
        height: 58px;
        margin-bottom: 24px;
      }

      .locker-title {
        font-size: 28px;
        font-weight: 700;
        margin: 0 0 6px 0;
        color: #ffffff;
      }

      .locker-subtitle {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.4);
        margin: 0 0 24px 0;
        font-weight: 400;
      }

      .pin-display {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        justify-content: center;
      }

      .pin-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        transition: all 0.15s ease;
      }

      .pin-dot.filled {
        background: #ff2d75;
        box-shadow: 0 0 10px rgba(255, 45, 117, 0.6);
      }

      .pin-keypad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px 16px;
        width: 220px;
        margin: 0 auto;
      }

      .key-btn {
        background: rgba(255, 255, 255, 0.06);
        border: none;
        border-radius: 50%;
        width: 58px;
        height: 58px;
        font-size: 20px;
        font-weight: 300;
        color: #e5e5e7;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: all 0.15s ease;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        box-sizing: border-box;
      }

      .key-btn:hover {
        background: rgba(255, 45, 117, 0.2);
        color: #ff2d75;
      }

      .key-btn:active {
        transform: scale(0.95);
      }

      .key-btn.action-btn {
        font-size: 9px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.3);
        letter-spacing: 0.5px;
      }

      .key-btn.action-btn:hover {
        color: #ff2d75;
      }

      .key-btn.action-btn svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }

      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-5px); }
        40%, 80% { transform: translateX(5px); }
      }

      .locker-container.shake {
        animation: shake 0.3s ease;
      }

      .locker-container.shake .pin-dot {
        background: rgba(255, 59, 48, 0.4);
      }
      .locker-container.shake .pin-dot.filled {
        background: #ff3b30;
        box-shadow: 0 0 12px rgba(255, 59, 48, 0.6);
      }

      .message-error {
        font-size: 12px;
        color: #ff2d75;
        margin: 0 0 2px 0;
        text-align: center;
        font-weight: 500;
        opacity: 1;
        transition: opacity 0.3s ease;
        min-height: 14px;
      }

      .message-error.hiding {
        opacity: 0;
      }

      .message-info {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.3);
        margin: 0 0 16px 0;
        text-align: center;
        font-weight: 300;
        min-height: 13px;
      }

      .lockout-countdown-inline {
        font-size: 13px;
        color: #ff2d75;
        margin: 16px 0 4px 0;
        text-align: center;
        font-weight: 500;
      }

      .keypad-disabled {
        opacity: 0.4;
        pointer-events: none;
        filter: grayscale(0.5);
      }

      .keypad-hidden {
        display: none !important;
      }

      .hidden {
        display: none !important;
      }
    `;
    shadow.appendChild(style);

    // Build Lock UI Structure
    const overlay = document.createElement("div");
    overlay.className = "locker-overlay";

    overlay.innerHTML = `
      <div class="locker-container">
        <div class="locker-logo">
          <svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="lockGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style="stop-color:#ff2d75;stop-opacity:0.35" />
                <stop offset="100%" style="stop-color:#ff2d75;stop-opacity:0" />
              </radialGradient>
            </defs>
            <circle cx="28" cy="28" r="28" fill="url(#lockGlow)"/>
            <rect x="15" y="26" width="26" height="22" rx="5" fill="#ff2d75"/>
            <path d="M20 26V20a8 8 0 0 1 16 0v6" fill="none" stroke="#ff7aaa" stroke-width="3.5" stroke-linecap="round"/>
            <circle cx="28" cy="36" r="2.5" fill="#ffffff"/>
          </svg>
        </div>
        <h2 class="locker-title">Website Locked</h2>
        <p class="locker-subtitle">${hostname}</p>
        
        <div class="pin-display">
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
        </div>

        <p class="message-error hidden" id="message-error"></p>
        <p class="message-info hidden" id="message-info"></p>

        <div class="pin-keypad" id="pin-keypad">
          <button class="key-btn" data-key="1">1</button>
          <button class="key-btn" data-key="2">2</button>
          <button class="key-btn" data-key="3">3</button>
          <button class="key-btn" data-key="4">4</button>
          <button class="key-btn" data-key="5">5</button>
          <button class="key-btn" data-key="6">6</button>
          <button class="key-btn" data-key="7">7</button>
          <button class="key-btn" data-key="8">8</button>
          <button class="key-btn" data-key="9">9</button>
          <button class="key-btn action-btn" data-key="clear">CLEAR</button>
          <button class="key-btn" data-key="0">0</button>
          <button class="key-btn action-btn" data-key="backspace">
            <svg viewBox="0 0 24 24">
              <path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    shadow.appendChild(overlay);
    document.documentElement.appendChild(root);

    // Input States
    let pinInput = "";
    const container = overlay.querySelector(".locker-container");
    const dots = overlay.querySelectorAll(".pin-dot");
    const keypad = overlay.querySelector("#pin-keypad");
    const messageError = overlay.querySelector("#message-error");
    const messageInfo = overlay.querySelector("#message-info");
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
      chrome.storage.local.get(["lockoutAttempts", "lockoutDuration"], (data) => {
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
      chrome.storage.local.set({ lockoutUntil: null, lockoutFailedAttempts: 0 });
    }

    function checkAndApplyLockout() {
      if (!isContextValid()) return;
      chrome.storage.local.get(["lockoutUntil"], (data) => {
        if (data.lockoutUntil && data.lockoutUntil > Date.now()) {
          enterLockoutState(data.lockoutUntil);
        } else if (data.lockoutUntil) {
          // Expired, clear it
          chrome.storage.local.set({ lockoutUntil: null, lockoutFailedAttempts: 0 });
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
      chrome.storage.local.get(["pin", "lockoutFailedAttempts", "lockoutAttempts", "lockoutDuration"], (data) => {
        if (!isContextValid()) return;
        const actualPin = data.pin;
        const maxAttempts = data.lockoutAttempts !== undefined ? parseInt(data.lockoutAttempts, 10) : 5;
        const durationMinutes = data.lockoutDuration !== undefined ? parseInt(data.lockoutDuration, 10) : 5;
        const failedAttempts = data.lockoutFailedAttempts || 0;
        
        if (enteredPin === actualPin) {
          // Success: Unlock site for this tab
          chrome.storage.local.set({ lockoutFailedAttempts: 0, lockoutUntil: null });
          chrome.runtime.sendMessage({ action: "unlockSiteForTab", hostname }, () => {
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
            chrome.storage.local.set({
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
            chrome.storage.local.set({ lockoutFailedAttempts: newFailedAttempts });

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
})();
