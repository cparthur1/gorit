# Gorit - Semester Course Content, Exams & Task Tracker

<p align="center">
  <img src="assets/img/logo.svg" alt="Gorit Logo" width="160" height="160" />
</p>

> Modern, intuitive, and responsive web application designed for students to organize semester subjects, course content, exam deadlines, and study to-do lists with real-time automatic progress calculation. Built with **Material You Expressive (Material Design 3)**.

[![License: GPL v2](https://img.shields.io/badge/License-GPL%20v2-blue.svg?style=for-the-badge)](./LICENSE)
[![DCO](https://img.shields.io/badge/DCO-Signed--off--by-green.svg?style=for-the-badge)](./DCO.txt)
[![Design: Material You](https://img.shields.io/badge/Design-Material%20You%20Expressive-3b82f7?style=for-the-badge&logo=materialdesign&logoColor=white)](#)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable%20%26%20Offline-7c3aed?style=for-the-badge)](#)
[![Local First](https://img.shields.io/badge/Storage-Local%20First%20Autosave-10b981?style=for-the-badge)](#)

---

## 🌟 Key Features

### 1. Material You Expressive (M3) Design Language
- **Tonal Color Roles:** Built around the official `#3b82f7` primary blue theme with expressive tonal containers, high-contrast surfaces, and accessible typography.
- **Organic Geometry & Shapes:** Full-pill segmented navigation, rounded card surfaces (20px-28px radiuses), and expressive micro-interactions.
- **Strict Iconography:** Built strictly with official **Google Fonts Material Symbols Rounded**—no emojis in UI components, badges, buttons, or navigation.
- **Smooth Motion & Transitions:** Emphasized decelerate curves (`cubic-bezier(0.2, 0, 0, 1)`) and tactile active feedback states.

### 2. Hierarchical Study & Task Organization
- **Semester Subjects:** Register active subjects with custom accent colors and official Material Symbols (medical, science, humanities, and general academia).
- **Course Content Units:** Organize syllabus chapters, topics, lecture modules, and exam deadlines under each subject.
- **Actionable To-Do Checklists:** Granular study checklists per content topic with instant inline entry (press `Enter` to add), in-place editing, and strike-through completion.
- **Tri-State Whole-Content Completion:** One-click toggle directly on the content header to complete or reset all nested tasks simultaneously, featuring indeterminate visual states when tasks are partially done.

### 3. Smart Chronological Exam Prioritization
- **Automated Reordering:** Subjects and course contents dynamically sort with the nearest upcoming exams at the top.
- **Visual Status Badges:**
  - `Exam Today!` (High-priority alert badge)
  - `Exam Tomorrow!` (Urgent warning badge)
  - `Exam in X days` (Upcoming deadline countdown badge)
  - `1st in line` indicator for the semester's next pending examination.

### 4. Continuous Multi-Tier Autosave & Persistence
- **Zero Data Loss:** Every single change (typing notes, toggling checkboxes, reordering dates) is saved instantly.
- **Multi-Tier Architecture:**
  1. **Immediate Browser LocalStorage:** Fast, offline-first client storage.
  2. **Continuous Server Autosave:** Automatically persists state to `data.json` on the hosting device via the built-in HTTP server (`/api/data`).
  3. **Cloud Firestore Sync:** Real-time multi-device cloud synchronization for Flashcards PRO subscribers.
- **Live Status Indicator:** Real-time pulse dot reflecting synchronization status (`Autosaved to device`, `Saving...`, `PRO Cloud Synced`, `Offline`).

### 5. Flashcards Ecosystem Integration & PRO Cloud Sync
- **Shared Firebase Auth & Firestore ([js/firebase-client.js](./js/firebase-client.js)):** Uses the exact same Firebase infrastructure as `Flashcards` (`flashcards-ead57`).
- **Unified Identity:** One-click Google Sign-In connects your account seamlessly.
- **Automatic PRO Subscription Detection:** If your account is a subscriber to Flashcards PRO (or has lifetime access), Gorit automatically unlocks real-time bidirectional cloud synchronization across all your smartphones, tablets, and computers.
- **Non-destructive Cloud Merging:** Gorit stores data under a dedicated `gorit` map inside your Firestore document with `{ merge: true }`, completely preserving your Flashcards deck slots, stats, and notebook data.
- **Free Plan Resilience:** Non-PRO users continue to enjoy 100% of Gorit's features locally via browser storage and `server.py` without any paywall restrictions on core tracking.

### 6. Internationalization & Localization (i18n)
- **Bilingual Engine ([js/i18n.js](./js/i18n.js)):** Built-in support for **Portuguese (pt-BR)** and **English (en-US)**.
- **Smart Locale Detection:** Automatically detects browser locale (defaults to `pt-BR` for Portuguese/Spanish environments, `en-US` for others).
- **Instant Header Toggle:** One-click language switcher (`PT` / `EN`) in the top app bar with live DOM updates.

### 7. Dedicated Offline Service Worker (PWA)
- **Offline Cache Architecture ([sw.js](./sw.js)):** Adopts the same PWA caching strategy as `Flashcards`.
- **Pre-cached Core Assets:** Automatically stores HTML, CSS, JavaScript, icons, and fonts for immediate offline loads.
- **Cache-First CDN Assets:** Caches Google Fonts, Material Symbols, and Canvas Confetti scripts.
- **Stale-While-Revalidate Origin Fetch:** Delivers instant cache loads while ensuring code freshness in the background.

### 8. Built-in Instant HTTP File Server & LAN Sharing
- Run `server.py` to serve the web application and instantly share lecture PDFs, study summaries, and textbook notes across devices connected to the same Wi-Fi.
- Accessible at `/files` with upload, download, and directory navigation capabilities.

---

## 🚀 How to Run

### Option 1: Built-in Python Server (Recommended)

In your terminal, inside the project folder, run:
```bash
python3 server.py
```

On startup, choose your preferred access mode:
```text
==============================================================
Gorit HTTP Server - Network Access Selection
==============================================================
Choose server access mode:
  [1] local  - Localhost only (127.0.0.1 - private to this device)
  [2] LAN    - Local Area Network (instant HTTP file serve on Wi-Fi)
  [3] WWW    - Cloudflare Tunnel (public internet link via cloudflared)
--------------------------------------------------------------
Select mode [local/LAN/WWW] (localhost/LAN/cloudfare) [1]:
```

- **Localhost Mode (`1` / `--local`):**  
  Accessible strictly on your local machine:  
  👉 [http://localhost:8080](http://localhost:8080)

- **LAN / Wi-Fi Mode (`2` / `--lan`):**  
  Binds to `0.0.0.0` and discovers your network IP. Open on your smartphone, tablet, or secondary computer:  
  👉 `http://<your-lan-ip>:8080` (e.g., `http://192.168.1.37:8080`)  
  👉 **File Sharing:** Access `http://<your-lan-ip>:8080/files` to transfer files between devices.

- **Cloudflare Tunnel Mode (`3` / `--www`):**  
  Spawns a public, secure `trycloudflare.com` tunnel URL for remote access anywhere in the world.

#### Direct CLI Flags:
```bash
python3 server.py --local        # Start immediately in localhost mode
python3 server.py --lan          # Start immediately in LAN mode
python3 server.py 9000 --lan     # Custom port on LAN
```

### Option 2: Open Directly in Browser (Standalone)
Gorit is fully client-capable and functions completely offline without server dependencies:
```bash
xdg-open index.html
```

---

## 📦 Progressive Web App (PWA) Installation

Gorit is installable as a standalone desktop or mobile web application:
- **Chrome / Edge / Chromium:** Click the install icon in the address bar or select **Install Gorit** from the menu.
- **Safari on iOS / iPadOS:** Tap the Share button and select **Add to Home Screen**.
- **Android:** Tap the banner or browser menu and select **Install App**.

The application includes high-resolution SVG and PNG icons, maskable adaptive icons (`icon-maskable-512.png`), and a compliant `manifest.webmanifest`.

---

## 📁 Project Structure

```text
gorit/
├── assets/
│   └── img/               # Vector (SVG) & high-resolution PNG icon suite
│       ├── logo.svg / logo.png
│       ├── favicon.svg / favicon.png / favicon.ico
│       ├── favicon-32x32.png / favicon-16x16.png
│       ├── apple-touch-icon.png
│       ├── icon-192.png / icon-512.png
│       └── icon-maskable-192.png / icon-maskable-512.png / icon-maskable.svg
├── css/
│   └── styles.css         # Material You Expressive (M3) design tokens and styles
├── js/
│   ├── app.js             # Core reactive application engine and storage sync
│   └── i18n.js            # Internationalization engine (pt-BR and en-US)
├── backups/               # Automated user data backup snapshots
├── index.html             # Application entry point
├── server.py              # Multi-mode HTTP server (Local / LAN / Cloudflare)
├── sw.js                  # PWA offline cache service worker
├── data.json              # Local persistent database
├── manifest.webmanifest   # PWA application manifest
├── LICENSE                # GPL-2.0 License
├── DCO.txt                # Developer Certificate of Origin 1.1
└── .nojekyll              # GitHub Pages Jekyll bypass flag
```

---

## 🛡️ License & Legal Notice

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License as published by the Free Software Foundation, version 2 (GPL-2.0)**.

This program is distributed in the hope that it will be useful, but **WITHOUT ANY WARRANTY**; without even the implied warranty of **MERCHANTABILITY** or **FITNESS FOR A PARTICULAR PURPOSE**. See the [GNU General Public License](./LICENSE) for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see [https://www.gnu.org/licenses/old-licenses/gpl-2.0.html](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html).

### Developer Certificate of Origin (DCO)
Contributions to this repository require adherence to the [Developer Certificate of Origin 1.1](./DCO.txt). All commits must be signed off (`git commit -s`).
