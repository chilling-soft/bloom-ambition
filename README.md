# Alter

조용히 나를 배우고, 필요할 때 먼저 돕고, 나를 닮아 가요.
(It quietly learns you, helps when it matters, and grows into a version of you.)

Alter is a personal agent that lives at the OS layer instead of inside a chat window. It stays out of the way and shows up only when you call it (⌘E) or when a small signal appears (a selected word, a form, a long stay on a paragraph). What it learns is yours to see, edit and delete, and it follows you across apps and devices.

**Live demo:** https://alter-demo-gamma.vercel.app (Korean UI; the demo user is a graduate student reading about AlphaFold 3)

## Try it (about two minutes)

The demo is a tiny OS in the browser: a menu bar, a Dock, and three apps (Browser, Mail, and the Alter dashboard). Alter sits above all of them. A "Alter 써 보기" checklist on the left ticks itself as you go.

1. **Browser → Nature (an AlphaFold 3 excerpt, CC BY 4.0).** Just read. After a few seconds Alter offers help on its own: *easier explanation*, *3-line summary*, or *next article*. Or select a dotted word such as “diffusion 모듈” and press **⌘E** for a short explanation next to it. Click elsewhere or press Esc to dismiss.
2. **세미나 신청.** The form fills itself, with the source of every value shown in purple. Type over a value and its mark disappears. **되돌리기** reverts everything; after that, focusing a field offers to fill again, or to stop offering on that site.
3. **Mail.** Alter offers a reply draft built from what you just read in the browser.
4. **✦ in the Dock** opens the Alter dashboard: today’s rings, what you left in progress across apps and devices (with a resume button), and what Alter picked for today. Type or speak a question to Alter.
5. **✦ in the menu bar** opens rings, today’s picks, **Alter가 아는 것** (edit or delete anything) and settings, including how proactive Alter should be.
6. **⌘E with nothing selected** opens a palette: type any question, or pick an action that fits where you are.
7. **QR → phone.** The phone shows the same Alter: rings, what you were reading, what Alter knows.
8. **카드사 tab:** Alter pauses on banking sites, and password fields are never read.

## Gamification, kept small

Rings, one per interest (생활, 바이오, AI·개발, 이스포츠), count the tasks you finish today (a summary you took, a form filled, a next step done), against a small daily goal you set. A closed ring shows “완료했어요”. Nothing is ever taken away; an unfilled ring is just empty today. The rings live in the menu-bar window and the dashboard, never in the way of what you are doing.

## What is real today, and what is next

| Real today | Next |
|---|---|
| Context store with source, confidence and edit/delete, shared with the phone | OS-level sensors: macOS (Accessibility API), Windows (UI Automation), Android (Autofill service + assistant role), iOS (Safari web extension + share sheet) |
| Select → explain; stuck-reading offer with easier explanation, 3-line summary; learns whether you want such offers | Global ⌘E on desktop and system voice |
| Forms that fill themselves: Auto / Ask / Off, per-site opt-out, source marks, Undo | Vault backed by the OS keychain (the demo vault is browser-only, encrypted, fake values, fills only on tap) |
| Reply draft from what you just read (cross-app); typed and spoken questions | On-device OS models as a private first pass |
| Daily rings, dashboard with resume across apps and devices | Real capture of other apps (the dashboard’s in-progress list is sample data today) |

The demo apps are pages we built, so everything on screen runs the real code path. The “진행중인 일” list are sample data, not captured from a real machine.

## How it works

One brain, many sensors. The brain (memory plus Claude) is the same everywhere; each device adds a thin sensor.

- `lib/core.ts`: field mapping from `autocomplete` tokens and Korean/English label rules, and the rules for sensitive fields and skipped sites. These run in code, never in a prompt.
- `app/api/*`: `explain`, `fill`, `glance` (gist and follow-up questions) and `ask` call **Claude Haiku 5.5** through the AI SDK. `explain`, `fill` and `glance` have a cached fallback (`ask` shows an explicit error instead), and a per-session call cap, so the public demo cannot run up the bill.
- `components/useGlance.ts`: Alter reads along and offers help on its own; opening it or passing on it is learned as a habit, and after repeated passes Alter waits for ⌘E.
- `app/api/store/[code]`: the shared store behind the phone view (Upstash Redis when configured, in-memory otherwise).
- Order of work: code first (standard fields, rules), the model only for what code cannot do. Raw capture stays on the device; identity details (name, email, affiliation) never leave the browser, and only derived facts (interests, activity, habits) reach the server and the model.

## Privacy rules

- Never read, learned or filled: password fields, payment fields, banking sites.
- Only the selected text, a field label and the facts needed for an answer are sent to Claude.
- Everything Alter learned is visible, editable and deletable. Learning can be switched off, and so can rings and proactive offers.
- No keys or `.env` files are committed.

## Run it locally

```bash
pnpm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY
pnpm dev
```

| Variable | Needed for |
|---|---|
| `ANTHROPIC_API_KEY` | Live Claude answers. Without it, the demo uses cached answers. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL`, `KV_REST_API_TOKEN`) | Phone pairing on a deployed site. Without it, state lives in one server instance’s memory. |

`.env*` files are git-ignored. Never commit a key.

## Stack

Next.js (App Router) on Vercel, the AI SDK with `@ai-sdk/anthropic`, Zod, Tailwind, Upstash Redis. Voice uses the browser’s own speech recognition and synthesis (Chrome sends the audio to its vendor’s speech service for recognition; this is not part of the Claude pipeline).

## Hackathon notes

Built on October 24, 2026 for Ambition for Korea (Bloom × Anthropic × Seoul AI Hub). All AI features use Claude only. New repository, no forked or earlier code.
