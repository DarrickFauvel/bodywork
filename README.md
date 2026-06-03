# Bodywork

Autobody shop estimate and invoice tool. Mockup for demo purposes.

## Stack

- **Runtime**: Bun
- **Framework**: Hono
- **Database**: Turso (libsql) via Kysely
- **Auth**: Better Auth
- **Templates**: Eta
- **Frontend**: Datastar v1.0.1 (CDN), HTML Web Components, Container Queries CSS

## Setup

```bash
bun install
cp .env.example .env   # fill in TURSO_URL, TURSO_AUTH_TOKEN, BETTER_AUTH_SECRET, BETTER_AUTH_URL
bun run migrate
bun run seed
bun run dev
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server with hot reload |
| `bun run start` | Start production server |
| `bun run migrate` | Run database migrations |
| `bun run seed` | Seed the database |
| `bun run typecheck` | Run TypeScript type checking |

## Seed Credentials

- **Admin**: `admin@bodywork.local` / `password123`

## Project Structure

```
src/
  index.ts          # entry point (Bun.serve)
  app.ts            # Hono app + route registration
  auth/             # Better Auth config
  db/               # Kysely client, migrations, seed
  routes/           # Route handlers
  views/            # Eta templates + layout helpers
  lib/              # Shared utilities
public/
  components.js     # HTML Web Components
```
