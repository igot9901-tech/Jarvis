# Trillion — Voice-First AI Executive Assistant

A local desktop AI agent with access to your calendar, email, Stripe, and files. Powered by Claude.

---

## Prerequisites

1. **Node.js 20+** — https://nodejs.org (download the LTS installer)
2. **An Anthropic API key** — https://console.anthropic.com/settings/keys

---

## Setup

```bash
# 1. Install dependencies
cd trillion
npm install

# 2. Start in dev mode
npm run dev
```

The app launches as a floating window in the bottom-right corner of your screen.

---

## First Launch

1. Click the orb → open the panel → go to **Settings**
2. Enter your **Anthropic API key** (required for everything)
3. Enter your **name** so Trillion can address you
4. Add optional integrations below

---

## Integrations

### Google Calendar + Gmail
1. Go to https://console.cloud.google.com
2. Create a new project → Enable **Google Calendar API** and **Gmail API**
3. Create **OAuth 2.0 credentials** (Desktop app type)
4. Copy the Client ID and Client Secret into Trillion Settings
5. Click **Connect Google Account** — a browser window opens for authorization

### Stripe
1. Copy your **Secret key** from https://dashboard.stripe.com/apikeys
2. Paste it into Trillion Settings → Stripe

### File System
- Default scope: `~/Documents`, `~/Desktop`, `~/Downloads`
- Customize in Settings → File System (one path per line)

---

## Usage — Example Commands

**Calendar**
- "What does my week look like?"
- "Schedule a call with Marcus tomorrow at 2pm for one hour"
- "Move my 3pm meeting to Thursday"

**Email**
- "Any emails I should know about?"
- "Did Sarah reply about the contract?"
- "Draft a follow-up to Jordan about the invoice"

**Stripe**
- "How's revenue this month?"
- "What plan is Alex on?"
- "Create an invoice for $3,000 for Acme Corp and send it"

**Files**
- "Find my notes on the Meridian project"
- "Create a project folder for the new app under Documents/Clients"
- "Read the proposal in my Downloads folder and summarize it"

**Memory**
- "Remember that Marcus at Apex is on a $5k/month retainer"
- "What do you know about Acme Corp?"

**Multi-step**
- "Prepare me for my call with Jordan tomorrow"
  *(Trillion checks calendar, pulls emails, finds relevant files, writes a prep brief)*

---

## Voice

- Click the **microphone button** or press the mic icon to start voice input
- Trillion responds by voice (text-to-speech) and text
- Toggle voice/TTS in Settings

---

## Build for Production

```bash
npm run build
npm run package
```

Output in `dist/` — installers for your platform.

---

## File Locations

| Purpose | Path |
|---|---|
| Settings & API keys | `%APPDATA%/trillion/trillion-settings.json` |
| Memory & conversations | `%APPDATA%/trillion/trillion-memory.json` |
| File backups | `~/.trillion/backups/` |
| Trillion trash | `~/.trillion/trash/` |

---

## Architecture

```
src/
├── main/           Electron main process (Node.js)
│   ├── agent/      Claude-powered agent with tool use
│   │   ├── tools/  Calendar, Email, Stripe, Filesystem, Memory
│   │   └── memory  Persistent conversation + fact memory
│   ├── ipc.ts      IPC bridge (main ↔ renderer)
│   └── window.ts   Window management
├── preload/        contextBridge (secure main↔renderer API)
└── renderer/       React UI
    ├── components/ Orb, Panel, Chat, Actions, Settings
    ├── hooks/      useVoice (Web Speech API)
    └── store/      Zustand state
```

The agent uses **Claude claude-sonnet-4-6** with full tool use and streaming. Each user message runs an agentic loop — Claude calls tools, gets results, and continues until it has a final answer.
