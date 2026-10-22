# Documentary Red — Design Rules

## Intent
A sober investigative-documentary look: sharp typography, restrained red highlights, warm-white text, and dark evidence-room atmosphere. The graphics should support the narration, not compete with it.

## Colors
- Background: `--doc-bg` from `tokens.css`
- Primary text: `--doc-ink`
- Supporting text: `--doc-muted`
- Investigative accent: `--doc-red`
- Secondary evidence accent: `--doc-yellow`

## Typography
Use a heavy, condensed-looking system sans-serif stack for headlines and a readable sans-serif for supporting lines. Headline text is uppercase. Kicker labels are compact and letter-spaced.

## Motion
- Entrances: 0.35–0.65 seconds; use slide-up or fade by default.
- Exits: short and quiet, usually 0.25–0.4 seconds.
- Prefer opacity and transforms over layout animation.
- Keep all timelines finite and register exactly one paused timeline for the composition.
- Preserve legibility; avoid flashing, excessive shake, or perpetual animation.

## Layout
- Build the fully visible frame first.
- Use generous margins and one clear hierarchy.
- A headline card may use a subtle translucent panel when footage behind it makes text hard to read.
- The highlighted phrase is limited to one selected phrase within the headline.

## Do not
- Use external images, fonts, scripts, or network resources.
- Add decorative graphics that invent facts about a real investigation.
- hide faces with supporting cards.
- use unbounded or random animation.
