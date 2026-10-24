# Alter

It quietly learns you, helps when it matters, and grows into a version of you.

Alter is a personal agent that lives at the OS layer instead of inside a chat window. It stays out of the way, and shows up only when you call it (⌘E) or when a small trigger appears (a selected word, a form). What it learns is yours to see, edit and delete.

**Live demo:** https://alter-demo-gamma.vercel.app

## Try it (about a minute)

The demo is a tiny OS in the browser: a menu bar, a Dock, and two apps. Alter sits above both.

1. In **Browser → Esports Daily**, select a word such as “snowballing” and press **⌘E** (or click the small “✦ Explain” chip). A short explanation appears next to the word. Click elsewhere or press Esc to dismiss it.
2. Open **Join the club**. The form fills itself from what Alter knows. Purple fields show where each value came from. Type over one and its mark disappears. **Undo** reverts everything; after that, focusing a field offers to fill again, or to stop offering on that site.
3. Open **Mail** from the Dock. Alter offers to draft a note from the article you just read.
4. Click **✦** in the menu bar to see what Alter knows (edit or delete anything) and its settings.
5. Click **See it on your phone**, scan the QR, and the phone shows the same Alter and what you just did.
6. Open **Sign in**: Alter pauses on banking sites, and password fields are never read.

## What is real today, and what is next

| Real today | Next |
|---|---|
| Context store with source, confidence and edit/delete | OS-level sensors: macOS (Accessibility API), Windows (UI Automation), Android (Autofill service + assistant role), iOS (Safari web extension + share sheet) |
| Select → explain, using the surrounding text | Always-available global ⌘E on desktop |
| Forms that fill themselves, with Auto / Ask / Off, per-site opt-out, source marks and Undo | Vault for sensitive items (explicit, encrypted, never sent to a model) |
| Email draft from what you just read (cross-app) | On-device models at the OS layer as a private first pass |
| Phone view paired by QR to the same store | Browser extension for real third-party sites |

The demo’s apps are mock pages we built, so everything on screen runs the real code path. Capturing other apps and real third-party sites needs the OS sensors above.

## How it works

One brain, many sensors. The brain (memory plus Claude) is the same everywhere; each device adds a thin sensor.

- `lib/core.ts` is the sensor core: field mapping from `autocomplete` tokens and label rules, and the rules for sensitive fields and skipped sites. These rules run in code, never in a prompt.
- `app/api/explain` and `app/api/fill` call **Claude Haiku 5.5** through the AI SDK. Both have a cached fallback and a per-session call cap, so the public demo cannot run up the bill.
- `app/api/store/[code]` is the shared store behind the phone view (Upstash Redis when configured, in-memory otherwise).
- Order of work: code first (standard fields, rules), the model only for what code cannot do (explaining, free-text drafts). Raw capture stays on the device; only derived facts are shared.

## Privacy rules

- Never read, learned or filled: password fields, payment fields, banking sites.
- Only the selected text, a field label and the facts needed for a draft are sent to Claude.
- Everything Alter learned is visible, editable and deletable. Learning can be switched off.
- No keys or `.env` files are committed; see below.

## Run it locally

```bash
pnpm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY
pnpm dev
```

| Variable | Needed for |
|---|---|
| `ANTHROPIC_API_KEY` | Live Claude answers. Without it, the demo uses cached answers. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL`, `KV_REST_API_TOKEN`) | Phone pairing on a deployed site. Without it, state lives in one server instance's memory. |

`.env*` files are git-ignored. Never commit a key.

## Stack

Next.js (App Router) on Vercel, the AI SDK with `@ai-sdk/anthropic`, Zod, Tailwind, Upstash Redis.

## Hackathon notes

Built on October 24, 2026 for Ambition for Korea (Bloom × Anthropic × Seoul AI Hub). All AI features use Claude only. New repository, no forked or earlier code.
