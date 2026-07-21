# Design-sync notes — topspiagge-design-system

## What this package is

A small, hand-ported design-system extracted from the Top Spiagge Expo/React Native app
(`topspiagge-app/`). The source components (`src/components/UI.tsx`) are React Native
(`View`/`Text`/`Pressable`/`StyleSheet`, icons via `@expo/vector-icons` Ionicons) — this
package is a **from-scratch web-native React port** of 5 of them (Button, Card, Chip,
StatusPill, SectionHeader), not a react-native-web build. Colors/spacing/radius tokens and the
`DisplayStatus` color/label maps were copied verbatim from `topspiagge-app/src/theme/index.ts`
and `topspiagge-app/src/utils/displayStatus.ts`. There is no build-time link between the two
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
- Only 5 of the app's ~15 `UI.tsx` exports were scoped in (Button, Card, Chip, StatusPill,
  SectionHeader) — user-confirmed via `AskUserQuestion`. `Badge` (legacy, superseded by
  `StatusPill`), `IconButton`, `EditDeleteRow`, `Checkbox`, `Stepper`, `StepProgressBar` were
  intentionally left out of this package.

## Known render warns

None — render check passed clean on the first validate run (5/5, no `bad`/`thin`/
`variantsIdentical` flags) both before and after previews were authored.

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
  the `.d.ts` + authored preview `.tsx` files (`docs: 0/5 components matched` in the build log
  is expected, not an error).
- This is a first sync — `projectId` gets recorded in `.design-sync/config.json` once the
  upload verifies.
