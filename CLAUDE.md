# Bodywork — Claude Guide

Autobody shop estimate and invoice app. Bun + Hono + Turso + Better Auth + Eta templates.

## Commands

```bash
bun run dev          # dev server (hot reload)
bun run migrate      # run migrations
bun run seed         # seed DB (admin@bodywork.local / password123)
bun run typecheck    # tsc --noEmit
```

## Key Patterns

**DB queries**: Use `query(sql, args?)` from `src/db/client.ts` for all parameterized queries. Use `libsql.execute(string)` only for no-arg queries. Never use `libsql.execute` with FormData args — it causes InArgs type errors.

**Auth**: Better Auth requires `baseURL` set and `BETTER_AUTH_URL` env var. Sign-in/out via JSON fetch, not form POST. Session cookie: `better-auth.session_token`. Adapter package: `@better-auth/kysely-adapter` (separate package, not `better-auth/adapters/kysely`).

**Templates**: Eta templates in `src/views/templates/`. Layout helpers in `src/views/layout-helper.ts`.

**Frontend**: Datastar v1.0.1 loaded from CDN (`https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.1/bundles/datastar.js`). Web Components in `public/components.js`.

## Git Workflow

Always: branch → commit → push → PR → merge. Never commit directly to main.
