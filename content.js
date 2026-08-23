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

    const container = document.createElement("div");
    container.className = "locker-container";

    const logoDiv = document.createElement("div");
    logoDiv.className = "locker-logo";
    const SVG_NS = "http://www.w3.org/2000/svg";
    const logoSvg = document.createElementNS(SVG_NS, "svg");
    logoSvg.setAttribute("viewBox", "0 0 56 56");
    logoSvg.setAttribute("xmlns", SVG_NS);

    const defs = document.createElementNS(SVG_NS, "defs");
    const gradient = document.createElementNS(SVG_NS, "radialGradient");
    gradient.setAttribute("id", "lockGlow");
    gradient.setAttribute("cx", "50%");
    gradient.setAttribute("cy", "50%");
    gradient.setAttribute("r", "50%");
    const stop1 = document.createElementNS(SVG_NS, "stop");
    stop1.setAttribute("offset", "0%");
    stop1.style.stopColor = "#ff2d75";
    stop1.style.stopOpacity = "0.35";
    const stop2 = document.createElementNS(SVG_NS, "stop");
    stop2.setAttribute("offset", "100%");
    stop2.style.stopColor = "#ff2d75";
    stop2.style.stopOpacity = "0";
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);

    const glowCircle = document.createElementNS(SVG_NS, "circle");
    glowCircle.setAttribute("cx", "28");
    glowCircle.setAttribute("cy", "28");
    glowCircle.setAttribute("r", "28");
    glowCircle.setAttribute("fill", "url(#lockGlow)");

    const lockBody = document.createElementNS(SVG_NS, "rect");
    lockBody.setAttribute("x", "15");
    lockBody.setAttribute("y", "26");
    lockBody.setAttribute("width", "26");
    lockBody.setAttribute("height", "22");
    lockBody.setAttribute("rx", "5");
    lockBody.setAttribute("fill", "#ff2d75");

    const lockShackle = document.createElementNS(SVG_NS, "path");
    lockShackle.setAttribute("d", "M20 26V20a8 8 0 0 1 16 0v6");
    lockShackle.setAttribute("fill", "none");
    lockShackle.setAttribute("stroke", "#ff7aaa");
    lockShackle.setAttribute("stroke-width", "3.5");
    lockShackle.setAttribute("stroke-linecap", "round");

    const keyhole = document.createElementNS(SVG_NS, "circle");
    keyhole.setAttribute("cx", "28");
    keyhole.setAttribute("cy", "36");
    keyhole.setAttribute("r", "2.5");
    keyhole.setAttribute("fill", "#ffffff");

    logoSvg.appendChild(defs);
    logoSvg.appendChild(glowCircle);
    logoSvg.appendChild(lockBody);
    logoSvg.appendChild(lockShackle);
    logoSvg.appendChild(keyhole);
    logoDiv.appendChild(logoSvg);

    const title = document.createElement("h2");
    title.className = "locker-title";
    title.textContent = "Website Locked";

    const subtitle = document.createElement("p");
    subtitle.className = "locker-subtitle";
    subtitle.textContent = hostname;

    const pinDisplay = document.createElement("div");
    pinDisplay.className = "pin-display";
    for (let i = 0; i < 6; i++) {
      const dot = document.createElement("div");
      dot.className = "pin-dot";
      pinDisplay.appendChild(dot);
    }

    const messageError = document.createElement("p");
    messageError.className = "message-error hidden";
    messageError.id = "message-error";

    const messageInfo = document.createElement("p");
    messageInfo.className = "message-info hidden";
    messageInfo.id = "message-info";

    const keypad = document.createElement("div");
    keypad.className = "pin-keypad";
    keypad.id = "pin-keypad";

    const keys = [
      { key: "1", label: "1" }, { key: "2", label: "2" }, { key: "3", label: "3" },
      { key: "4", label: "4" }, { key: "5", label: "5" }, { key: "6", label: "6" },
      { key: "7", label: "7" }, { key: "8", label: "8" }, { key: "9", label: "9" },
      { key: "clear", label: "CLEAR", action: true },
      { key: "0", label: "0" },
      { key: "backspace", label: "", action: true, svgD: "M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z" }
    ];
    keys.forEach(k => {
      const btn = document.createElement("button");
      btn.className = "key-btn" + (k.action ? " action-btn" : "");
      btn.dataset.key = k.key;
      if (k.svgD) {
        const svgBtn = document.createElementNS(SVG_NS, "svg");
        svgBtn.setAttribute("viewBox", "0 0 24 24");
        const pathBtn = document.createElementNS(SVG_NS, "path");
        pathBtn.setAttribute("d", k.svgD);
        svgBtn.appendChild(pathBtn);
        btn.appendChild(svgBtn);
      } else {
        btn.textContent = k.label;
      }
      keypad.appendChild(btn);
    });

    container.appendChild(logoDiv);
    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(pinDisplay);
    container.appendChild(messageError);
    container.appendChild(messageInfo);
    container.appendChild(keypad);
    overlay.appendChild(container);

    shadow.appendChild(overlay);
    document.documentElement.appendChild(root);

    // Input States
    let pinInput = "";
    const dots = pinDisplay.querySelectorAll(".pin-dot");
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
