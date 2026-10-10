# Lowkei design system

Read this before building or changing a screen. The brand itself — the mark,
voice and how the pictures are chosen — is in [`../design/BRAND.md`](../design/BRAND.md).

**Stance:** a soft, dreamy place made of light. Every page opens under a
picture — the day's sky — and its words sit on paper that slides up over it.
Colour lives in the pictures and the auras; the text stays calm and readable.

Everything below is a token or a component in `src/`. Use them; don't add a
colour, size or radius inline. WCAG 2.2 AA throughout — the contrast tests in
`src/theme/__tests__/contrast.test.ts` check every pair named here.

## Colour — `src/theme/tokens.ts`

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `paper` | `#F7F6FA` | `#0C0B16` | Page ground: lavender-white by day, deep indigo by night |
| `ink` | `#14131C` | `#F2F1F7` | Text, primary buttons, outlines |
| `inkSoft` | `#4F4E66` | `#B8B6CC` | Secondary text — AA even over the strongest aura |
| `inkFaint` | `#B9B8C7` | `#46445C` | Decoration only, never text |
| `band` | `#ECEAF4` | `#191829` | Pressed rows, the search field |
| `tint` | `#F7EEF6` | `#1E1630` | Writing sheets |
| `disc` | `#FFFFFF` | `#1B1A2E` | Plates behind avatars |
| `signal.*` | per weather | per weather | The one small colour mark (weather dot, current tab) |
| `glass` / `glassEdge` | white 52% / 90% | white 7% / 16% | Glass cards, header pills, fields |
| `sheet` | paper 90% | paper 90% | The page sheet over a picture |
| `chrome` / `chromeEdge` / `chromeActive` | | | The floating tab bar and its current-tab capsule |
| `frost` | white 88% | indigo 84% | A label sitting on a picture (mood cards) |
| `veil` | none | indigo 38% | Over a picture at night |
| `room.*` | | | The Mirror's dark room, both themes; `room.veil` 76% over its picture |

**Auras** (`theme/aura.ts`): four soft glows per Inner Weather drift behind
every page (`components/Aura.tsx`), capped at 42% (day) / 33% (night) so
text stays AA over their strongest point.

## Pictures — `src/theme/scenes.ts`, `src/components/Art.tsx`

26 slots, sources in `design/images/`, built by `scripts/pictures.py`
(prompts in `design/image-prompts.md`).

| Slots | Where |
| --- | --- |
| `sky-clear · mild · overcast · fog · storm · dawn` | The band at the top of Today, Check-in, Chart, You — chosen by the day's Inner Weather (`dawn` before any check-ins) |
| `room-circle · mirror · welcome · calm` | Circle's band; the Mirror's whole backdrop (veiled); onboarding and sign-in; Calm |
| `mood-wound-up · bright · heavy · easy` | The four check-in mood cards, full-bleed with a `frost` label |
| `sticker-*` (12) | `Art` (rounded sticker) and `ArtDisc` (glowing round plate): Today's picture, profile and circle pictures, Mirror topics |

Rules: text never sits directly on a picture — it goes on the `sheet`, a
`frost` label or a glass pill. Pictures are decorative and hidden from screen
readers.

## Type — `src/theme/typography.ts`

| Family | Use |
| --- | --- |
| **Fraunces** | What the app says: `reading` 36/42, `title` 28/34, `heading` 20/26, `bodyItalic` 19/26 (prompts) |
| **DM Sans** | Everything you read and touch: `body` 16/24, `caption` 14/20, `label` 13/18 semibold, `action` 15/20 semibold, `mono` 13/18 (small notes) |
| **DM Mono** | Numbers only: `receipt` 13/21 — data lines, the code you type |

Sentence case everywhere — no uppercase labels. Font scaling is honoured up to
200%.

## Space, shape, touch

- Space: `xs 4 · sm 8 · md 16 · lg 24 · xl 40 · xxl 64`; page gutter 20;
  sections 40 apart.
- Radius: `card 22` (glass cards, mood cards, sheets' inner pieces), `pill`
  (buttons, chips, header pills, tab bar, fields), `dot` (avatars, the
  weather dot). The page sheet's top corners are 32.
- Touch targets at least 44 (`hitTarget`).

## Components — `src/components/`

| Component | What it is |
| --- | --- |
| `Screen` | The page: aura behind, optional `scene` band (a picture) with the content on a sheet that slides over it, or a full `backdrop` (the Mirror). Leaves room for the floating tab bar. |
| `AppHeader` / `SubHeader` | The wordmark and calm, or back/close and a title — on frosted pills so they read over pictures. |
| `TabBar` | Six names on a floating glass pill; the current one in a soft capsule with the weather dot. |
| `Button` | `primary` ink pill with a soft glow; `outline` glass pill; `link` underlined. |
| `Chip` | A pill for words and tags; selected is inverted. |
| `SettingGroup`, `SettingRow`, `SettingLink`, `Box` | Settings and summaries on glass cards. |
| `Art`, `ArtDisc`, `Avatar` | Pictures as stickers, glowing plates, people. |
| `Sparkles` | A few four-point glints, twinkling slowly. |
| `Aura` | The drifting weather glows; leans towards a touch. |

## Motion

Slow and breathing: transitions 600–900 ms, sine easing, nothing bounces
(`theme/motion.ts`). Auras drift on a 22 s cycle, sparkles on 4.5 s. The
person's Motion setting is honoured everywhere: `gentle` halves speeds,
`still` stops ambient motion and keeps only plain fades — and the system's
reduce-motion setting means `still`.

## Accessibility

AA contrast for every text pair (tested); 44-point targets; labels for every
control; pictures hidden from screen readers; reduced motion respected; text
scales to 200%.
