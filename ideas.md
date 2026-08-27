# TaskNest Design Directions

## Approach 1 — Signal Desk

**Very Brief Intro:** A precise operations workspace where soft atmospheric blue establishes focus and crisp coral marks the work needing attention. The mood is composed, senior, and decisive.

**Probability:** 0.071

## Approach 2 — Editorial Workshop

**Very Brief Intro:** A warm, typographic planning room inspired by print editorial systems and physical project boards. The interface feels collaborative and thoughtful rather than corporate.

**Probability:** 0.034

## Approach 3 — Spatial Atlas

**Very Brief Intro:** A cool, architectural interface using nested surfaces and geographic wayfinding cues to help teams locate every project and decision. It feels systematic without becoming austere.

**Probability:** 0.083

---

# Chosen Direction — Signal Desk

## Design Movement

**Contemporary operational software with Swiss-information-design discipline.** TaskNest should resemble a well-run studio: a calm field for concentration, deliberate visual lanes for workflow, and strong signals when an action truly matters.

## Core Principles

1. **Clarity over decoration:** Information is grouped by workflow consequence, not by ornamental containers.
2. **Purposeful contrast:** Sky blue creates a reassuring working surface; bright coral only signals urgency, additions, blockers, and primary action.
3. **Soft precision:** Fine cool-gray rules, restrained shadows, and compact labels establish rigor without a dense, spreadsheet-like feel.
4. **Human presence:** Avatars, concise live-activity language, and natural task ownership make collaboration visibly tangible.

## Color Philosophy

The working environment is largely **porcelain white and blue-washed gray**, so the board can be scanned for long sessions without visual fatigue. A saturated **clear-sky blue** represents orientation, progress, and navigation. **Coral** is the TaskNest signal color: it should be exceptionally sparse and instantly recognizable as a request for attention. Ink-blue typography carries authority, while cool gray holds tertiary data without disappearing.

## Layout Paradigm

The app uses an **anchored navigation rail plus horizontal work lanes** rather than a centered dashboard. The project navigation is fixed to the left; the current workflow occupies a broad central canvas; a collapsible task sheet creates an on-demand right-hand workbench. Supporting metrics sit in a slim top flight-strip, making the page read as a sequence of operational instruments rather than a grid of cards.

## Signature Elements

1. **Skyline status ribbon:** a narrow blue flight-strip at the top of the active workspace, with live project indicators and date context.
2. **Coral signal dots:** small warm accents for overdue dates, blocked work, notification counts, and decisive CTAs.
3. **Nest rings:** subtle concentric circular marks used in the logo, empty states, and hover states to suggest coordinated work gathering into one place.

## Interaction Philosophy

Interactions should feel **direct and frictionless**. Board cards lift slightly when handled; status columns accept a task with a clearly visible drop target; detail work happens in a quiet slide-over sheet rather than dislocating users onto a new page. Low-priority navigation stays subdued, while calls to action respond immediately with confident blue or coral feedback.

## Animation

Only functional motion is used. Cards translate a few pixels on hover and compress slightly on press. Kanban columns fade their drop affordance in over 160ms. The task sheet enters from the right with a 260ms custom ease-out and layered opacity, while routine filters and tabs transition in 150–180ms. All nonessential motion is disabled under reduced-motion preferences.

## Typography System

**Manrope** is the working UI face, providing compact, clear task metadata and control labels. **DM Serif Display** appears sparingly for date-led greetings and metric emphasis, giving the workspace an editorial calm without compromising function. Headings use Manrope 700/800 at a controlled scale; labels are Manrope 600 with tracking; metadata uses Manrope 500 in cool gray. No generic centered display typography.

## Brand Essence

**TaskNest is the operational home for teams that need complex work to move with visible momentum.**

Personality: **Composed, capable, warm.**

## Brand Voice

The voice is concise, observant, and action-led. Headlines should refer to the work in motion; CTAs should state exactly what happens next. Microcopy acknowledges team context without becoming chatty.

> “Shape the week before it shapes you.”

> “Create a task, then give it a clear next move.”

## Wordmark & Logo

The mark is a **coral-and-sky-blue pair of offset nest rings** that resolve into a subtle checkmark and upward momentum angle. It has no embedded lettering so it works as a favicon and compact sidebar brand device. The TaskNest wordmark pairs a strong Manrope word shape with a small coral ring as a custom brand punctuation point.

## Signature Brand Color

**Signal Coral — #FF6B5E.**

## Style Decisions

- **Signal Coral #FF6B5E** is reserved for the primary action, urgent or overdue work, and critical notification counts; it is never a decorative avatar or routine project color.
- TaskNest favors **lanes, fine rules, compact labels, and instrument-like groupings** over a collection of rounded SaaS cards.
- **Nest rings** are functional brand language: visible in the logo, focused project state, and momentum instruments, never background decoration alone.
