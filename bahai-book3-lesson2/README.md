# Justice — Book 3, Lesson 2 Class Companion

A small single-file web app to help a teacher run the Bahá'í children's class
lesson on Justice (Book 3, Lesson 2, ages 5–7).

## Use it

Open `index.html` in any browser — no install, no server, no internet
connection needed. Everything runs client-side in that one file.

## Two screens

The app is built for two screens at once:

- **Teacher screen** — the window you open `index.html` in. All the
  controls live here: timers, the lesson script, and the buttons that drive
  each game.
- **Kid screen** — click **"🖥️ Open Kid Screen"** in the header to pop open a
  second window. Drag that window onto a TV or projector so the children see
  only the big, colourful, game-like version of whatever step you're on. It
  updates live as you use the teacher controls — nothing to operate on the
  kid side.

If only one screen is available, the kid window can just be switched to on
the same device when it's time to show something.

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
- **Orange story toggle** — flip the kid screen between "one friend has it
  all" and "shared fairly, half each" while you tell the story.
- **Fair Shares dealing game** — set the number of children and items, then
  deal them out one at a time (or all at once) and watch items land in each
  child's pile live on the kid screen, with any leftover shown separately to
  prompt the fairness discussion. A button suggests an uneven amount for
  round two.
- **Drawing prompt cards** — big icon cards for sharing, taking turns, and
  helping a friend, plus a synced countdown.
- **Prep checklist and end-of-class notes**, saved locally in the browser so
  they're there next time you teach this lesson.

`lesson-plan.md` is the original lesson plan the app is built from.
