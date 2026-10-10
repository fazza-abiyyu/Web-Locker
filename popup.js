document.addEventListener("DOMContentLoaded", () => {
  // Cross-browser namespace shim (Firefox Android exposes `browser`, Chrome `chrome`)
  const extApi = typeof browser !== "undefined" ? browser : chrome;
  const tabsApi = (extApi.tabs || chrome.tabs);

  // Firefox Android: `currentWindow` is often undefined, and tabs API can be
  // restricted. Fall back to a plain {active:true} query.
  function getActiveTab(cb) {
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

  function reloadTabById(tabId) {
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

  function isMobileFirefox() {
    return /Android|Fennec|Mobile/i.test(navigator.userAgent || "");
  }

  // Force popup engine re-measure tinggi popup setelah konten berubah.
  // Chrome MV3 popup engine sering ngunci height di nilai awal, jadi kita
  // perlu eksplisit update body height ke scrollHeight.
  function resizePopup() {
    requestAnimationFrame(() => {
      document.body.style.height = "auto";
      const h = document.body.scrollHeight;
      document.body.style.height = h + "px";
    });
  }

  const setupView = document.getElementById("setup-view");
  const mainView = document.getElementById("main-view");

  // Tab Elements
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // Current Site Elements
  const currentHostnameEl = document.getElementById("current-hostname");
  const statusIcon = document.getElementById("status-icon");
  const lockIconSvg = document.getElementById("lock-icon-svg");
  const statusText = document.getElementById("status-text");
  const toggleLockBtn = document.getElementById("toggle-lock-btn");

  // Setup PIN Elements
  const setupPinInput = document.getElementById("setup-pin");
  const setupPinConfirmInput = document.getElementById("setup-pin-confirm");
  const saveInitialPinBtn = document.getElementById("save-initial-pin-btn");
  const setupError = document.getElementById("setup-error");

  // Manage Sites Elements
  const newSiteInput = document.getElementById("new-site-input");
  const addSiteBtn = document.getElementById("add-site-btn");
  const lockedSitesList = document.getElementById("locked-sites-list");

  // Settings PIN Elements
  const oldPinInput = document.getElementById("old-pin");
  const newPinInput = document.getElementById("new-pin");
  const confirmNewPinInput = document.getElementById("confirm-new-pin");
  const changePinBtn = document.getElementById("change-pin-btn");
  const settingsMessage = document.getElementById("settings-message");

  // Lockout Settings Elements
  const lockoutAttemptsSelect = document.getElementById("lockout-attempts");
  const lockoutDurationSelect = document.getElementById("lockout-duration");
  const lockoutMessage = document.getElementById("lockout-message");

  let currentHostname = "";
  let isCurrentSiteLocked = false;

  // Lock Icon SVGs
  const SVG_LOCKED_PATH = "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z";
  const SVG_UNLOCKED_PATH = "M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z";

  // Check if PIN is already set
  chrome.storage.local.get(["pin", "lockedSites"], (data) => {
    if (!data.pin) {
      setupView.classList.remove("hidden");
      mainView.classList.add("hidden");
    } else {
      setupView.classList.add("hidden");
      mainView.classList.remove("hidden");
      initDashboard(data.lockedSites || []);
    }
  });

  // --- Initial PIN Setup ---
  saveInitialPinBtn.addEventListener("click", () => {
    const pin = setupPinInput.value;
    const confirmPin = setupPinConfirmInput.value;

    if (pin.length !== 6 || confirmPin.length !== 6) {
      showError(setupError, "PIN must be 6 digits.");
      return;
    }
    if (!/^\d{6}$/.test(pin) || !/^\d{6}$/.test(confirmPin)) {
      showError(setupError, "PIN may only contain numbers.");
      return;
    }
    if (pin !== confirmPin) {
      showError(setupError, "PIN confirmation does not match.");
      return;
    }

    chrome.storage.local.set({ pin, lockedSites: [] }, () => {
      setupView.classList.add("hidden");
      mainView.classList.remove("hidden");
      initDashboard([]);
    });
  });

  // --- Dashboard Initialization ---
  function initDashboard(lockedSites) {
    // 1. Tab Switching
    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        tabBtns.forEach(b => b.classList.remove("active"));
        tabContents.forEach(c => c.classList.remove("active"));

        btn.classList.add("active");
        const tabId = btn.getAttribute("data-tab");
        document.getElementById(tabId).classList.add("active");
        resizePopup();
      });
    });

    // 2. Fetch Active Tab URL Information
    getActiveTab((__activeTab) => { const tabs = __activeTab ? [__activeTab] : [];
      if (tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          currentHostname = url.hostname;

          if (["http:", "https:"].includes(url.protocol)) {
            currentHostnameEl.textContent = currentHostname;
            updateLockStatus(lockedSites);
          } else {
            // Internal pages like chrome://, etc.
            currentHostnameEl.textContent = "Browser Internal Page";
            toggleLockBtn.disabled = true;
            toggleLockBtn.style.opacity = "0.5";
            toggleLockBtn.textContent = "Cannot be locked";
          }
        } catch (e) {
          currentHostnameEl.textContent = "Unsupported URL";
          toggleLockBtn.disabled = true;
        }
      }
    });

    // 3. Render list of locked sites
    renderLockedSites(lockedSites);

    // 4. Toggle Current Site Lock Click Handlers
    toggleLockBtn.addEventListener("click", () => {
      if (!currentHostname) return;

      chrome.storage.local.get("lockedSites", (data) => {
        let sites = data.lockedSites || [];
        if (isCurrentSiteLocked) {
          // Unlock it -> REQUIRES PIN
          requestPinConfirmation(() => {
            sites = sites.filter(s => s !== currentHostname);
            saveToggleLock(sites);
          });
        } else {
          // Lock it -> NO PIN REQUIRED
          if (!sites.includes(currentHostname)) {
            sites.push(currentHostname);
          }
          saveToggleLock(sites);
        }
      });
    });

    function saveToggleLock(sites) {
      chrome.storage.local.set({ lockedSites: sites }, () => {
        updateLockStatus(sites);
        renderLockedSites(sites);
        // Reload active tab to immediately apply locker overlay if locked,
        // or unlock if removed.
        getActiveTab((__activeTab) => { const tabs = __activeTab ? [__activeTab] : [];
          if (tabs[0]) {
            reloadTabById(tabs[0].id);
          }
        });
      });
    }

    // 5. Add Custom Site Event
    addSiteBtn.addEventListener("click", () => {
      const inputVal = newSiteInput.value.trim().toLowerCase();
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

      chrome.storage.local.get("lockedSites", (data) => {
        const sites = data.lockedSites || [];
        if (!sites.includes(cleanHost)) {
          sites.push(cleanHost);
          chrome.storage.local.set({ lockedSites: sites }, () => {
            renderLockedSites(sites);
            newSiteInput.value = "";
            updateLockStatus(sites);
          });
        }
      });
    });

    // Enter Key to Add Site
    newSiteInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        addSiteBtn.click();
      }
    });

    // 6. Update PIN Settings Event
    changePinBtn.addEventListener("click", () => {
      const oldPin = oldPinInput.value;
      const newPin = newPinInput.value;
      const confirmNewPin = confirmNewPinInput.value;

      chrome.storage.local.get("pin", (data) => {
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

        chrome.storage.local.set({ pin: newPin }, () => {
          showSettingsMsg("PIN updated successfully!", false);
          oldPinInput.value = "";
          newPinInput.value = "";
          confirmNewPinInput.value = "";
        });
      });
    });

    // 7. Auto-lock Timeout Event
    const timeoutSelect = document.getElementById("auto-lock-timeout");
    chrome.storage.local.get("autoLockTimeout", (data) => {
      // Default to 5 minutes if not set
      const currentTimeout = data.autoLockTimeout !== undefined ? data.autoLockTimeout : "5";
      timeoutSelect.value = currentTimeout;
    });

    timeoutSelect.addEventListener("change", () => {
      const selectedValue = timeoutSelect.value;
      chrome.storage.local.set({ autoLockTimeout: selectedValue }, () => {
        showSettingsMsg("Auto-lock timeout updated!", false);
      });
    });

    // 8. Lockout Settings
    chrome.storage.local.get(["lockoutAttempts", "lockoutDuration"], (data) => {
      const defaultAttempts = data.lockoutAttempts !== undefined ? data.lockoutAttempts : "5";
      const defaultDuration = data.lockoutDuration !== undefined ? data.lockoutDuration : "5";
      lockoutAttemptsSelect.value = defaultAttempts;
      lockoutAttemptsSelect.dataset.current = defaultAttempts;
      lockoutDurationSelect.value = defaultDuration;
      lockoutDurationSelect.dataset.current = defaultDuration;
      // Save defaults to storage if not already set
      if (data.lockoutAttempts === undefined || data.lockoutDuration === undefined) {
        chrome.storage.local.set({
          lockoutAttempts: defaultAttempts,
          lockoutDuration: defaultDuration
        });
      }
    });

    lockoutAttemptsSelect.addEventListener("change", () => {
      const newValue = lockoutAttemptsSelect.value;
      const oldValue = lockoutAttemptsSelect.dataset.current || "5";
      requestPinConfirmation(
        () => {
          lockoutAttemptsSelect.dataset.current = newValue;
          chrome.storage.local.set({ lockoutAttempts: newValue }, () => {
            showLockoutMsg("Lockout attempts updated!", false);
          });
        },
        () => {
          lockoutAttemptsSelect.value = oldValue;
        }
      );
    });

    lockoutDurationSelect.addEventListener("change", () => {
      const newValue = lockoutDurationSelect.value;
      const oldValue = lockoutDurationSelect.dataset.current || "5";
      requestPinConfirmation(
        () => {
          lockoutDurationSelect.dataset.current = newValue;
          chrome.storage.local.set({ lockoutDuration: newValue }, () => {
            showLockoutMsg("Lockout duration updated!", false);
          });
        },
        () => {
          lockoutDurationSelect.value = oldValue;
        }
      );
    });
  }

  // --- Helper Functions ---
  function updateLockStatus(lockedSites) {
    if (!currentHostname) return;

    isCurrentSiteLocked = lockedSites.some(site =>
      currentHostname === site || currentHostname.endsWith("." + site)
    );

    if (isCurrentSiteLocked) {
      statusIcon.className = "status-icon locked";
      lockIconSvg.innerHTML = "";
      const pathLocked = document.createElementNS("http://www.w3.org/2000/svg", "path");
      pathLocked.setAttribute("d", SVG_LOCKED_PATH);
      lockIconSvg.appendChild(pathLocked);
      statusText.textContent = "Locked";
      statusText.style.color = "var(--error-color)";
      toggleLockBtn.textContent = "Unlock This Website";
    } else {
      statusIcon.className = "status-icon unlocked";
      lockIconSvg.innerHTML = "";
      const pathUnlocked = document.createElementNS("http://www.w3.org/2000/svg", "path");
      pathUnlocked.setAttribute("d", SVG_UNLOCKED_PATH);
      lockIconSvg.appendChild(pathUnlocked);
      statusText.textContent = "Unlocked";
      statusText.style.color = "var(--success-color)";
      toggleLockBtn.textContent = "Lock This Website";
    }
  }

  function renderLockedSites(lockedSites) {
    lockedSitesList.innerHTML = "";

    if (lockedSites.length === 0) {
      lockedSitesList.innerHTML = `<li class="site-item" style="color: var(--text-muted); justify-content: center; font-style: italic;">No locked websites</li>`;
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
      lockedSitesList.appendChild(li);
    });
  }

  function removeSite(siteToRemove) {
    requestPinConfirmation(() => {
      chrome.storage.local.get("lockedSites", (data) => {
        const sites = data.lockedSites || [];
        const updatedSites = sites.filter(s => s !== siteToRemove);

        chrome.storage.local.set({ lockedSites: updatedSites }, () => {
          renderLockedSites(updatedSites);
          updateLockStatus(updatedSites);
          // Refresh active tab if we just unlocked its domain
          getActiveTab((__activeTab) => { const tabs = __activeTab ? [__activeTab] : [];
            if (tabs[0] && tabs[0].url) {
              try {
                const url = new URL(tabs[0].url);
                if (url.hostname === siteToRemove || url.hostname.endsWith("." + siteToRemove)) {
                  reloadTabById(tabs[0].id);
                }
              } catch (e) { }
            }
          });
        });
      });
    });
  }

  // --- PIN Verification Modal Logic ---
  const verifyModal = document.getElementById("verify-modal");
  const confirmActionPinInput = document.getElementById("confirm-action-pin");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const modalConfirmBtn = document.getElementById("modal-confirm-btn");
  const modalError = document.getElementById("modal-error");

  let currentOnSuccessCallback = null;
  let currentOnCancelCallback = null;

  function requestPinConfirmation(onSuccess, onCancel) {
    checkLockout((isLocked, lockoutUntil) => {
      if (isLocked) {
        // Show locked state
        currentOnSuccessCallback = onSuccess;
        currentOnCancelCallback = onCancel || null;
        confirmActionPinInput.value = "";
        modalError.classList.add("hidden");
        document.getElementById("lockout-countdown-text").classList.remove("hidden");
        // Disable input and confirm button
        confirmActionPinInput.disabled = true;
        modalConfirmBtn.disabled = true;
        modalConfirmBtn.style.opacity = "0.5";
        verifyModal.classList.remove("hidden");
        startLockoutCountdown(lockoutUntil);
        return;
      }

      // Normal flow - ensure input is enabled
      stopLockoutCountdown();
      confirmActionPinInput.disabled = false;
      modalConfirmBtn.disabled = false;
      modalConfirmBtn.style.opacity = "";
      document.getElementById("lockout-countdown-text").classList.add("hidden");

      currentOnSuccessCallback = onSuccess;
      currentOnCancelCallback = onCancel || null;
      confirmActionPinInput.value = "";
      modalError.classList.add("hidden");
      verifyModal.classList.remove("hidden");
      confirmActionPinInput.focus();
    });
  }

  modalCancelBtn.addEventListener("click", () => {
    verifyModal.classList.add("hidden");
    stopLockoutCountdown();
    confirmActionPinInput.disabled = false;
    modalConfirmBtn.disabled = false;
    modalConfirmBtn.style.opacity = "";
    document.getElementById("lockout-countdown-text").classList.add("hidden");
    if (currentOnCancelCallback) {
      currentOnCancelCallback();
    }
    currentOnSuccessCallback = null;
    currentOnCancelCallback = null;
  });

  function processModalConfirmation() {
    if (confirmActionPinInput.disabled) return;

    const enteredPin = confirmActionPinInput.value;
    chrome.storage.local.get(["pin", "lockoutFailedAttempts", "lockoutAttempts", "lockoutDuration"], (data) => {
      const maxAttempts = data.lockoutAttempts !== undefined ? parseInt(data.lockoutAttempts, 10) : 5;
      const durationMinutes = data.lockoutDuration !== undefined ? parseInt(data.lockoutDuration, 10) : 5;
      const failedAttempts = data.lockoutFailedAttempts || 0;

      if (enteredPin === data.pin) {
        // Success - reset failed attempts
        chrome.storage.local.set({ lockoutFailedAttempts: 0, lockoutUntil: null });
        stopLockoutCountdown();
        verifyModal.classList.add("hidden");
        confirmActionPinInput.disabled = false;
        modalConfirmBtn.disabled = false;
        modalConfirmBtn.style.opacity = "";
        document.getElementById("lockout-countdown-text").classList.add("hidden");
        if (currentOnSuccessCallback) {
          currentOnSuccessCallback();
          currentOnSuccessCallback = null;
        }
      } else {
        const newFailedAttempts = failedAttempts + 1;

        if (maxAttempts > 0 && newFailedAttempts >= maxAttempts) {
          // Trigger lockout
          const lockoutUntil = Date.now() + (durationMinutes * 60 * 1000);
          chrome.storage.local.set({
            lockoutFailedAttempts: newFailedAttempts,
            lockoutUntil: lockoutUntil
          });
          modalError.textContent = `Wrong PIN. Locked out for ${durationMinutes} minute(s).`;
          modalError.classList.remove("hidden");
          confirmActionPinInput.value = "";
          confirmActionPinInput.disabled = true;
          modalConfirmBtn.disabled = true;
          modalConfirmBtn.style.opacity = "0.5";
          document.getElementById("lockout-countdown-text").classList.remove("hidden");
          startLockoutCountdown(lockoutUntil);
        } else {
          chrome.storage.local.set({ lockoutFailedAttempts: newFailedAttempts });
          const remaining = maxAttempts - newFailedAttempts;
          if (maxAttempts > 0) {
            modalError.textContent = `Incorrect PIN. ${remaining} attempt(s) remaining.`;
          } else {
            modalError.textContent = "Incorrect PIN.";
          }
          modalError.classList.remove("hidden");
          confirmActionPinInput.value = "";
        }
      }
    });
  }

  modalConfirmBtn.addEventListener("click", processModalConfirmation);
  confirmActionPinInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      processModalConfirmation();
    }
  });
  confirmActionPinInput.addEventListener("input", () => {
    if (confirmActionPinInput.value.length === 6) {
      processModalConfirmation();
    }
  });

  function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => {
      el.classList.add("hidden");
    }, 4000);
  }

  function showSettingsMsg(msg, isError) {
    settingsMessage.textContent = msg;
    settingsMessage.className = isError ? "message-text error" : "message-text";
    settingsMessage.classList.remove("hidden");
    setTimeout(() => {
      settingsMessage.classList.add("hidden");
    }, 4000);
  }

  function showLockoutMsg(msg, isError) {
    lockoutMessage.textContent = msg;
    lockoutMessage.className = isError ? "message-text error" : "message-text";
    lockoutMessage.classList.remove("hidden");
    setTimeout(() => {
      lockoutMessage.classList.add("hidden");
    }, 4000);
  }

  // --- Lockout Logic ---
  function checkLockout(callback) {
    chrome.storage.local.get(["lockoutUntil"], (data) => {
      const now = Date.now();
      if (data.lockoutUntil && data.lockoutUntil > now) {
        callback(true, data.lockoutUntil);
      } else {
        // Expired or not set, clear it
        if (data.lockoutUntil) {
          chrome.storage.local.set({ lockoutUntil: null, lockoutFailedAttempts: 0 });
        }
        callback(false, 0);
      }
    });
  }

  function getLockoutCountdownText(lockoutUntil) {
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

  function startLockoutCountdown(lockoutUntil) {
    // Update the lockout text in the modal
    const lockoutText = document.getElementById("lockout-countdown-text");
    if (!lockoutText) return;

    const update = () => {
      const text = getLockoutCountdownText(lockoutUntil);
      lockoutText.textContent = `Locked out. Try again in ${text}`;
      const remaining = lockoutUntil - Date.now();
      if (remaining <= 0) {
        // Time expired
        verifyModal.classList.add("hidden");
        if (lockoutCountdownInterval) {
          clearInterval(lockoutCountdownInterval);
          lockoutCountdownInterval = null;
        }
        chrome.storage.local.set({ lockoutUntil: null, lockoutFailedAttempts: 0 });
      }
    };
    update();
    const interval = setInterval(update, 1000);
    lockoutCountdownInterval = interval;
  }

  let lockoutCountdownInterval = null;

  function stopLockoutCountdown() {
    if (lockoutCountdownInterval) {
      clearInterval(lockoutCountdownInterval);
      lockoutCountdownInterval = null;
    }
  }

  // --- Export / Import Backup ---
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importFileInput = document.getElementById("import-file-input");
  const importMessage = document.getElementById("import-message");

  const importModal = document.getElementById("import-modal");
  const importNewPin = document.getElementById("import-new-pin");
  const importConfirmPin = document.getElementById("import-confirm-pin");
  const importCancelBtn = document.getElementById("import-cancel-btn");
  const importConfirmBtn = document.getElementById("import-confirm-btn");
  const importModalError = document.getElementById("import-modal-error");
  const importModalDesc = document.getElementById("import-modal-desc");

  let pendingImportedSites = null;

  function showImportMsg(msg, isError) {
    importMessage.textContent = msg;
    importMessage.className = isError ? "message-text error" : "message-text";
    importMessage.classList.remove("hidden");
    setTimeout(() => {
      importMessage.classList.add("hidden");
    }, 4000);
  }

  exportBtn.addEventListener("click", () => {
    chrome.storage.local.get(["lockedSites", "autoLockTimeout"], (data) => {
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
  });

  importBtn.addEventListener("click", () => {
    importFileInput.click();
  });

  importFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);

        if (!data.version || !Array.isArray(data.lockedSites)) {
          throw new Error("Invalid backup file format.");
        }

        pendingImportedSites = {
          lockedSites: data.lockedSites.filter(s => typeof s === "string"),
          autoLockTimeout: data.autoLockTimeout || "5"
        };

        importModalDesc.textContent = `Restore ${pendingImportedSites.lockedSites.length} site(s)? Set a new 6-digit PIN to continue.`;
        importNewPin.value = "";
        importConfirmPin.value = "";
        importModalError.classList.add("hidden");
        importModal.classList.remove("hidden");
        importNewPin.focus();
      } catch (err) {
        showImportMsg("Invalid backup file. Please select a valid Web Locker backup.", true);
      }
    };
    reader.readAsText(file);
    importFileInput.value = "";
  });

  importCancelBtn.addEventListener("click", () => {
    importModal.classList.add("hidden");
    pendingImportedSites = null;
  });

  importConfirmBtn.addEventListener("click", () => {
    const newPin = importNewPin.value;
    const confirmPin = importConfirmPin.value;

    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      importModalError.textContent = "PIN must be 6 digits.";
      importModalError.classList.remove("hidden");
      return;
    }
    if (newPin !== confirmPin) {
      importModalError.textContent = "PIN confirmation does not match.";
      importModalError.classList.remove("hidden");
      return;
    }

    if (!pendingImportedSites) {
      importModal.classList.add("hidden");
      return;
    }

    chrome.storage.local.set({
      pin: newPin,
      lockedSites: pendingImportedSites.lockedSites,
      autoLockTimeout: pendingImportedSites.autoLockTimeout
    }, () => {
      importModal.classList.add("hidden");
      pendingImportedSites = null;

      showImportMsg("Backup restored successfully!", false);

      // Refresh the dashboard
      chrome.storage.local.get("lockedSites", (data) => {
        renderLockedSites(data.lockedSites || []);
        updateLockStatus(data.lockedSites || []);
      });

      // Reload current tab if it's now locked by imported sites
      getActiveTab((__activeTab) => { const tabs = __activeTab ? [__activeTab] : [];
        if (tabs[0] && tabs[0].url) {
          try {
            const url = new URL(tabs[0].url);
            const hostname = url.hostname;
            const isLocked = (pendingImportedSites.lockedSites || []).some(
              s => hostname === s || hostname.endsWith("." + s)
            );
            if (isLocked) {
              reloadTabById(tabs[0].id);
            }
          } catch (e) { }
        }
      });
    });
  });

  importNewPin.addEventListener("keydown", (e) => {
    if (e.key === "Enter") importConfirmBtn.click();
  });
  importConfirmPin.addEventListener("keydown", (e) => {
    if (e.key === "Enter") importConfirmBtn.click();
  });

  // Auto-resize popup setiap konten DOM berubah
  // (tab switch, list update, modal show/hide, message).
  const resizeObserver = new MutationObserver(resizePopup);
  resizeObserver.observe(document.body, { childList: true, subtree: true, attributes: true });

  // Initial resize setelah render awal
  resizePopup();
});
