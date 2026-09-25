---
name: department-app-shell
description: Scaffolds the standard sidebar-nav + content-area shell for a jaipur-rugs department app (apps/<module>) — the fixed-viewport grey canvas, floating white content card with a left-weighted shadow, collapsible icon sidebar built on Gravity UI icons, and the popover-based user menu. Use this whenever a new apps/<module> frontend is being scaffolded (AGENTS.md Section 3.1 step 8 / Section 6 Build Order step 3-4), whenever asked to "set up the nav," "add a sidebar," or make an app's shell/layout "match Hub/Atlas/BOM Checker," and whenever an existing app's shell visibly diverges from this pattern (square corners, no icons, non-collapsible nav, wrong background) and needs to be brought back in line. Not for one-off page content — this only covers the outer shell (sidebar + content wrapper), not what renders inside it.
---

# Department App Shell

Every `apps/<module>` frontend in this monorepo shares one shell: a collapsible icon
sidebar on a grey canvas, and the page content in a detached white card floating next to
it. This was set by direct example, not by a written spec, across three builds in this
order:

1. `apps/DND/BOM Checker` — the original visual design (floating sidebar, white content
   card, shadow weighted toward the sidebar side, one shared grey background).
2. `apps/atlas` — the same design rebuilt on this monorepo's actual shared stack (Hero UI,
   Gravity UI icons, Tailwind v4 design tokens, a real collapse toggle instead of
   hover-to-expand) after direct feedback shaped several details (see the comments in the
   files below — they're not decorative, they record *why* a detail is what it is).
3. `apps/hub` — Atlas's version ported over for Hub's own nav links, confirming the
   pattern generalizes cleanly to a different app with different nav items.

**Read the code, don't just read this file.** The two live, working references are:

- `apps/atlas/app/(shell)/layout.tsx`, `apps/atlas/components/shell/{SidebarShell,SidebarNav,UserMenu,icons}.tsx`, `apps/atlas/lib/useLocalPreference.ts`
- `apps/hub/app/(shell)/layout.tsx`, `apps/hub/components/shell/{SidebarShell,SidebarNav,UserMenu,icons}.tsx`, `apps/hub/lib/useLocalPreference.ts`

Copy one of these (Hub is the simpler starting point — no `isAdmin`-gated links, no Clerk
special-casing) into the new app and adapt the nav links, icon choices, and app name. Don't
write this shell from scratch from prose alone — the compound-component wiring for Hero
UI's `Table`/`Popover`/`AlertDialog` and the collapse-transition CSS have enough fiddly
detail that copying a working file and editing it is far more reliable than reimplementing
it.

## Why it's built this way (the non-negotiable parts)

These are load-bearing, not aesthetic preference — direct feedback settled each one during
Atlas's build, and redoing them differently in a new app would just reintroduce the bug
that feedback fixed:

- **`fixed inset-0` on the outer wrapper, not `min-h-screen`.** `min-h-screen` still lets
  `<body>` grow taller than the viewport and scroll as a whole page, dragging the sidebar
  along with it. `fixed inset-0` pins the shell to the viewport so the sidebar and content
  card each scroll independently, and only they do.
- **One `bg-app` (grey) fills the whole fixed wrapper**, behind both the sidebar strip and
  the gap around the content card, so they read as one continuous field — not two
  differently-colored panels glued together.
- **The content card is `bg-surface` (white), detached, rounded, with a shadow weighted
  toward the edge facing the sidebar** (`shadow-[-6px_0_20px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.03)]`
  in Hub/Atlas — an arbitrary-value Tailwind shadow, not `shadow-xs`, which is symmetric
  and reads as too flat for this design). Padding lives on the card itself
  (`p-6 lg:p-7`), and only the card's own contents scroll (`overflow-y-auto`).
- **The sidebar's expand/collapse is a real click toggle with persisted state**
  (`useLocalPreference`, a small app-local `localStorage` hook — see the file above),
  **not** a CSS `:hover` trick. Atlas shipped hover-to-expand first; direct feedback
  ("add a collapse icon which expands and collapses on demand") replaced it. Don't
  regress a new app back to the hover version.
- **Icons come from `@gravity-ui/icons`, wrapped in a small local `components/shell/icons.tsx`**
  (one named export per icon, `width={20} height={20}`, a `shrink-0` base class) — never
  import icon components directly at call sites, and never mix in `lucide-react` or
  another icon set (BOM Checker's original used `lucide-react`; that's the one thing
  superseded by later builds, not a pattern to copy forward).
- **Collapsed-state labels are width/opacity-collapsed (`max-w-0 opacity-0`), not just
  `opacity-0` alone** — an invisible label that's still hoverable/tabbable at zero
  opacity is confusing. Every collapsible label in the reference files follows this.
- **The user menu is icon-only with a Hero UI `Popover` behind it, and the actual sign-out
  is behind a Hero UI `AlertDialog` confirm** — needed once the sidebar can collapse to
  icon-only width, since there's no room left for an inline name + button at that width.

## Setup checklist for a new `apps/<module>`

Work through these in order; each maps to one file in the reference apps.

1. **Add the icon dependency.** `"@gravity-ui/icons": "^2.22.0"` in the new app's
   `package.json` (match the version already pinned in `apps/atlas/package.json` and
   `apps/DND/BOM Checker/package.json` — don't drift to a different version per app).
2. **Add the two background utility classes to the app's `globals.css`**, right after its
   existing `@import`/`@source` lines:
   ```css
   .bg-app {
     background-color: var(--background);
   }
   .bg-surface {
     background-color: var(--surface);
   }
   ```
   These read `--background`/`--surface` from `@heroui/styles`, which every app already
   imports — `@heroui/styles` defines the vars but doesn't register them as Tailwind
   utilities itself, so each app currently re-declares these two classes locally. See
   "When this earns a shared package" below before assuming that's still right by the time
   you read this.
3. **Copy `lib/useLocalPreference.ts` verbatim** (it's app-local by design, not imported
   across apps) and key the new app's preference `"<app>:sidebarExpanded"`.
4. **Write `components/shell/icons.tsx`** — one wrapped export per nav link plus a
   collapse chevron and a sign-out icon. Pick names from `@gravity-ui/icons`'s catalog
   (`node_modules/@gravity-ui/icons/*.js` lists every available icon — grep there before
   guessing a name). Reuse the same icon for the same concept across apps where it makes
   sense (`Person` for a profile/user link, `Persons` for a team link, `ArrowRightFromSquare`
   for sign out, `ChevronLeft` for the collapse toggle) so the icon vocabulary stays
   consistent app-to-app, the same way naming conventions stay consistent in the DB layer.
5. **Write `components/shell/SidebarNav.tsx`** — takes `expanded`/`onToggleExpanded` as
   props (owned by `SidebarShell`, not by this component), renders the app's actual nav
   links with active-link highlighting, and fades labels in/out per the collapsed-state
   rule above.
6. **Write `components/shell/UserMenu.tsx`** — Popover trigger (icon + name, name fades
   with `expanded`) → Popover content (name + red "Sign out" button) → AlertDialog confirm
   → actual `supabase.auth.signOut()`.
7. **Write `components/shell/SidebarShell.tsx`** — the thin client-component wrapper that
   owns `expanded` via `useLocalPreference` and renders `SidebarNav` + `UserMenu` inside the
   `w-72`/`w-16` collapsing column.
8. **Update `app/(shell)/layout.tsx`** (or wherever the app's authenticated shell layout
   lives) to the `fixed inset-0` + `bg-app` wrapper, `<SidebarShell {...access} />`, and the
   `bg-surface` content `<main>` with the left-weighted shadow. Keep the existing
   access-check call (`requireXAccess`) exactly as it is — this skill only changes the JSX
   shell around it, never the authorization logic (AGENTS.md Section 5: every app
   re-verifies its own access on load; don't touch that when restyling).

After wiring it up, actually load the app in a browser and check: the sidebar collapses
and the collapsed state survives a reload (localStorage), the content card scrolls
independently of the sidebar, and the shadow reads as heavier on the sidebar-facing edge.

## When this earns a shared package (don't decide this unilaterally)

Right now `bg-app`/`bg-surface`, the `useLocalPreference` hook, and the whole
`SidebarShell`/`SidebarNav`/`UserMenu`/`icons.tsx` quartet are duplicated per app, on
purpose — AGENTS.md Section 4: *"A change to a shared package should be justified by more
than one app's need, or it belongs in that one app instead."* Two apps (Atlas, Hub) sharing
a pattern isn't yet the bar that section sets for promoting it into `packages/ui-kit` /
`packages/config`; it's the bar for noticing the pattern is real, which is why this skill
exists instead of the code moving yet.

If you're scaffolding a **third** app with this shell, that's the point to flag to the
user — "this is the third copy of the shell chrome, want me to fold the shared parts
(`SidebarShell`'s width/transition logic, `bg-app`/`bg-surface`, maybe a generic
`useLocalPreference`) into `packages/ui-kit`/`packages/config` instead of copying it
again?" — rather than silently promoting it, and rather than silently copying it a fourth
time without asking. Nav links, icon choices, and anything reading `access.isAdmin`-style
per-app authorization stay app-local regardless of how many apps exist; only the
structural chrome (widths, transitions, background tokens, the collapse mechanism) is ever
a promotion candidate.

## What this skill does not cover

- The content that renders *inside* `<main>{children}</main>` — that's ordinary page work,
  not shell setup.
- Auth/authorization logic (`requireXAccess`, RLS, redirects) — this only restyles the JSX
  wrapper around whatever access check the app already has or is being given elsewhere.
- `apps/admin/internal-portal` and any other on-premise/non-Vercel app should still follow
  this shell visually; nothing here is Vercel-specific.
