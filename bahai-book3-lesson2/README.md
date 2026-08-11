# Justice — Book 3, Lesson 2 Class Companion

A small single-file web app to help a teacher run the Bahá'í children's class
lesson on Justice (Book 3, Lesson 2, ages 5–7).

## Use it

Open `index.html` in any browser — no install, no server, no internet
connection needed. Everything runs client-side in that one file.

## Two screens

- **Teacher screen** — the default view. All the controls live here: timers,
  the lesson script, and the buttons that drive each game.
- **Kid screen** — click **"👀 Switch to Kid Screen"** in the header to swap
  the whole page over to the big, colourful, game-like view for whatever
  step you're on, with a "🧑‍🏫 Teacher Screen" button to switch back. Nothing
  to operate on the kid side.

**One screen:** just flip back and forth with those two buttons.

**Two screens (a laptop + a TV/projector):** open `index.html` a second time
in another tab or window (or the same file on the second screen), and switch
*that* window to Kid Screen while the first stays on Teacher Screen. The two
stay in sync automatically — hide a word, deal out an item, or move to the
next step on the teacher window and the kid window updates live. (This sync
uses the browser's local storage, so both windows need to be the same file
opened twice, not two different copies.)

## What it does

- **Master 45-minute class timer** with start/pause/reset and a chime when it hits zero.
- **Step-by-step walkthrough** of all 6 parts of the lesson (welcome & prayer,
  quote memorisation, talk & story, the Fair Shares game, drawing, review &
  closing prayer), each with its own countdown timer sized to the plan, and a
  footprint path tracker on the kid screen showing where the class is.
- **Quote memorisation game** — hide one word at a time (or click any word)
  and watch it disappear as a face-down "❓" card on the big kid board, with a
  star filling in for every word learned and a celebration when the whole
  quote is hidden.
- **Sing the quote** — plays the quote word by word through the browser's
  built-in voice with a simple rising-and-falling pitch, so it comes out as a
  little sing-song chant. The word being sung glows on both screens as it
  plays.
- **Editable quote of the day** — the quote and who said it aren't fixed to
  Lesson 2. Edit them in the "Quote of the day" panel on Step 2 and the
  board, the song, and both screens all switch to the new one immediately
  (handy for reusing the app with a different lesson's quote).
- **Orange story toggle** — flip the kid screen between "one friend has it
  all" and "shared fairly, half each" while you tell the story.
- **Fair Shares dealing game** — set the number of children and items, then
  deal them out one at a time (or all at once) and watch items land in each
  child's pile live on the kid screen, with any leftover shown separately to
  prompt the fairness discussion. A button suggests an uneven amount for
  round two.
- **Draw or colour, right on the kid screen** — big prompt cards for sharing,
  taking turns, and helping a friend, plus a real colouring canvas underneath
  with a colour palette, three brush sizes, and a clear button, so a child at
  the screen (mouse or touchscreen) can draw alongside everyone using paper.
- **Prep checklist and end-of-class notes**, saved locally in the browser so
  they're there next time you teach this lesson.

`lesson-plan.md` is the original lesson plan the app is built from.
