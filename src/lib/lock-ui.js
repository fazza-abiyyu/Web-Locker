// Web Locker content script helper: builds the in-page lock screen DOM.
// Style di-embed langsung ke Shadow DOM untuk menghindari CSP dan FOUC.

const WL_SVG_NS = "http://www.w3.org/2000/svg";

const WL_LOCK_SCREEN_CSS = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }

      .locker-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw;
        height: 100vh;
        height: 100dvh;
        background: #000000;
        z-index: 2147483647;
        display: grid;
        place-items: center;
        place-content: center;
        color: #e5e5e7;
        overflow: hidden;
        box-sizing: border-box;
        margin: 0;
        padding: 16px;
      }

      .locker-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: #000000;
        padding: 18px 22px;
        max-width: 380px;
        width: 88%;
        width: min(88%, 380px);
        box-sizing: border-box;
        text-align: center;
        margin: auto;
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
        white-space: nowrap;
      }

      @media (max-width: 360px) {
        .locker-title {
          font-size: 24px;
        }
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
        grid-template-columns: repeat(3, 64px);
        gap: 14px;
        justify-content: center;
        justify-items: center;
        width: 100%;
        margin: 0;
        padding: 0;
      }

      .key-btn {
        background: rgba(255, 255, 255, 0.06);
        border: none;
        border-radius: 50%;
        width: 58px;
        height: 58px;
        margin: 0;
        padding: 0;
        justify-self: center;
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
        touch-action: manipulation;
        box-sizing: border-box;
      }

      /* Hover hanya untuk device ber-mouse. Di layar sentuh :hover akan
         "nempel" setelah tap (sticky hover) sehingga tombol pink terus. */
      @media (hover: hover) and (pointer: fine) {
        .key-btn:hover {
          background: rgba(255, 45, 117, 0.2);
          color: #ff2d75;
        }
      }

      .key-btn:active {
        transform: scale(0.95);
        background: rgba(255, 45, 117, 0.2);
        color: #ff2d75;
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

const WL_KEYPAD_KEYS = [
  { key: "1", label: "1" }, { key: "2", label: "2" }, { key: "3", label: "3" },
  { key: "4", label: "4" }, { key: "5", label: "5" }, { key: "6", label: "6" },
  { key: "7", label: "7" }, { key: "8", label: "8" }, { key: "9", label: "9" },
  { key: "clear", label: "CLEAR", action: true },
  { key: "0", label: "0" },
  { key: "backspace", label: "", action: true, svgD: "M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z" }
];

function createSvgElement(name) {
  return document.createElementNS(WL_SVG_NS, name);
}

function buildLockScreenUi() {
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
  style.textContent = WL_LOCK_SCREEN_CSS;
  shadow.appendChild(style);

  // Build Lock UI Structure
  const overlay = document.createElement("div");
  overlay.className = "locker-overlay";

  const container = document.createElement("div");
  container.className = "locker-container";

  const logoDiv = document.createElement("div");
  logoDiv.className = "locker-logo";
  const logoSvg = createSvgElement("svg");
  logoSvg.setAttribute("viewBox", "0 0 56 56");
  logoSvg.setAttribute("xmlns", WL_SVG_NS);

  const defs = createSvgElement("defs");
  const gradient = createSvgElement("radialGradient");
  gradient.setAttribute("id", "lockGlow");
  gradient.setAttribute("cx", "50%");
  gradient.setAttribute("cy", "50%");
  gradient.setAttribute("r", "50%");
  const stop1 = createSvgElement("stop");
  stop1.setAttribute("offset", "0%");
  stop1.style.stopColor = "#ff2d75";
  stop1.style.stopOpacity = "0.35";
  const stop2 = createSvgElement("stop");
  stop2.setAttribute("offset", "100%");
  stop2.style.stopColor = "#ff2d75";
  stop2.style.stopOpacity = "0";
  gradient.appendChild(stop1);
  gradient.appendChild(stop2);
  defs.appendChild(gradient);

  const glowCircle = createSvgElement("circle");
  glowCircle.setAttribute("cx", "28");
  glowCircle.setAttribute("cy", "28");
  glowCircle.setAttribute("r", "28");
  glowCircle.setAttribute("fill", "url(#lockGlow)");

  const lockBody = createSvgElement("rect");
  lockBody.setAttribute("x", "15");
  lockBody.setAttribute("y", "26");
  lockBody.setAttribute("width", "26");
  lockBody.setAttribute("height", "22");
  lockBody.setAttribute("rx", "5");
  lockBody.setAttribute("fill", "#ff2d75");

  const lockShackle = createSvgElement("path");
  lockShackle.setAttribute("d", "M20 26V20a8 8 0 0 1 16 0v6");
  lockShackle.setAttribute("fill", "none");
  lockShackle.setAttribute("stroke", "#ff7aaa");
  lockShackle.setAttribute("stroke-width", "3.5");
  lockShackle.setAttribute("stroke-linecap", "round");

  const keyhole = createSvgElement("circle");
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
  subtitle.textContent = wlHostname;

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

  WL_KEYPAD_KEYS.forEach(k => {
    const btn = document.createElement("button");
    btn.className = "key-btn" + (k.action ? " action-btn" : "");
    btn.dataset.key = k.key;
    if (k.svgD) {
      const svgBtn = createSvgElement("svg");
      svgBtn.setAttribute("viewBox", "0 0 24 24");
      const pathBtn = createSvgElement("path");
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

  return {
    root,
    shadow,
    overlay,
    container,
    pinDisplay,
    dots: pinDisplay.querySelectorAll(".pin-dot"),
    messageError,
    messageInfo,
    keypad
  };
}
