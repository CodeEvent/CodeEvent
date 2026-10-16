# Design-sync notes — topspiagge-design-system

## What this package is

A small, hand-ported design-system extracted from the Top Spiagge Expo/React Native app
(`topspiagge-app/`). The source components (`src/components/UI.tsx`) are React Native
(`View`/`Text`/`Pressable`/`StyleSheet`, icons via `@expo/vector-icons` Ionicons) — this
package is a **from-scratch web-native React port** of 10 of them (Button, Card, Chip,
StatusPill, SectionHeader, IconButton, EditDeleteRow, Checkbox, Stepper, StepProgressBar), not a
react-native-web build. Colors/spacing/radius tokens and the `DisplayStatus` color/label maps
were copied verbatim from `topspiagge-app/src/theme/index.ts` and
`topspiagge-app/src/utils/displayStatus.ts`. There is no build-time link between the two
packages — if the app's theme or status colors change, this package's `src/tokens.ts` must be
updated by hand.

## Repo-specific gotchas

- **Icon prop is `React.ReactNode`, not an Ionicons name.** The RN originals take
  `icon?: keyof typeof Ionicons.glyphMap`. Ionicons is an RN/Expo icon font with no web-native
  equivalent shipped here, so `Button`/`Chip`'s `icon` prop was changed to accept any React
  element (emoji span, inline SVG, etc.) instead. This is a deliberate API difference from the
  app's real `UI.tsx`, not a bug.
- **Chromium/Playwright version pinning**: the environment's cached chromium build is
  `chromium-1194`, but `npm i playwright` resolves a newer version pinned to build 1228 by
  default, causing `browserType.launch: Executable doesn't exist`. Fix: pass
  `DS_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` as an env var to
  `package-validate.mjs`/`package-capture.mjs` (the scripts read `DS_CHROMIUM_PATH` and pass it
  as `executablePath`).
- 10 of the app's ~15 `UI.tsx` exports are ported (everything except `Badge`, which stays out
  intentionally — it's a legacy component superseded by `StatusPill` and unused elsewhere in the
  app). The first 5 (Button, Card, Chip, StatusPill, SectionHeader) were user-scoped via
  `AskUserQuestion`; the remaining 5 (IconButton, EditDeleteRow, Checkbox, Stepper,
  StepProgressBar) were added in a second pass to round out the full non-legacy `UI.tsx` surface.
- **`IconButton`'s `icon` prop defaults per variant** (pencil for `edit`, trash for `delete`, none
  for `neutral`) instead of requiring the caller to always pass one — this mirrors the RN
  original's fixed `name` prop (`'pencil'`/`'trash-outline'`) exactly for the two variants that
  had a fixed icon there, while still accepting a custom `ReactNode` override for anything else
  (`neutral`, or a nonstandard edit/delete icon).

## Known render warns

None on the first sync (5/5 clean). The second-pass build (adding the remaining 5 components)
printed one transient `[RENDER_BLANK]` for `IconButton` before its preview was authored (a bare
36×36 icon button with no text is legitimately under the 5KB floor-card heuristic) — resolved by
authoring `IconButton.tsx`; not a recurring warn to watch for.

## Re-sync risks

- **Tokens can silently drift from the app.** `src/tokens.ts` is a hand-copied snapshot of
  `topspiagge-app/src/theme/index.ts` + `src/utils/displayStatus.ts`. Any future palette change
  in the app (e.g. a new `DisplayStatus`, like `stagionale` was added mid-project) needs a
  matching manual edit here before the next re-sync, or the design-system will render stale
  colors.
- **The icon-prop shape is an intentional divergence from the RN source** (see gotcha above) —
  if someone ports more components from `UI.tsx` later (e.g. `IconButton`), they should follow
  this same `ReactNode` convention rather than reintroducing an Ionicons-name prop that can't
  render on the web.
- **No Storybook, no docs/ folder** — component `.prompt.md` files are synthesized purely from
  the `.d.ts` + authored preview `.tsx` files (`docs: 0/10 components matched` in the build log
  is expected, not an error).
- `projectId` is recorded in `.design-sync/config.json` (an existing, previously-created
  claude.ai/design project was reused rather than a new one) — re-syncs fetch `_ds_sync.json`
  from it automatically.
