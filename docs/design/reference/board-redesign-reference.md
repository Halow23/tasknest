# Board Redesign — Visual Reference

**Source:** [BoardUI — Project Board Template](https://www.boardui.com/templates/project-board)
**Captured:** 2026-10-04, from the live rendered page (Chrome, 1280×720)
**Screenshots:** `boardui-project-board.light.png`, `boardui-project-board.dark.png`,
`boardui-new-ticket-dialog.png`, `boardui-new-ticket-status-open.png`,
`boardui-new-ticket-urgency-open.png`, `boardui-new-ticket-assignee-open.png`,
`boardui-new-ticket-project-open.png`, `boardui-new-ticket-from-column.png`,
`boardui-ticket-detail.png`, `boardui-ticket-actions.png`,
`boardui-display-options.png`, `boardui-filter-popover.png`,
`boardui-notifications.png`, `boardui-after-create.png` (all in this folder)
**Status:** reference only — see [Provenance & constraints](#provenance--constraints)

---

## 1. Why this reads better than our current board

The reference is a *calm, neutral, typographic* board. Ours is a *tinted, decorated* board. The gap is mostly restraint, not features.

| | Reference | TaskNest today | Effect |
|---|---|---|---|
| Column surface | neutral `#f7f7f7`, radius 20px | blue-tinted `#F2F7FA`, radius 12px | Reference lets the white cards do the talking; ours tints everything |
| Card emphasis | 1px hairline shadow, no accent bar | 3px left accent border + hover lift | Reference is quieter; ours competes with the priority/label colors |
| Title | 14px/20px **w500** | 13px/20px **w800** | Reference hierarchy comes from position + color, not weight |
| Card order | meta → chips → **title** → date | badges → **title** → labels → meta row | Reference leads with identity/context, ours leads with chrome |
| Chrome | none on card (no "Task" badge, no "Open context →") | "Task" badge, `⋯`, "Open context →" | Reference removes ~3 elements per card |
| Type scale | Inter throughout, 5 fixed steps | Manrope + DM Serif Display, many one-off sizes | Reference scale is systematic and reusable |
| Sidebar | inset floating panel (24px radius, 12px window margin) | flush panel | Reference feels like an app, not a page |

**One-line thesis:** drop the tint and the decorations, adopt a 5-step type scale, and let a neutral column + white card + one accent color carry the whole board.

> **Readability is a separate, measurable defect — see §4.** Our muted text sits at **2.4:1–3.9:1**
> against the reference's 4.7:1, and our CTAs fail AA outright. That is why light mode reads as
> "too bright to read", and it is fixable independently of the redesign.

---

## 2. Design tokens

All values below were read from the live computed styles, not eyeballed. `lab()` values converted to sRGB hex.

### 2.1 Color — light

```
/* Neutrals — the backbone */
--tn-bg-page:        #ffffff   /* main surface */
--tn-bg-secondary:   #f7f7f7   /* sidebar, board column */
--tn-bg-tertiary:    #ebebeb   /* pressed, badge neutral, track */
--tn-border:         #ebebeb   /* hairline borders, separators */
--tn-border-strong:  #d4d4d4   /* neutral-300 */

--tn-text-primary:   #0a0a0a
--tn-text-secondary: #737373
--tn-text-tertiary:  #a1a1a1

/* Accent — the only saturated color in the shell */
--tn-accent:         #2b7fff
--tn-accent-hover:   #3392ff
--tn-accent-active:  #155dfc
--tn-accent-soft:    #dbeafe   /* accent-100 */
--tn-accent-softer:  #eff6ff   /* accent-50 */
--tn-accent-strong:  #193cb8   /* text on soft accent */

/* Priority / status pairs — soft background + strong text */
--tn-status-blue-bg:   #bedbff   --tn-status-blue-text:   #193cb8   /* Low */
--tn-status-yellow-bg: #fff085   --tn-status-yellow-text: #894b00   /* Medium */
--tn-status-orange-bg: #ffd6a7   --tn-status-orange-text: #9f2d00   /* High */
--tn-status-rose-bg:   #ffccd3   --tn-status-rose-text:   #a50036   /* Urgent */
--tn-status-lime-bg:   #d8f999   --tn-status-lime-text:   #3d6300   /* done */
--tn-status-cyan-bg:   #a2f4fd   --tn-status-cyan-text:   #005f78
--tn-status-purple-bg: #f3e8ff   --tn-status-purple-text: #9810fa
```

Note the pattern: **pill = soft tinted fill + deep saturated text, no border, no ring.** Our current pills use `ring-1 ring-inset`; the reference drops it entirely.

### 2.2 Color — dark

```
--tn-bg-page:        #121212   /* neutral-925 — main */
--tn-bg-secondary:   #171717   /* neutral-900 — sidebar, column */
--tn-bg-card:        rgba(38,38,38,0.6)   /* neutral-800 @ 60% */
--tn-border:         #262626   /* neutral-800 */
--tn-border-strong:  #404040   /* neutral-700 */

--tn-text-primary:   #fafafa
--tn-text-secondary: #737373
--tn-text-tertiary:  #525252
```

The accent hue is **unchanged** in dark mode; only surfaces and text invert. Status pills keep their hue but swap to a translucent deep fill:

```
--tn-status-yellow-bg: color-mix(in srgb, #231f0a 60%, transparent);
--tn-status-yellow-text: #f0b100;   /* the 400/500 ramp step, not the 800 */
```

**Migration note:** our `index.css` currently has a ~230-line `.dark [class*="bg-[#…]"]` remap layer (lines 87–316) precisely because the board hard-codes hex. Adopting semantic tokens for the board removes the need for that layer on these components.

### 2.3 Typography

Single family: **Inter**. Five steps cover the entire board — no one-off sizes.

| Token | Size / line-height | Weight | Used for |
|---|---|---|---|
| `title-2-medium` | 20px / 26px | 500 | Page title (`h1`) |
| `body-medium` | 14px / 20px | 500 | Column title, card title, button label |
| `body-2-medium` | 13px / 18px | 500 | Card meta, priority pill, tag chip, date |
| `caption-1-medium` | 12px / 16px | 500, +0.15px | Breadcrumb, sidebar counts |
| `caption-2-medium` | 11px / 15px | 500, +0.2px | Smallest labels |

Card title is **500 weight at 14px** — not bold. Emphasis comes from `--tn-text-primary` against the `#737373` meta around it.

### 2.4 Radius, shadow, spacing

```
/* Radius */
--tn-radius-column:  20px    /* board column */
--tn-radius-sidebar: 24px    /* app shell panel */
--tn-radius-card:    12px    /* task card */
--tn-radius-control: 10px    /* button, nav item, input */
--tn-radius-chip:     6px    /* priority pill, tag chip */

/* Shadow */
--tn-shadow-card:     0 1px 1px 0 #0000000d;
--tn-shadow-dropdown: 0 1px 1px 0 #0000000a, 0 4px 4px 0 #00000005;
--tn-shadow-sidebar:  0 1px 0 0 #00000005, 0 1px 12px 0 #0000000f, 0 0 1px 0 #00000052;

/* Layout */
--tn-sidebar-w:       260px
--tn-shell-inset:     12px    /* sidebar floats 12px from window edge */
--tn-column-w:        273px
--tn-column-gap:       8px
--tn-card-pad:        12px
--tn-card-gap:         8px
```

The card shadow is deliberately near-invisible (`0 1px 1px` at 5% alpha). Separation comes from the white card sitting on the `#f7f7f7` column.

---

## 3. Design system scales

The reference ships a complete token system, not just colors. These are the scales worth adopting
wholesale — they are what make the board feel systematic rather than hand-styled.

### 3.1 Type scale

Every step is defined at **four weights** (regular 400 / medium 500 / semibold 600 / bold 700),
so any size can be any weight without inventing a one-off. Size / line-height:

| Step | Size | Line-height | Our use |
|---|---|---|---|
| `display-1` | 3.5rem | 4.5rem | — (marketing only) |
| `display-2` | 3rem | 4rem | — |
| `display-3` | 2.5rem | 3.375rem | — |
| `display-4` | 2rem | 2.75rem | — |
| `title-1` | 1.5rem | 2.125rem | — |
| `title-2` | 1.25rem | 1.625rem | page title (`h1`) |
| `title-3` | 1.125rem | 1.625rem | — |
| `headline` | 1rem | 1.375rem | — |
| `body` | .875rem | 1.25rem | column title, card title, buttons |
| `body-2` | .8125rem | 1.125rem | card meta, pills, chips, dates |
| `caption-1` | .75rem | 1rem | breadcrumb, sidebar counts (ls +.15px) |
| `caption-2` | .6875rem | .9375rem | smallest labels (ls +.2px) |

**Our current board uses ~14 distinct font sizes** (`text-[9px]` through `text-4xl`), most as
one-off arbitrary values. Collapsing to this 5-step working range (`title-2` → `caption-2`) is
most of the "it looks more designed" effect.

### 3.2 Spacing

A single 4px base: `--spacing: .25rem`. Everything is a multiple — `gap-2` (8px) between cards,
`p-3` (12px) inside cards, `px-3` (12px) for the column header, `gap-1.5` (6px) between chips.
No arbitrary pixel values anywhere in the board.

### 3.3 Radius scale

| Token | Value | Used for |
|---|---|---|
| `radius-xs` | 2px | — |
| `radius-sm` | 4px | — |
| `radius-md` | 6px | priority pill, tag chip |
| `radius-lg` | 8px | — |
| `radius-2lg` | 10px | button, nav item, dropdown option |
| `radius-xl` | 12px | task card |
| `radius-2xl` | 16px | — |
| `radius-2-5xl` | 20px | board column |
| `radius-3xl` | 24px | sidebar panel, dialogs, ticket sheet |

Nine steps, each with one clear job. Ours mixes `rounded-md/xl/2xl/3xl` plus arbitrary
`rounded-[28px]`, which is why surfaces don't feel related.

### 3.4 Shadow scale

Deliberately restrained — separation comes from surface color, not from shadow.

```
--shadow-card:     0 1px 1px 0 #0000000d        /* task card — nearly invisible */
--shadow-xs:       0 1px 2px 0 #0000000d
--shadow-dropdown: 0 1px 1px 0 #0000000a, 0 4px 4px 0 #00000005
--shadow-sm:       0 1px 2px 0 #0000000f, 0 1px 3px 0 #0000001a
--shadow-sidebar:  0 1px 0 0 #00000005, 0 1px 12px 0 #0000000f, 0 0 1px 0 #00000052
```

Note the alphas: `#0000000d` is **5%**. Our cards use
`shadow-[0_2px_8px_rgba(21,54,74,0.025)]` plus a hover
`shadow-[0_10px_22px_rgba(21,54,74,0.08)]` — a 10px/22px hover bloom that reads as "floating"
where the reference reads as "resting".

### 3.5 Gradients

Primary and danger buttons use a **vertical gradient**, not a flat fill:

```
--gradient-button-primary-default: linear-gradient(180deg, #2b7fff 0%, #155dfc 100%)
--gradient-button-primary-hover:   linear-gradient(180deg, #3392ff 0%, #2b7fff 100%)
--gradient-button-primary-active:  linear-gradient(180deg, #155dfc 0%, #1447e6 100%)
--gradient-button-primary-disabled: linear-gradient(180deg, #ebebeb 0%, #d4d4d4 100%)
```

Plus `inset 0 1px 0 rgba(255,255,255,0.25)` as a top highlight. This is a small detail that
makes buttons look physical rather than flat.

### 3.6 Motion

```
--default-transition-duration: .15s
--default-transition-timing-function: cubic-bezier(.4, 0, .2, 1)
```

One duration, one easing, everywhere. Cards additionally use `duration-200 ease-out` for
hover, and every transition is paired with `motion-reduce:transition-none`.

### 3.7 Breakpoints

`sm 24rem · md 28rem · lg 32rem · xl 36rem · 2xl 42rem · 3xl 48rem · 4xl 56rem · 5xl 64rem · 6xl 72rem`

The board's own responsive rule is `min-[1441px]` — below that, fixed 273px columns scroll
horizontally; above it, columns stretch to fill.

---

## 4. Light-mode readability audit

> **This is the section that matters most for us.** The complaint that our light mode is
> "so bright I can't read it" is measurable, and the cause is not the background — it is that
> our muted text greys are far too light.

### 4.1 Measured contrast — our board vs the reference

WCAG AA needs **4.5:1** for normal text and **3:1** for large text (≥18.66px bold / ≥24px) and
UI component boundaries. Ratios below computed from the actual hex values in our code.

**Our muted text (the main problem):**

| Where | Our value | Contrast | Verdict |
|---|---|---|---|
| Column note | `#8B9EAA` on `#F2F7FA` | **2.57:1** | ❌ fails even large-text |
| `#9BAAB3` on white | `#9BAAB3` | **2.39:1** | ❌ fails |
| `#8A9BA6` on white | `#8A9BA6` | **2.87:1** | ❌ fails |
| `#90A1AB` on white | `#90A1AB` | **2.67:1** | ❌ fails |
| `#91A3AE` on white | `#91A3AE` | **2.61:1** | ❌ fails |
| `#8498A5` on white | `#8498A5` | **2.99:1** | ❌ fails |
| Card meta `#718491` on white | `#718491` | **3.88:1** | ⚠️ large text only |
| Card meta `#7B8F9C` on white | `#7B8F9C` | **3.36:1** | ⚠️ large text only |

Our card meta row is `text-[10px] font-semibold` — **10px is not large text**, so at 3.88:1 it
fails AA outright. Same for the 10px column notes at 2.57:1, which are barely visible.

**Our accents and CTAs:**

| Where | Value | Contrast | Verdict |
|---|---|---|---|
| Accent text `#38A9F2` on white | — | **2.58:1** | ❌ fails |
| White on coral button `#FF6B5E` | — | **2.79:1** | ❌ fails |
| White on accent `#38A9F2` | — | **2.58:1** | ❌ fails |
| Coral text `#FF6B5E` on white | — | **2.79:1** | ❌ fails |
| `#4B92BB` on white | — | **3.43:1** | ⚠️ large text only |
| `#E95A4F` on white | — | **3.48:1** | ⚠️ large text only |
| `#2778A9` on white | — | **4.83:1** | ✅ passes |

**Our priority pills:** high `#D44A3F` on `#FFF0EE` = **3.91:1** ⚠️, medium `#A36A00` on
`#FFF8E6` = **4.29:1** ⚠️ — both used at 10px, so both fail.

**The reference, same measurements:**

| Token | Contrast | Verdict |
|---|---|---|
| `text-primary #0a0a0a` on white | **19.80:1** | ✅ AAA |
| `text-secondary #737373` on white | **4.74:1** | ✅ AA |
| Accent text `#155dfc` on white | **5.25:1** | ✅ AA |
| White on accent-600 `#155dfc` | **5.25:1** | ✅ AA |
| Low pill `#193cb8` on `#bedbff` | **6.20:1** | ✅ AA |
| Medium pill `#894b00` on `#fff085` | **5.88:1** | ✅ AA |
| High pill `#9f2d00` on `#ffd6a7` | **5.41:1** | ✅ AA |
| Urgent pill `#a50036` on `#ffccd3` | **5.59:1** | ✅ AA |
| `text-tertiary #a1a1a1` on white | **2.58:1** | ❌ fails — **do not copy this one** |

**The difference is structural, not cosmetic.** The reference separates text into *two* usable
levels (primary 19.8:1, secondary 4.7:1) and reserves the too-light tertiary for decorative use
only. We have **six or seven near-identical greys between 2.4:1 and 3.9:1** — all of them
technically "muted", none of them readable. That is exactly why the light mode feels like
staring into fog: the hierarchy has no floor under it.

### 4.2 Concrete fixes

Smallest change that gets each element to AA on its actual background:

**Collapse the greys.** Replace the whole `#718491`–`#9BAAB3` family with two values:

```
--tn-text-secondary: #5f7482   /* 4.6:1 on white, 4.5:1 on #F2F7FA — replaces ALL card meta,
                                  column notes, timestamps, "Unassigned", counts */
--tn-text-tertiary:  #7a8b95   /* decorative only — icons, dividers, disabled. Never body text. */
```

**If you prefer to keep the existing hues**, these are the per-value minimums:

| Current | Min value for 4.5:1 on white | On lane `#F2F7FA` |
|---|---|---|
| `#8B9EAA` | `#6a7882` | `#65737c` |
| `#9BAAB3` | `#6e787f` | `#687379` |
| `#8A9BA6` | `#6b7881` | `#67737c` |
| `#90A1AB` | `#6c7880` | `#67737a` |
| `#91A3AE` | `#6b7880` | `#67737b` |
| `#8498A5` | `#697983` | `#64737d` |
| `#7F94A1` | `#687984` | `#63737e` |
| `#78909F` | `#657986` | `#617480` |
| `#7B8F9C` | `#687984` | `#63737e` |
| `#718491` | `#687985` | `#63737f` |

**Accents and CTAs:**

| Element | Current | Fix | Result |
|---|---|---|---|
| Accent text on white | `#38A9F2` (2.58:1) | `#297cb2` | 4.55:1 ✅ |
| Coral button fill (white text) | `#FF6B5E` (2.79:1) | `#c45248` | 4.52:1 ✅ |
| Coral hover | `#E95A4F` | `#c94e44` | 4.51:1 ✅ |
| Accent button fill (white text) | `#38A9F2` | `#297cb2` | 4.55:1 ✅ |
| `#248FCC` (white text) | 3.57:1 | `#207db3` | 4.52:1 ✅ |

⚠️ **Note on the brand coral:** darkening `#FF6B5E` → `#c45248` visibly changes the brand color.
The alternative is to **keep the coral for fills and stop using white text on it** — use
`#172B4D` ink on coral instead, which passes at 5.4:1 and keeps the hue. Decide this with
whoever owns the brand.

**Priority pills:** high `#D44A3F` → `#c3443a` (4.50:1); medium `#A36A00` → `#9e6700` (4.51:1);
low `#597080` already passes at 4.71:1. Or adopt the reference's pill pairs outright — all four
are 5.4:1–6.2:1 and already matched to a tint scale.

### 4.3 Why the reference doesn't feel bright

Three structural reasons, all worth copying:

1. **The page is not tinted.** Reference main surface is pure `#ffffff` with `#f7f7f7` columns.
   Ours tints the lane `#F2F7FA` and the page `#F7FAFB` — a blue cast over the entire screen
   that reduces contrast against every text color sitting on it.
2. **Text is genuinely dark.** Primary is `#0a0a0a` (19.8:1). Ours is `#172B4D` (14.1:1) — fine,
   but we then pair it with 2.4:1 greys, so the *range* is enormous and the eye reads the
   light greys as washed out.
3. **Fewer, stronger levels.** Two text levels instead of six. Fewer steps means each one is
   clearly either "readable" or "decorative" — there is no ambiguous middle.

### 4.4 Verification

Any change here should be checked, not eyeballed. Quickest path: run the values through a
contrast checker in CI or a one-off script. The ratios in §4.1 came from a script that computes
WCAG relative luminance from the hex values — worth keeping as a test fixture so the palette
can't silently drift back below AA.

---

## 5. Component specs

### 5.1 Board columns

```
grid-flow-col, auto-cols 273px, gap 8px, padding 0 28px 0 24px
overflow-x: auto, overflow-y: hidden, scrollbar-width: thin
≥1441px: auto-cols minmax(273px, 1fr); width max(100%, 1449px)
```

Column: `height 100%`, `radius 20px`, `bg #f7f7f7`, `padding-top 12px`, `overflow hidden`, and a `2px` inset ring that is transparent by default (turns accent when it's a drag target).

**Header row:** height 20px, `padding 0 12px`, flex space-between.

- Left: column title `14px/20px w500 #0a0a0a`, then a count `14px/20px w500 #737373`.
  **The count is `count / WIP limit`, not "in progress / total"** — verified by moving a card:
  `Backlog 3/8 → 2/8` while `Done 4/6 → 5/6`. The numerator is the live card count; the
  denominator is a per-column limit (Backlog 8, To do 5, In progress 4, Review 3, Done 6).
  It is rendered as `<span>3</span><!-- -->/<!-- --><span>8</span>` with no title/aria label,
  so the limit is not announced to assistive tech — worth fixing if we adopt the pattern.
- Right: two 20px ghost icon buttons — `⋯` (column options) and `+` (add ticket).

**Cards:** inset 6px from column edge (`px-1.5`), 8px vertical gap.

### 5.2 Task card

Order matters — this is the biggest structural difference from ours.

```
┌─────────────────────────────────────────────┐  radius 12px, padding 12px
│ DS-38 › Agent handoff            (avatars)  │  13px/18px w500 #737373 · 22px stack
│                                             │
│ [Low] [▢ vibl]                              │  pills, gap 6px
│                                             │
│ Explore approval cards for                  │  14px/20px w500 #0a0a0a
│ agent handoffs                              │
│                                             │
│ Since 14 Sep                                │  13px/18px w500 #737373
└─────────────────────────────────────────────┘
  bg #fff · shadow 0 1px 1px #0000000d · row-gap 8px
```

- **Row 1 — identity:** ticket ID, a `›` separator, project name, and the assignee avatar stack (22px circles, `12px/16px w600` initials, overlapping).
- **Row 2 — chips:** priority pill + tag chips, `gap 6px`.
- **Row 3 — title:** `14px/20px w500`, primary text, up to 2 lines.
- **Row 4 — date:** relative-ish label (`Since 14 Sep`), `13px/18px w500`, secondary text.

No "Task" badge. No per-card `⋯`. No "Open context →" affordance — the whole card is the affordance.

### 5.3 Priority pill

`inline-flex`, `padding 2px 6px`, `radius 6px`, `13px/18px w500`, **no border**.

| Label | Background | Text |
|---|---|---|
| Low | `#bedbff` | `#193cb8` |
| Medium | `#fff085` | `#894b00` |
| High | `#ffd6a7` | `#9f2d00` |
| Urgent | `#ffccd3` | `#a50036` |

### 5.4 Tag chip

`inline-flex`, `gap 4px`, `padding 2px 6px`, `radius 6px`, `13px/18px w500`, `bg #fff`, and a **1px inset ring** `#ebebeb` (`box-shadow: inset 0 0 0 1px`). Each chip carries a small 12px outline icon (a checkbox-like square) before its label.

### 5.5 Buttons

**Primary ("New ticket"):** `height 36px`, `radius 10px`, `padding 8px`, `gap 2px` between icon and label, `14px/20px w500`, white text, `shadow 0 1px 2px rgba(0,0,0,0.05)`, background is a **vertical gradient** `accent-500 → accent-600` (`#2b7fff → #155dfc`); hover lightens to `#3392ff → #2b7fff`, active darkens.

**Icon buttons (toolbar):** `36px` square, `radius 10px`, white bg, 1px `#ebebeb` border. Notification button carries a small accent badge (`5`).

### 5.6 Sidebar / app shell

The sidebar is a **floating panel**, not a flush rail:

```
inset 12px from the window edge · 260px wide · radius 24px
bg #f7f7f7 · border 1px #fff · shadow-sidebar
padding 12px
```

- **Account row** at top, then a **Quick Search** pill (`⌘L` hint on the right).
- **Nav items:** `height 36px`, `radius 10px`, `padding 8px`, `4px` gap between items, `14px/20px w500`, icon + label + right-aligned count.
- **Active item:** vertical gradient `accent-500 → accent-600`, white text, plus an inset ring in the accent and a `inset 0 1px 0 rgba(255,255,255,0.25)` top highlight. Hover on inactive: `bg #f7f7f7`.
- **Footer:** theme toggle (a pill group with a sliding white indicator), Support, Settings, then the account/workspace row.

### 5.7 Page header

```
[avatar] Board team  ›  [avatar] Mertcan  ›  ▤ Project board     ← 12px/16px w500 #a1a1a1
BoardUI Design Tasks                                             ← 20px/26px w500 #0a0a0a
                                    [🔔5] [📥] [⇅] [⛃] [⛶]  [+ New ticket]
```

Breadcrumb is `12px/16px w500` tertiary with small avatar/icon leads. Title is `20px/26px w500` — **not** a serif display face. Toolbar sits on the same line as the title, right-aligned.

---

## 6. Interaction behaviour (exercised live)

Everything in this section was driven in the real page, not inferred from markup.

### 6.1 New ticket — a composer, not a form

`New ticket` opens a **560×230 dialog**, radius 24px, padding 16px, anchored low-center
(`rect 360,450` in a 1280×720 viewport). It is a *quick-capture composer*:

```
BoardUI Design Tasks › FE-90 › New ticket              (×)
┌──────────────────────────────────────────────────┐
│ Enter ticket title                               │  textarea, 16px/22px w500
│ Description area                                 │  textarea, 14px/20px w500, secondary
│                                                  │
│ + Status   ◷ Urgency   ☺ Assignee   ▢ Project    │  four collapsed pickers
│ ⬭ Keep creating          [ Cancel ]  [ Create ]  │
└──────────────────────────────────────────────────┘
```

- Title is a **textarea** (multi-line capable), `16px/22px w500`, no visible border or fill — it
  reads as a heading, not a field.
- Description is a second textarea, `14px/20px w500` in secondary color.
- The four property pickers are **collapsed text buttons** (`14px/20px w500`, secondary) that
  only expand into popovers when clicked. No labels, no boxes — this is why the dialog stays short.
- `Keep creating` is a **switch**; when on, the dialog stays open and resets for the next ticket.
- Footer: `Cancel` (white, 1px `#ebebeb` border, radius 10px) and `Create ticket`
  (accent gradient, radius 10px, `14px/20px w500`).

**Submit behaviour — verified by actually creating a ticket:**

1. **Empty submit is silently blocked.** Clicking `Create ticket` with no title does nothing —
   the dialog stays open with no error message, no red border, no shake. This is the weakest
   part of the flow and **not** worth copying; we should show inline validation.
2. **On success the dialog stays open** and resets, with the header ID advancing `FE-90 → FE-91`.
   The new card appears in the column matching the selected Status (default `To do`), and that
   column's numerator increments (`3/5 → 4/5`).
3. The new card renders with defaults: `Low` priority, the current project, no assignee, and a
   relative date label **`Since just now`** — the date string is dynamic, not a fixed format.

### 6.2 The four property pickers

All four are `react-aria` listboxes (`role="listbox"` / `role="option"`), each rendering a
richer option than the collapsed label suggests:

| Picker | Options | Option rendering |
|---|---|---|
| **Status** | Backlog, To do, In progress, Review, Done | 18px outline icon + label; max-height 240px, scrollable |
| **Urgency** | Low, Medium, High, Urgent | the **priority pill itself** rendered as the option |
| **Assignee** | Unassigned, Maya Chen, Noah Williams, Elif Kaya, Daniel Kim, Priya Shah | 24px avatar + name; `Unassigned` gets a circle-slash icon |
| **Project** | vibl, firstview, BoardUI | 18px outline icon + label |

Options use `rounded-[10px]`, `padding 8px`, `gap 8px`, `14px/20px w500`, hover `#f7f7f7`.
**The Urgency picker reusing the card's pill component is the notable trick** — the same visual
vocabulary appears in the picker and on the card, so selection needs no legend.

### 6.3 Column `+` and `⋯`

- **`+` (Add ticket to *column*)** opens the *same* create dialog, but with **Status pre-filled**
  and shown with its icon (`▤ Backlog`). So there is one create surface, context-seeded by entry
  point — not a separate inline composer. Worth copying directly.
- **`⋯` (More options for *column*)** is **inert in the demo** — it renders, is focusable, and
  has an accessible name, but produces no menu.

### 6.4 Ticket detail — a right sheet, not a modal

Clicking a card opens a **right-anchored sheet**: 609px wide, 696px tall, radius 24px, inset 12px
from the window edge. It is `role="dialog"` with the accessible name `"DS-38 ticket details"`.
No URL change, no new tab.

Content order:

```
Breadcrumb: BoardUI Design Tasks › DS-38 › Agent handoff     ☆ 🔗 ⋯  (×)
Created by  [avatar] Maya Chen
Explore approval cards for agent handoffs                     ← h2, 16px/22px w500
Design the approve, request changes, and declined states…      ← description paragraph

Properties   ▢ Backlog   [Low]   [avatar] Maya Chen +1   ▢ vibl
Resources    [figma.com]

┌ Tokens burned ──────────────────────────────┐
│ 111.9M tokens   +4.9%                        │   ← sparkline, accent stroke
└──────────────────────────────────────────────┘
[avatar] Noah Williams  2 hours ago
I've added this to our next review. …
[avatar] Elif Kaya  5 hours ago
The initial direction is a compact summary…
```

- **Properties is a read-only-looking row of inline chips** — status, priority, assignee, project.
  Clicking a chip opens the same listbox used in the composer.
- **Resources** is a separate row of link chips (`figma.com`) using accent-soft fill `#dbeafe`
  with accent text `#155dfc`.
- The **metric card** ("Tokens burned", 111.9M, `+4.9%`) with a sparkline is product-specific to
  BoardUI's AI-agent framing. We have no analogue; skip it, but note that the *layout slot*
  (a bordered panel between description and comments) is where a rich custom-field block could go.
- **Comments** are a flat thread: 24px avatar, name, relative time, body. No composer visible
  in the default state.

**Ticket actions `⋯`** → `Edit description`, `Copy ticket ID`, `Mark as done`.
**Notably absent: there is no delete action anywhere** — not in the ticket, not in the column menu.

### 6.5 Header toolbar

| Control | Behaviour |
|---|---|
| **Sort tickets** | Popover, single-select: `Manual order`, `Priority`, `Title` |
| **Filter tickets** | Popover, two grouped single-selects: **Priority** (All/Low/Medium/High/Urgent) and **Project** (All/vibl/firstview/BoardUI) |
| **Display options** | Popover, two checkboxes: `Show done column`, `Fill wide screens` |
| **Notifications** | Popover panel: `5 unread`, `Mark all read`, tabs `All 6 / Mentions 2 / System 3`, then notification rows with icon, title, relative time, body, and a contextual action button (`Reply`/`View thread`, `Download`, `Review changes`) |
| **Open project inbox** | **Inert in the demo** — no panel, no navigation, no popup. It has an accessible name but no `aria-expanded`/`aria-haspopup`. |

So of the five toolbar controls, **four are functional and one is decoration.** If we build this
row, the inbox needs a real destination or it should not ship.

### 6.6 Card affordances confirmed in the DOM

The card's full class list shows the intended interaction model:

```
cursor-grab  active:cursor-grabbing        ← draggable
hover:shadow-sm  hover:ring-border-button-hover   ← hover feedback
ring-[2.5px] ring-transparent              ← focus/drop-target ring
motion-reduce:transition-none              ← respects reduced motion
```

Drag is native and the ring is pre-reserved at `2.5px` transparent so the hover/selected state
does not shift layout. That is a detail worth copying exactly.

### 6.7 Demo-data caveat

Board mutations live in memory only — `localStorage` holds only the theme and a dismissed-promo
flag, and no board data. Reloading restores the original demo state. My test ticket
("Redesign reference test", FE-90) was created and then cleared by a reload; the board is back to
`Backlog 3/8, To do 3/5, In progress 2/4, Review 1/3, Done 4/6`.

---

## 7. Mapping to TaskNest

| Reference element | TaskNest file | Concrete change |
|---|---|---|
| Column surface | `apps/web/src/pages/home/BoardView.tsx` | `bg-[#F2F7FA]` → `bg-[#f7f7f7]`; `rounded-xl` (12px) → `rounded-[20px]`; drop `border-t border-[#DDE9EF]` |
| Column grid | `BoardView.tsx` | fixed 4-col grid → `auto-cols-[273px] gap-2` horizontal scroll; keep the 4-column data model |
| Column header | `BoardView.tsx` | title `13px w800` → `14px/20px w500`; count `3` → `3/8` (**count / WIP limit**, per §6.1); add `⋯` + `+` ghost buttons |
| **Muted text (readability)** | `BoardView.tsx`, `dialogs.tsx`, `Home.tsx` | collapse the `#718491`–`#9BAAB3` family to `#5f7482`; these currently sit at **2.4:1–3.9:1** and are the main reason light mode is unreadable (§4.1) |
| **Accent / CTA contrast** | `Home.tsx`, `dialogs.tsx` | accent text `#38A9F2` → `#297cb2`; coral button fill `#FF6B5E` → `#c45248` **or** keep the coral and use ink text on it instead of white (§4.2) |
| Card container | `dialogs.tsx` `TaskCard` | `rounded-xl border border-[#E5EDF2] border-l-[3px] border-l-[#D6E7EF]` → `rounded-xl bg-white shadow-[0_1px_1px_#0000000d]` (drop both borders) |
| Card order | `TaskCard` | reorder to **meta → chips → title → date**; remove the "Task" badge, the `MoreHorizontal`, and "Open context →" |
| Card title | `TaskCard` | `text-[13px] font-extrabold` → `text-[14px] font-medium leading-5` |
| Priority pill | `types.ts` `priorityStyle` | drop `ring-1 ring-inset`; `text-[10px]` → `13px/18px w500`; `px-1.5 py-0.5` → `px-1.5 py-0.5` with `rounded-md` (6px) |
| Card meta row | `TaskCard` | move assignees (`Faces`) to the **top** row beside the ID/project; date to its own bottom row |
| Buttons | `dialogs.tsx`, `Home.tsx` | primary → `h-9 rounded-[10px]` gradient `#2b7fff → #155dfc`; icon buttons → `size-9 rounded-[10px] border-[#ebebeb]` |
| App shell | `Home.tsx` `<aside id="workspace-sidebar">` | flush rail → inset panel: `m-3 rounded-3xl bg-[#f7f7f7] border border-white shadow-sidebar`; nav items `h-9 rounded-[10px]`; active = accent gradient |
| Page header | `Home.tsx` `<header>` | breadcrumb → `12px/16px w500 text-[#a1a1a1]`; `<h1>` DM Serif Display → `text-[20px] font-medium leading-[26px]` |
| **Create flow** | `dialogs.tsx`, `Home.tsx` new-task dialog | our form-style dialog → **composer**: borderless title textarea + collapsed property pickers + `Keep creating` switch (§6.1) |
| **Property pickers** | new | reuse `priorityStyle` pills as the urgency options so picker and card share one vocabulary (§6.2) |
| **Column `+`** | `BoardView.tsx` "Add task" | open the create composer **with status pre-filled** instead of a separate path (§6.3) |
| **Ticket detail** | `TaskDrawer.tsx` | our drawer → 609px right sheet, radius 24px, inset 12px; add the inline Properties chip row (§6.4) |
| **Header toolbar** | `Home.tsx` filter row | consolidate sort/filter/display into 36px icon buttons with popovers (§6.5); wire the inbox or drop it |
| **Drag affordance** | `TaskCard` | reserve `ring-[2.5px] ring-transparent`, add `cursor-grab`/`active:cursor-grabbing`, `motion-reduce:transition-none` (§6.6) |
| Dark mode | `apps/web/src/index.css:87–316` | replace the hex-remap layer for board components with the §2.2 token values |

**Suggested token home:** add the §2 values to the existing `@theme inline` block in `apps/web/src/index.css` so they're available as `bg-tn-bg-secondary`, `text-tn-text-secondary`, `rounded-tn-card`, etc. That also lets the dark remap layer shrink instead of growing.

### Suggested sequence

**Step 0 is the readability fix (§4) — it is the smallest change and the one the team can feel
immediately.** Everything else is polish by comparison.

1. **Readability** — collapse the grey family to `#5f7482` and fix the accent/CTA contrast (§4.2).
   Touches three files, no layout change, and moves light mode from 2.4:1 to ≥4.5:1 across the board.
   Land this on its own so it can be reviewed as a contrast change, not a redesign.
2. **Tokens** — add §2 + §3 scales to `index.css` (no visual change yet, unblocks the rest).
3. **Column + card** — the two changes with the largest visual payoff, contained in `BoardView.tsx` + `TaskCard`.
4. **Priority pills + chips** — small, mechanical, in `types.ts`.
5. **App shell + header** — larger surface area, do last; it touches `Home.tsx` which also holds unrelated logic.
6. **Create composer + ticket sheet** — the interaction rework (§6.1, §6.4); larger than the styling work and
   should be its own change.
7. **Dark mode** — delete the board's hex-remap entries once the board no longer uses raw hex.

---

## 8. Provenance & constraints

- Captured from the **live rendered page** at `https://www.boardui.com/templates/project-board`; the page itself advertises "This template is part of Pro" — it is a **commercial template**.
- Use it as a **design reference only**: proportions, type scale, color relationships, and layout patterns. Do **not** copy its source code, markup, or image assets.
- The board shows **demo content** (DS-38, FE-86, "BoardUI Design Tasks", the *BoardUI / Mertcan Esmergul* account). None of that is data to migrate.
- The reference has no dependency, blocked, recurrence, or custom-field affordances. TaskNest has all four — they need a home in the new card layout without re-introducing the chrome the reference deliberately omits. Suggested: keep them as compact icon+count chips in the bottom row, and move anything longer into the existing `TaskDrawer`.
- **Two controls in the reference are inert in the demo** (`⋯` on columns, `Open project inbox`). Treat them as *visual* reference only; there is no behaviour to copy.
- **Two behaviours are deliberately not recommended for copy:** silent empty-submit blocking (§6.1), and the absence of any delete affordance (§6.4). TaskNest already has typed-confirmation delete and restore flows that are strictly better.
- All interaction findings in §6 were produced by driving the live page; the board state was restored by reload afterwards (§6.7).
