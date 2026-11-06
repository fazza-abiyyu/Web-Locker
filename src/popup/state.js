// Web Locker popup: cached DOM references + mutable UI state.
// Module script berjalan setelah DOM parse, jadi referensi bisa diambil langsung.

export const els = {
  setupView: document.getElementById("setup-view"),
  mainView: document.getElementById("main-view"),

  tabBtns: document.querySelectorAll(".tab-btn"),
  tabContents: document.querySelectorAll(".tab-content"),

  currentHostname: document.getElementById("current-hostname"),
  statusIcon: document.getElementById("status-icon"),
  lockIconSvg: document.getElementById("lock-icon-svg"),
  statusText: document.getElementById("status-text"),
  toggleLockBtn: document.getElementById("toggle-lock-btn"),

  setupPinInput: document.getElementById("setup-pin"),
  setupPinConfirmInput: document.getElementById("setup-pin-confirm"),
  saveInitialPinBtn: document.getElementById("save-initial-pin-btn"),
  setupError: document.getElementById("setup-error"),

  newSiteInput: document.getElementById("new-site-input"),
  addSiteBtn: document.getElementById("add-site-btn"),
  lockedSitesList: document.getElementById("locked-sites-list"),

  oldPinInput: document.getElementById("old-pin"),
  newPinInput: document.getElementById("new-pin"),
  confirmNewPinInput: document.getElementById("confirm-new-pin"),
  changePinBtn: document.getElementById("change-pin-btn"),
  settingsMessage: document.getElementById("settings-message"),

  lockoutAttemptsSelect: document.getElementById("lockout-attempts"),
  lockoutDurationSelect: document.getElementById("lockout-duration"),
  lockoutMessage: document.getElementById("lockout-message"),

  timeoutSelect: document.getElementById("auto-lock-timeout"),

  verifyModal: document.getElementById("verify-modal"),
  confirmActionPinInput: document.getElementById("confirm-action-pin"),
  modalCancelBtn: document.getElementById("modal-cancel-btn"),
  modalConfirmBtn: document.getElementById("modal-confirm-btn"),
  modalError: document.getElementById("modal-error"),
  lockoutCountdownText: document.getElementById("lockout-countdown-text"),

  exportBtn: document.getElementById("export-btn"),
  importBtn: document.getElementById("import-btn"),
  importFileInput: document.getElementById("import-file-input"),
  importMessage: document.getElementById("import-message"),

  importModal: document.getElementById("import-modal"),
  importNewPin: document.getElementById("import-new-pin"),
  importConfirmPin: document.getElementById("import-confirm-pin"),
  importCancelBtn: document.getElementById("import-cancel-btn"),
  importConfirmBtn: document.getElementById("import-confirm-btn"),
  importModalError: document.getElementById("import-modal-error"),
  importModalDesc: document.getElementById("import-modal-desc")
};

export const state = {
  currentHostname: "",
  isCurrentSiteLocked: false,
  modalOnSuccess: null,
  modalOnCancel: null,
  lockoutCountdownInterval: null,
  pendingImportedSites: null
};

// Lock Icon SVGs
export const SVG_LOCKED_PATH = "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z";
export const SVG_UNLOCKED_PATH = "M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z";
