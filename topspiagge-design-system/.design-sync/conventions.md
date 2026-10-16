## Top Spiagge design-system conventions

This is the visual language of **Top Spiagge**, a beach-club ("lido") operator app: sandy/sea
palette for spatial views, a Bootstrap-admin-style blue/orange/red button language for
everything else.

- **Button variants** map to intent, not just color: `primary` (blue, default action),
  `secondary` (sand, low-emphasis action like "+ Aggiungi"), `success` (green, confirms/
  registers something), `danger` (red, destructive — delete/cancel), `info` (cyan, informational
  action like print), `muted` (gray, reset/undo), `ghost` (transparent + primary border/text,
  used for "close" or secondary navigation). Pick the variant that matches the action's real
  consequence, not just for visual variety.
- **Icons are a `ReactNode` slot**, not a name from an icon font — pass any small element
  (inline SVG, emoji). Keep icons to a single leading glyph at ~16px; the components don't size
  or position anything larger.
- **StatusPill's 5 statuses have fixed meaning** and should never be relabeled: `libero`
  (green, free), `occupato` (red, occupied — note red means "in use", not "problem", in this
  domain), `sgombera` (orange, occupied but checking out today), `stagionale` (blue, long-stay
  30+ day booking), `da_saldare` (black, unpaid balance — this one takes visual precedence when
  `unpaid` is set on any other status, shown as a ring on the dot + a "· Da saldare" suffix
  rather than recoloring the whole pill).
- **Chip** is the multi-purpose "small tap target" — used both as tab/filter selectors
  (`selected` toggles blue-vs-sand fill) and as inert status/tag labels (`dotColor` without
  `onPress`). A chip without `onPress` should still read as informational, not broken.
- **Card** is a plain elevation container with no built-in header — pair it with
  `SectionHeader` above it or compose a small title row inside it (see the `BookingSummary`
  preview) rather than inventing a new "card with title" component.
- **Spacing/radius are on an 4/8/12/16/24/32 (xs–xxl) and 6/10/16/24 (sm–xl) scale** — compose
  new layouts from these tokens rather than arbitrary pixel values, to stay visually consistent
  with the rest of the app.
