# 🔒 Web Locker

```
 ██╗    ██╗███████╗██████╗ ██╗     ██████╗ 
 ██║    ██║██╔════╝██╔══██╗██║     ██╔══██╗
 ██║ █╗ ██║█████╗  ██████╔╝██║     ██║  ██║
 ██║███╗██║██╔══╝  ██╔══██╗██║     ██║  ██║
 ╚███╔███╔╝███████╗██████╔╝███████╗██████╔╝
  ╚══╝╚══╝ ╚══════╝╚═════╝ ╚══════╝╚═════╝ 

 🔐 PIN Lock | ⏱️ Auto Re-Lock | 🛡️ Lockout Protection
```

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![Manifest](https://img.shields.io/badge/Manifest-V3-blue)
![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Firefox-green)
![Privacy](https://img.shields.io/badge/Privacy-Local%20Only-pink)

> 🔒 A minimalist browser extension that locks distracting websites behind a 6-digit PIN. Zero content leaks, zero tracking — just pure focus.

---

## 📷 Preview

| Lock Screen | Popup Menu | Settings |
|:---:|:---:|:---:|
| ![Lock Screen](./asset/web-lock-preview.webp) | ![Popup Menu](./asset/popup-menu.webp) | ![Settings](./asset/web-lock-preview.webp) |

---

## ✨ Features

- 🔒 **6-Digit PIN Lock** — Lock any website by domain. All subdomains are protected.
- ⏱️ **Auto Re-Lock** — Automatically re-locks websites after idle. Configurable timer.
- 🛡️ **Lockout Protection** — Too many wrong attempts? Input locks temporarily. Configurable.
- ⌨️ **Numpad + Keyboard** — Click digits or type directly. Backspace + Escape support.
- 🚫 **Zero Content Leak** — Page hidden before rendering. No flashing, no peeking.
- 💾 **Import / Export** — Backup and migrate your lock list. No account needed.
- 🌍 **Cross-Browser** — Chrome, Edge, Firefox. Single Manifest V3.
- 🌙 **AMOLED Dark Mode** — Minimal lock screen with neon pink accents. Easy on the eyes.
- 🔐 **Lockout PIN Confirmation** — Changing lockout settings requires PIN confirmation.

---

## ⚠️ How it works

> [!NOTE]
> **Web Locker Architecture**
>
> 1. **Instant page hide** — `content.js` runs at `document_start` and hides the whole page before anything renders.
> 2. **Lock check** — Content script asks the background script whether the current hostname is locked.
> 3. **Lock screen** — If locked, a Shadow DOM lock screen (logo + PIN pad) is injected.
> 4. **PIN verify** — Each digit posts to `chrome.storage.local`. On 6-digit match, unlocks the site for the configured timeout.
> 5. **Idle lock** — After idle timeout, the lock screen re-appears automatically.

Unlock state is kept in-memory per tab — nothing sensitive is cached across tabs or restarts.

---

## 🚀 Installation

Web Locker ships a **single cross-browser `manifest.json`** and runs on Chrome, Edge, and Firefox.

### Chrome / Edge

1. Download or clone this repository
2. Go to `chrome://extensions/`
3. Enable **Developer mode** in the top right corner
4. Click **Load unpacked** and select this extension folder
5. Pin the icon, set your PIN, and start locking websites!

### Firefox

1. Download or clone this repository
2. Open Firefox and go to `about:debugging`
3. Click **This Firefox**
4. Click **Load Temporary Add-on** and select the `manifest.json` file

---

## 🎮 Usage

1. Click the **Web Locker** icon in your browser toolbar
2. On a website you want to lock, click **Lock Website**
3. Reload the page — the lock screen appears
4. Enter your **6-digit PIN** to unlock
5. The site re-locks after your configured idle time

### Popup Tabs

| Tab | Purpose |
|-----|---------|
| **Lock** | Lock/unlock current website, see status |
| **List** | Add/remove locked domains |
| **Settings** | Change PIN, auto-lock timer, lockout settings |
| **Import / Export** | Backup or restore your lock list |

---

## 🔐 Security Notes

> [!IMPORTANT]
> **Privacy First**
>
> - The PIN is stored in **browser storage** (`chrome.storage.local`) on your device only.
> - There is **no backend or remote server**. All verification happens locally.
> - **No telemetry, analytics, or usage data** is collected whatsoever.
> - Lockout state persists across browser restarts (stored in local storage).
> - Import / Export files contain only your lock list — no PIN or sensitive data.

See [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) for the full data-handling statement.

---

## 🛠 Technical Details

```mermaid
graph TD
    A[Website Loads] --> B{content.js @ document_start}
    B --> C[Hide page via display:none]
    C --> D{Check if hostname locked}
    D -->|Locked| E[Inject Shadow DOM lock screen]
    D -->|Not Locked| F[Show page normally]
    E --> G[User enters PIN]
    G --> H{Verify 6-digit PIN}
    H -->|Correct| I[Unlock + start idle timer]
    H -->|Wrong| J[Increment attempt counter]
    J --> K{Attempts >= Limit?}
    K -->|Yes| L[Lock input for duration]
    K -->|No| M[Show remaining attempts]
    I --> N{Idle timeout?}
    N -->|Yes| E
    N -->|No| O[Keep unlocked]
```

**Key files:**

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration (MV3) |
| `content.js` | Page hiding + lock screen injection (Shadow DOM) |
| `popup.js` | Popup UI logic, PIN verification, settings management |
| `background.js` | Event routing, tab management, lock state coordination |

---

## 🔮 What's Next

> [!TIP]
> Future development plans for **Web Locker**:
>
> - Publishing to **Chrome Web Store** & **Firefox Add-ons**
> - Custom lock screen messages per website
> - Scheduled locking (lock sites during work hours)
> - Statistics dashboard (time spent on locked sites)

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork this repository
2. Create a feature branch
3. Submit a pull request

---

## 📝 License

MIT License — free to use in your own projects!

---

<div align="center">
Made with 🔐 for the focused community
<br>
🌟 Star us if you find this useful!
</div>