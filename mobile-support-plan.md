# TaskNest Mobile Support Enhancement Plan

## Goal

Enhance TaskNest so authenticated teams can comfortably navigate projects, manage tasks, read analytics, and use task details on phones from **320 px upward**, without changing existing workspace data, authentication, database schemas, or the established desktop Signal Desk experience.

The implementation will preserve the current **white Private Workspace banner**, its original unmasked TaskNest wave-field asset, and the restriction that the collaboration-orbit artwork must not return to that banner.

## Scope and Design Decisions

| Area | Decision |
|---|---|
| Mobile navigation | Add a dedicated compact app bar and a left slide-out workspace menu rather than leaving the desktop sidebar hidden with no replacement. |
| Project actions | Place project selection, create-project, edit-project, and delete-project access in the mobile menu so destructive actions are available but not crowded into the top bar. |
| Board | Keep all four Kanban lanes available through touch scrolling, using near-viewport-width snap-aligned lanes instead of the current 880 px desktop grid. This preserves drag-and-drop behavior and avoids squeezing task cards. |
| Header and banner | Reduce spacing, allow project context to truncate, retain the coral primary action, and keep the white banner with the untouched wave field. |
| Views and metrics | Use compact 2-by-2 metric cards, horizontally accessible tabs, and responsive calendar/analytics spacing. |
| Task details and forms | Keep the existing full-width phone task sheet, reduce phone padding, ensure action rows wrap cleanly, and make modal controls fit narrow viewports. |
| Data and APIs | No schema, migration, procedure, or data changes. All existing tRPC behavior and existing user-created work remain untouched. |

## Implementation Steps

### 1. Establish a reusable mobile workspace navigation surface

In `client/src/pages/Home.tsx`, introduce small presentation helpers or a local reusable navigation block for the existing workspace links and project list. This avoids duplicating navigation behavior between the desktop sidebar and the new mobile menu.

Use the existing shadcn-style `Sheet` primitive with explicit accessible title/description content and a local open state. At screen widths below the desktop sidebar breakpoint, render a compact sticky mobile top bar containing the TaskNest mark, current project context, and a menu trigger. The slide-out menu will contain Overview, Calendar, Insights, project selection, the create-project action, project settings/destructive access when a project is selected, team context, and sign-out. Selecting a view or project will close the menu predictably.

The desktop sidebar will remain visually and behaviorally unchanged at its existing large-screen breakpoint.

### 2. Make primary workspace controls phone-safe

Refine the authenticated header, workspace banner, and tab/action row with mobile-first Tailwind utilities. This includes compact horizontal padding, responsive gaps, safe text truncation for long workspace and project names, and a `New task` control that remains a comfortable touch target without forcing header overflow.

Keep the Private Workspace banner white at every breakpoint. Retain exactly one banner artwork layer: the original TaskNest wave-field asset, with no color filter, opacity mask, collaboration-orbit layer, or relocation back into the authenticated main header. On narrow screens, position or constrain the artwork so it does not obscure workspace copy or create horizontal overflow.

Make the Board, Calendar, and Analytics tabs horizontally reachable without wrapping unpredictably. Keep keyboard shortcuts visually secondary or hidden where their text cannot fit; touch interaction remains fully usable without them.

### 3. Convert the board from desktop overflow to intentional touch lanes

Replace the desktop-only fixed 880 px board layout with responsive lane sizing. On phones, each lane will use most of the viewport width, with horizontal scrolling, `scroll-snap`, and practical inner padding so users can swipe between columns while retaining readable card widths. At tablet and desktop widths, restore the established four-column grid without changing task order, move behavior, keyboard navigation, or task-card interactions.

Add mobile-scoped scroll affordance styling in `client/src/index.css`, including smooth touch scrolling, lane snap alignment, and a restrained scrollbar treatment. Do not introduce custom gesture libraries or alter task persistence.

### 4. Improve dense secondary views and task-detail ergonomics

Update the metric strip so phones present compact two-column cards and tablets/desktops keep the current broader distribution. Adjust calendar row layout so task titles wrap or truncate safely while due dates remain legible. Preserve the existing analytics grid, with smaller mobile padding and type scale where necessary.

For the task detail sheet, retain its full-width phone behavior while reducing internal horizontal padding on small screens. Ensure task action controls, file rows, comment composer controls, date/status cards, and edit/delete dialogs wrap or stack without clipping. Maintain current focus management, accessible titles, and keyboard behaviors.

### 5. Validation and delivery

Run `pnpm check`, `pnpm test`, and `pnpm build` after the responsive refactor. Confirm that no application data or schema files were touched and that the existing sign-in author credit remains a single semantic line.

Per the user’s standing preference, browser-based/Manus-browser validation will **not** be performed unless explicitly requested. The final checkpoint will document code-level validation and identify browser review as user-deferred.

## Expected Files

| File | Planned change |
|---|---|
| `client/src/pages/Home.tsx` | Add the mobile app bar and slide-out navigation; apply responsive layout, board, metrics, secondary-view, task-sheet, and form utilities. |
| `client/src/index.css` | Add narrowly scoped mobile board scrolling/snap and banner-artwork containment styles while preserving the original wave asset. |
| `todo.md` | Record and track the mobile-support implementation and validation work. |

## Acceptance Criteria

The authenticated app has a clear mobile navigation entry point, and projects/views remain reachable without the hidden desktop sidebar. No horizontal page overflow occurs at 320 px, except the intentional, swipeable Kanban lane region. Task cards remain readable and actionable; the task sheet and dialogs fit narrow screens; metrics, tabs, calendar, and analytics remain legible. The desktop experience, live data, existing workspace/project/task records, and wave-banner requirements remain intact.

## Assumptions and Risks

This plan assumes the user wants a responsive **web** experience rather than a separate native mobile application. It intentionally preserves swipeable Kanban columns rather than collapsing workflow into a single-status picker, because that keeps the project’s collaborative Kanban model visible and avoids changing task semantics. Real-device/browser visual QA is deferred at the user’s instruction; final small-screen tuning may require follow-up feedback from manual device testing.
