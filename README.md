# SignalDesk

SignalDesk is a local-first personal action workspace. It solves a common 2026 problem: people accumulate obligations, ideas, follow-ups and decisions faster than they can turn them into clear next actions.

Instead of pretending to be an AI assistant, SignalDesk uses a transparent, deterministic prioritization engine. The score considers timing, impact and effort, and the UI explains why an item is being surfaced. This makes the recommendation inspectable and useful without an external AI key.

## What it does

- Minimal entry flow: name + age.
- Persists the entry to `data/users.log` through a real Node.js filesystem write.
- Captures actionable signals with category, due date, impact, effort and optional context.
- Transparent priority scoring and next-action guidance.
- Search, category filtering and sorting.
- Today view for due/overdue work.
- Saved signals.
- Completion history.
- JSON export/import with validation.
- Three distinct visual themes: Executive, Future and Human.
- Theme persistence with `localStorage`.
- Workspace persistence with `localStorage`.
- Responsive mobile/tablet/desktop layouts.
- Semantic HTML, keyboard focus, reduced-motion support and restrained ARIA use.
- Real server health endpoint.
- No database and no frontend framework.

## Install

Requirements:

- Node.js 18 or newer.

No `npm install` is required because the server uses Node's built-in modules only.

```bash
cd signaldesk
npm run check
npm start
```

Then open:

`http://127.0.0.1:3000`

## User records

The only server-side personal entry is appended to:

`data/users.log`

Each successful entry has this shape:

```text
2026-09-24T17:30:00.000Z | Name: John | Age: 24 | Session: <uuid>
```

Duplicate name + age entries are not appended again, but the current browser session is still allowed to enter the application.

Workspace signals and history stay in the browser's local storage. They are not sent to the server.

## Themes

The theme control switches between three complete design systems:

1. **Executive** — restrained editorial/luxury visual language.
2. **Future** — dark systems/terminal-inspired 2026 interface.
3. **Human** — warm, rounded, accessibility-oriented consumer interface.

The selection is saved in `localStorage` and restored on reload.

## API key

None is required.

There is intentionally no fake AI endpoint. The product's ranking engine is deterministic and transparent. If a future deployment adds a real AI provider, the correct extension point is the server side rather than exposing a provider key in browser JavaScript.

## Known limitations

- `data/users.log` is intentionally simple local filesystem storage, not a multi-user production datastore.
- There is no password authentication. The entry flow is intentionally lightweight and is not an identity/security boundary.
- Browser local storage is device/browser scoped and can be cleared by the user.
- Export files contain workspace content; treat them like personal data.
- The app does not claim to be secure against a hostile local machine or a public internet deployment.

## Security considerations

- User input is validated on both client and server.
- Server responses include `X-Content-Type-Options: nosniff`.
- The server only exposes the application directory through normalized paths and blocks traversal outside the project root.
- The user log is not exposed through an HTTP endpoint.
- The browser renders user text through escaped HTML.
- Request bodies are capped.
- No secrets or API keys are shipped in the frontend.

## Product logic

The priority score is intentionally explainable:

- Higher impact increases priority.
- Near-term due dates increase priority.
- Overdue work receives an additional urgency factor.
- Higher effort slightly reduces priority so the queue does not become dominated by large, ambiguous tasks.

The "Next" action shows the reason and a practical next move. It is a rule-based decision aid, not a fabricated AI response.

## Verification

The project includes a lightweight syntax check:

```bash
npm run check
```

The server exposes:

```text
GET /api/health
```

A fresh extraction should therefore be testable without any external service or database.
