// Web Locker content script helper: page blocker.
// Menyembunyikan halaman secepat mungkin sebelum status lock diverifikasi,
// lalu menyembunyikan semua child body kecuali root lock screen.

const WL_BLOCKER_ID = "web-locker-blocker";

const WL_BLOCKER_INITIAL_CSS = `
    html {
      display: none !important;
      overflow: hidden !important;
    }
  `;

const WL_BLOCKER_LOCKED_CSS = `
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

function setBlockerCss(css) {
  if (!wlBlockerStyle) {
    wlBlockerStyle = document.createElement("style");
    wlBlockerStyle.setAttribute("id", WL_BLOCKER_ID);
  }
  wlBlockerStyle.innerHTML = css;
  if (!wlBlockerStyle.parentNode) {
    document.documentElement.appendChild(wlBlockerStyle);
  }
}

function showInitialBlocker() {
  setBlockerCss(WL_BLOCKER_INITIAL_CSS);
}

function showLockedBlocker() {
  setBlockerCss(WL_BLOCKER_LOCKED_CSS);
}

function removeBlocker() {
  if (wlBlockerStyle && wlBlockerStyle.parentNode) {
    wlBlockerStyle.parentNode.removeChild(wlBlockerStyle);
  }
}

function triggerLock() {
  showLockedBlocker();
  initLockScreen();
}
