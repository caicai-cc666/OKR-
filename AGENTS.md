# AGENTS.md — OKR Harness

**Start here**: Read `HANDOFF.md` for full project context, known bugs, and architectural decisions.

## Repo Layout

```
src/
├── app/                          # Next.js App Router
│   ├── api/ai/                   # Server-side AI endpoints
│   │   ├── adapter.ts            # Shared model adapter (callModel, testModelConnection)
│   │   ├── run/route.ts          # POST /api/ai/run — execute agent
│   │   └── test/route.ts         # POST /api/ai/test — test connection
│   ├── cases/                    # Case pages (list, detail, new)
│   ├── config/                   # Config page
│   └── review/                   # Review page
├── components/
│   ├── case-detail/              # 9 tab components + client shell
│   ├── config/                   # Config tab components
│   ├── layout/                   # App shell, sidebar, top bar
│   ├── shared/                   # StatusBadge, CaseActionButton
│   └── ui/                       # shadcn/ui primitives
├── data/
│   ├── mock-cases.ts             # Sample cases
│   └── mock-config.ts            # Default AppConfig
├── lib/
│   ├── ai/
│   │   ├── agents.ts             # 3 agent functions + mock generators
│   │   ├── provider.ts           # Client-side AI call layer (mock/live)
│   │   └── index.ts              # Re-exports
│   ├── state-machine.ts          # Status transition logic
│   ├── store.ts                  # Zustand store — ALL state & actions
│   └── utils.ts
└── types/
    └── index.ts                  # Core type definitions (CaseStatus, AppConfig, etc.)
```

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npx tsc --noEmit     # TypeScript check
```

No test framework configured. No test commands.

## Code Style & Conventions

- **Language**: TypeScript strict mode (`tsconfig.json` has `strict: true`)
- **Framework**: Next.js 16 App Router + React 19
- **State**: Zustand with `persist` middleware (localStorage)
- **UI**: shadcn/ui components + Tailwind CSS v4
- **Path alias**: `@/*` → `./src/*`
- **Client components**: Must have `"use client"` directive
- **Naming**: PascalCase components, camelCase functions/variables

## Critical Rules — Do Not Break These

### Zustand Selectors

Always use `s.cases.find((c) => c.id === id)` in selectors. Never use `s.getCase(id)` — it calls `get()` internally and breaks reactivity, causing UI to not update after async writes.

### Async Pipeline in Store

Inside async functions in `store.ts`, never capture case data from the outer `set` callback. Always re-read latest state with `get().getCase(caseId)` to avoid stale closures after `supplementInfo` writes.

### Unique IDs

Never use `Date.now()` alone for multiple IDs — same-millisecond calls produce duplicates. Use `nextMockId(prefix)` (agents.ts) or crypto.randomUUID() instead.

### Controlled Tabs

`case-detail-client.tsx` uses controlled Tabs (`value` + `onValueChange`). Do not switch to uncontrolled — async data loading causes tab misalignment.

### Mock Fallback

Never remove mock fallback in `provider.ts`/`agents.ts`. Many developers run without API keys; mock is the only usable mode without configuration.

## Do-Not-Touch Files

| File | Reason |
|------|--------|
| `src/lib/ai/adapter.ts` | URL normalization and provider alias matching is fragile, already debugged |
| `src/types/index.ts` | Changing CaseStatus enum values breaks state machine + persisted data |
| `src/lib/state-machine.ts` | Must stay in sync with CaseStatus enum |

## Post-Change Verification

After any code change, run these in order:

```bash
npx tsc --noEmit     # Must pass with 0 errors
npm run lint          # Must pass with 0 errors (warnings OK)
npm run build         # Must succeed
```

For changes to `store.ts` or agent pipeline: manually test the full flow — create case → input → structure → decompose → review — and verify data appears in all tabs (Fact Pack, Drafts, Review, Final).

For changes to `adapter.ts` or `provider.ts`: test with a real API key in live mode AND verify mock mode still works.
