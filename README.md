# SignalDesk

SignalDesk is a local-first personal action intelligence workspace. It turns obligations, follow-ups, ideas, and decisions into a transparent, prioritized action queue.

## Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Node.js 24 for local development
- Vercel Functions for the production API
- No database is required for the browser workspace

## Run locally

```bash
npm install
npm start
```

Open `http://127.0.0.1:3000`.

The local Node server is `dev-server.cjs`. The production deployment does not use that long-running server.

## Vercel deployment

This repository is structured for Vercel:

- `index.html`, `style.css`, and `script.js` are served as static assets.
- `api/users.js` handles `POST /api/users`.
- `api/health.js` handles `GET /api/health`.
- `vercel.json` pins the functions to Node.js 22.
- `package.json` pins the Node engine to `22.x`.

No Vercel build command is required. If a dashboard asks for one, leave it blank. The default install command is `npm install` and the API functions are discovered from `api/`.

## Data behavior

The main workspace (signals, history, theme, and the browser session) is stored in the user's browser localStorage.

For local development, the minimal Name + Age entry is appended to `data/users.log` by `dev-server.cjs`.

On Vercel, serverless functions do not provide durable application filesystem storage. The production API therefore uses `/tmp` only as a runtime-local fallback and reports `storage: "ephemeral-runtime"`. This is intentionally not described as a permanent database. If permanent server-side registration records are required in production, connect a persistent store such as a managed database or object-storage service and update `api/users.js` accordingly.

## API

### `POST /api/users`

Body:

```json
{"name":"Rockstar","age":21}
```

Returns a validated user object and the storage mode.

### `GET /api/health`

Returns a JSON health response showing whether the function is running under Vercel or the local Node server.

## SEO

The project includes semantic headings, metadata, Open Graph/Twitter metadata, SoftwareApplication/WebSite/FAQ structured data, `robots.txt`, and `sitemap.xml`.

After deployment, update `sitemap.xml` and add the canonical URL to `index.html` using the final production domain. Submit the sitemap in Google Search Console.

## Integrity

SignalDesk's priority engine is deterministic and transparent. It does not claim to be AI and does not require an AI API key.
