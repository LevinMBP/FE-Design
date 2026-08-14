# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server on port 5175
npm run build      # tsc -b && vite build — the real gate, run this before calling work done
npm run lint       # oxlint (react/rules-of-hooks, react/only-export-components)
npx tsc --noEmit   # fast type check without emitting
```

There is **no test runner** in this project. Verification means `npx tsc --noEmit` + `npm run build` clean, plus (for domain logic) a throwaway `npx tsx` harness against the mock modules — write it in the scratchpad, not the repo. TypeScript runs with `strict`, `noUnusedLocals`, `noUnusedParameters`, and `verbatimModuleSyntax` (type-only imports must use `import type`).

Seed logins (mock auth): `admin@venturo.app`, `manager@venturo.app`, `staff@venturo.app` — password `password123`.

## What this is

Venturo is a **frontend-only ERP** (inventory / purchases / sales / finance+payroll / accounting) built with Vite + React 19 + TypeScript, Ant Design v6, Redux Toolkit + RTK Query, React Router v7, and plain CSS. There is no server: every API is RTK Query over `fakeBaseQuery()` backed by in-memory mock modules, deliberately shaped so the mock layer can later be swapped for real HTTP without touching pages.

## Architecture

### Layers

```
src/app/        store, App routes, AntdProvider, RequireAuth/RequireAdmin
src/layout/     AppShell, Sidebar, ModuleSwitcher, Topbar, UserMenu
src/features/*  one folder per domain: pages + <domain>Api.ts + mock*.ts + types.ts
src/shared/     cross-feature components, styles (ui.css/detail.css/antd-overrides.css), softDelete.ts
```

Each feature owns an RTK Query API slice (`inventoryApi`, `salesDocsApi`, `contactsApi`, `financeApi`, `payrollApi`, `accountingApi`, `adminApi`, `authApi`, `notificationsApi`) registered in [store.ts](src/app/store.ts). Adding one means registering **both** its reducer and its middleware.

**The endpoint pattern** (see [inventoryApi.ts](src/features/inventory/inventoryApi.ts)): `queryFn` awaits a fake `delay()`, calls a plain function from a `mock*.ts` module, wraps thrown `Error`s into `{ error: message }`, records an audit event, and declares `providesTags`/`invalidatesTags`. Mutations that post to the general ledger also call `refreshLedger` in `onQueryStarted` so accounting screens refetch.

### Module navigation is data-driven

Modules live in [modules.ts](src/features/modules/modules.ts) (`ModuleId` union + accent + icon), their nav sections in [plannedSections.ts](src/features/modules/plannedSections.ts) (a section without `to` renders as a "Soon" card). [Sidebar.tsx](src/layout/Sidebar.tsx) reads those maps, so adding a page usually means: page component → route in [App.tsx](src/app/App.tsx) → a `PlannedSection` entry. Adding a whole *module* additionally needs `MODULES`, `SECTIONS`/`MODULE_SEGMENTS` in Sidebar, and an accent class in `ModuleSelection.css`.

`moduleFromPath` (exported from Sidebar) maps a URL's first segment to a module and is the enforcement hook for access control — note `payroll/*` URLs map to the `finance` module (Payroll and Contacts were dissolved as top-level modules; their old routes redirect but their *data layers* still live in `features/payroll/` and `features/contacts/`, and customer/vendor/employee page components still physically sit under `features/contacts/`).

Post-login flow: `/` is a full-screen module launcher (outside the shell) → module routes render inside `AppShell` → `/admin/*` is a separate route group with its own shell, gated by `RequireAdmin`.

## Domain invariants — do not break these

**Stock moves only through documents.** [mockMovements.ts](src/features/inventory/mockMovements.ts) is the stored movement table and the single source of stock history. An item's `quantity` stays authoritative, and every mutation path *also* appends a movement, so `on-hand == opening + Σ movements`. The only paths that change on-hand: Opening Balance document, Purchase (in), Sale (out, always via [issueStock.ts](src/features/inventory/issueStock.ts)), Manufacturing (materials out / product in), Adjustment. Item create forms are pure master data — new items start at **0**.

**FIFO costing.** `mockStockMovements.ts` replays stored movements into lots; issues draw the oldest lots and are valued at their cost. Value an issue *before* recording its movement.

**Books auto-post and must balance.** Every stock/finance transaction books a balanced journal entry through [autoPost.ts](src/features/accounting/autoPost.ts) (purchase, vendor payment, opening balance, adjustment, sale+COGS). Account balances are **derived**, never stored: `openingBalance + Σ(debit − credit)`, so every report reconciles. New transaction types get a matching `post*Entry` function rather than ad-hoc `addJournalEntry` calls.

**Documents validate all-or-nothing.** Multi-line posts check the full aggregate demand up front and throw before mutating anything — never partially apply then fail.

**Audit logging is wired at the RTK Query mutation layer**, not inside the mock functions — the mocks are also called by seeders, which would pollute the log with "System" events. `recordAuditEvent` resolves the actor from the stored session itself.

**Soft delete.** [softDelete.ts](src/shared/softDelete.ts) defines `deletedAt`/`deletedBy` and a `ListScope` ('active' | 'deleted' | 'all', defaulting to `active`). This is separate from an entity's business `status` ('active' | 'inactive'). Currently applied to contacts (customers/vendors/employees) via `ScopeFilter`/`softDeleteColumns`.

**RBAC.** `features/admin/rbac/` replaced the old flat role enum. Effective module access = system-admin ? all : (⋃ role grants ∪ position grants ∪ user allows) − user denies, computed by the pure resolvers in `mockRbac.ts`, which are shared by React selectors and non-React callers. Enforced at two read points: `ModuleSelection` filters tiles, `AppShell` redirects. Module-level only — there is no CRUD/action-level permission.

## Persistence

`localStorage` holds company profile (`venturo.company`), quotation template (`venturo.quotationTemplate`), RBAC tables (`venturo.rbac`), theme, and sidebar collapse. Sessions use localStorage or sessionStorage depending on "remember me". **Everything else — inventory, movements, ledger, users, audit events — is in-memory and resets on a full reload.**

## Conventions and gotchas

- **Never expose curried Redux selectors that build a new array per call** (e.g. `selectAllowedModules(user)`); read a stable slice selector and `useMemo` the pure resolver. Doing otherwise caused a blank-screen render loop.
- AntD is themed centrally in [AntdProvider.tsx](src/app/AntdProvider.tsx) (brand `#4f46e5`, light/dark algorithm bound to the app theme); component chrome is finished in `shared/styles/antd-overrides.css`. Use `App.useApp()` for message/notification — never the static API (React 19).
- On this AntD version, `Modal` styling uses `styles.body`, not `styles.content`.
- Branded chrome (Login, SplashLoader, ModuleSelection, Topbar, UserMenu, detail pages) is custom plain CSS using `.page-head` / `.form-card` / `.module-view` from `shared/styles/ui.css` — data screens use AntD Table/Form.
- Currency is inconsistent by design-drift: accounting/payroll/documents format pesos via `formatPeso` (duplicated in both `accounting/types.ts` and `payroll/types.ts`), while inventory screens still print `$`.
- Icons are lucide-react throughout.
- Quotation rendering: [QuotationDocument.tsx](src/features/sales/quotations/QuotationDocument.tsx) is a pixel A4 page shared by the saved detail view, the live form preview, and print, so preview matches the planned server-side (QuestPDF) export. It is driven by the admin-configurable `QuotationTemplate`.

## Known gaps

Per-location stock is not real — movements stamp a location but FIFO ignores it and several paths hardcode `MAIN WAREHOUSE`. Master data is largely create-only (no edit/delete outside contacts). No void/reversal of posted documents, no AR receipt posting (invoice "mark paid" only flips a flag), no AP aging.
