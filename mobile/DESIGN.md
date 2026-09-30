# MirrorSpace design system

The reference for every screen is a screen recording of the Co-Star app
(kept outside git). MirrorSpace follows its **design language** — layout,
type, components, pacing — with its own content, icons and copy. It never
copies Co-Star's logo, illustrations, typeface or text, and it keeps WCAG 2.2
AA where the reference does not.

Read this before building or changing a screen.

## Feel

A printed almanac on a phone. Near-white paper, black ink, lots of air, and
text doing all the work. Nothing bounces, nothing is rounded except avatars
and the weather dot, and nothing is coloured except one small signal mark.
Screens are finite: a feed ends with **The end**, never an infinite scroll.

## Colour (`src/theme/tokens.ts`)

| token | light | dark | use |
|---|---|---|---|
| paper | `#F6F6F3` | `#0E0E0E` | every background |
| ink | `#111111` | `#F2F2EF` | text, rules, primary buttons |
| inkSoft | `#6A6A66` | `#A09F9A` | subtitles, inactive tabs, mono labels — AA on paper |
| band | `#ECECE8` | `#1A1A1A` | thick section breaks, pressed rows, search field |
| tint | `#F7EEF4` | `#1C1519` | the rare soft-pink surface: a writing prompt, a sheet |
| disc | `#FFFFFF` | `#1C1C1B` | the round plate an illustration sits in |
| void | `#0A0A0A` | `#0A0A0A` | full-dark rooms (Mirror), with white text |
| signal | per Inner Weather | | **only** the weather dot and the active-tab dot |

Light, dark, or the phone's setting is chosen under **You → Appearance**
(`useAppearance()`); the choice is also handed to the native side so switches
and the keyboard match.

## Illustrations (`assets/art/`, `src/components/Art.tsx`)

Halftone cut-outs, black ink on transparent. At night the dark silhouettes
are inverted to light ink (`name-dark.png`); the mostly-white ones (eye,
lily, swan, orchid, doll, moka, stamp) are used as they are. Always
decorative and hidden from screen readers.

- `ArtDisc` — the reference's round plate, top right of Today and the welcome
  screen, followed by a long pause before the label. Today's rotates daily.
- `Art` — a free cut-out in the margin between sections, alternating sides:
  one per screen, never two in a row.

| screen | art |
|---|---|
| Today | daily disc + masks |
| Check-in | doll; after: lily |
| Mirror | eye (dark) |
| Chart | beetle |
| You | cat |
| Vent / plan / sleep / calm | heart / bandage / city / swan |
| Not yet open | chess king |

## Type (`src/theme/typography.ts`)

Three families, all SIL OFL:

- **Instrument Serif** — anything the app *says*: the headline ("Be patient."),
  row titles, Do/Don't items, big centred statements. Never bold.
- **Inter** — body paragraphs and subtitles. Small (15/22), regular weight.
- **DM Mono** — the voice of the interface: the wordmark, section labels
  (`YOUR DAY AT A GLANCE`), tab names, buttons, links, data lines, long reads.
  Labels are UPPERCASE with wide tracking; the small grey "Do"/"Don't" style
  is mono in sentence case.

Dynamic Type up to 200% everywhere.

## Layout

- **App header** (every tab): wordmark `MIRROR – SPACE` with the weather dot
  on the left, `CALM` alone on the right (where the reference keeps its date).
  No rule. Fixed; content scrolls beneath. Onboarding shows the `CALM` link alone.
- **Sub-screen header**: back arrow left, mono title centred (`Crush Report`
  style) — or a large serif title left-aligned for settings-like screens.
- **Tab bar**: `TODAY · CHECK-IN · MIRROR · CHART · YOU` — text only, 10pt
  mono capitals, no icons, no rule. First and last sit on the page margins and
  the gaps between all five are equal. Active is ink with a small signal dot;
  inactive is inkSoft.
- **Help**: crisis lines are a `HELP` link in calm's header — one tap from
  calm, two from anywhere — and the crisis screens open by themselves when a
  check-in screens elevated or acute. There is no care strip over the tabs.
- Side margin 20. **One vertical rhythm**: a screen's direct children are
  sections, 40 apart (`Screen`); inside a section things sit 8–16 apart
  (`Lede`, `Section`, `SettingGroup`). Never loose elements at the top level.
- Page tops use `Lede`: mono label, big serif line, short paragraph.
- Settings (You) follow the reference's settings page: small grey group
  headings, plain-text lines with no rules between them, switches at the right.

## Components (`src/components/`)

| component | reference look |
|---|---|
| `Button` primary | solid ink rectangle, paper mono uppercase label, optional `→`, hugs content |
| `Button` outline | 1px ink border, mono uppercase (`CHANGE PROFILE PHOTO`) |
| `Button` link | mono uppercase, underlined, no box (`VIEW ALL LONG READS`) |
| `SectionLabel` | mono uppercase label with a hairline under it (`TODAY'S LONG READ`) |
| `Segmented` | horizontal mono tabs with a small ○ bullet (● when active) and an underline |
| `Row` | optional leading image, serif title, grey Inter subtitle, `→` at the right, hairline |
| `Box` | 1px ink border; optional mono header row divided by a rule; centred content |
| `DoDont` | two columns, grey mono heading, serif items |
| `Chip` | 1px-bordered square box, serif word; inverted when selected |
| `EndMark` | ink block with *The end* and an underlined link — the bottom of a feed |
| `Toggle` | small grey/ink switch, no colour |

## Motion

600–900 ms eases, no bounce. Reduced motion → plain fades. A thin circular
spinner centred on paper while loading.

## Mapping to MirrorSpace

| reference | MirrorSpace |
|---|---|
| Home: "Your day at a glance", Do/Don't, "Dive deeper" | Today: reading, receipts, Do/Don't |
| Void (dark room, suggested questions, ask anything) | Mirror chat |
| Friends list, compatibility | Circle (v1; not a tab until it exists) |
| Chart wheel, tables and boxed placements | Chart: the month as a wheel of weather, words set by size, tag lines, a skyline of nights |
| You / Settings rows and toggles | You tab: appearance, reminder, lock, consents, export, erase |
| "Send your future self a message" prompt sheet | Vent / letters |
