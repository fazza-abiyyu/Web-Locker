# Web Locker — Privacy Policy

**Scope:** This policy covers the **Web Locker** browser extension.

## Overview

Web Locker is a **local-only** site-locker. It locks specific websites behind a
6-digit PIN. There is **no backend and no remote server**. All verification is
performed locally inside the browser.

## What data is collected, stored, or transmitted

- **Your PIN** — stored locally in `chrome.storage` (sync, across *your own*
  browsers only) so you can unlock protected sites. It is **not** sent anywhere.
- **Locked site list & auto-lock timeout** — stored locally in `chrome.storage`.
- **In-memory unlock state** — kept per-tab for the auto-lock timeout and
  cleared when the tab closes. Nothing sensitive is persisted across tabs or
  restarts.

## What is NOT collected

- Web Locker collects **no analytics**, **no telemetry**, and **no usage
  statistics**.
- It does **not** record visited URLs, send them to any server, or read the
  content of locked pages.
- Locked pages are hidden from render; the extension never reads or transmits
  their content.

## Third parties

Web Locker does **not** load, embed, or call any third-party service, tracker,
or analytics provider. There are no remote network requests from this extension.

## Data from other extensions

This privacy policy applies **only** to Web Locker. If you use my other
extension *BiliSub* (subtitle translation), that is a separate extension with
its own privacy policy — BiliSub forwards subtitle text to translation services
(Google Translate, Lingva, MyMemory) but Web Locker itself never does.

## Permissions

The extension requests the minimum permissions needed:

| Permission        | Use                                                |
|-------------------|----------------------------------------------------|
| `storage`         | Save PIN, locked sites, timeout (locally only).    |
| `tabs` / `activeTab` | Read active tab URL & reload tabs; unlock per-tab. |
| `<all_urls>` (host) | Hide the page (`document_start`) on every site.   |

## Changes to this policy

Any change is published in this repository. The effective date shown below
reflects the latest revision.

---

**Effective date:** August 2026
