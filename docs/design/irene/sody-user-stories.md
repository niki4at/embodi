# Sody — Frontend redesign: master brief & user stories

> **For Irene.** This is the single source of truth for what the app must do. You own how it looks, feels, and flows. Every screen here exists today under the old brand (Embodi) — you're redesigning all of it from scratch as **Sody**. Nothing in this document prescribes visuals. Where we show old screenshots, they're context, not direction.
>
> This file lives in the repo at `docs/design/irene/sody-user-stories.md` and every epic is mirrored as a card in the Trello list **"user stories irene"** on the [Embody board](https://trello.com/b/o2oRLfWu/embody). Comment on cards, reorder them, split them — it's your working backlog.

---

## 1. The product in one paragraph

**Sody (Sound + Body)** is an AI fitness coach that keeps your body sound. It delivers safe, effective training for everyday people — including people with aches, chronic conditions, desk jobs, and flare-up days. The core loop: you set a **goal**, the AI coach builds a program and always keeps **exactly one workout queued** for it; before you train, the app checks how you feel **today** (energy, pain, sleep, time) and adapts the session in real time; you log the workout with fast, satisfying set-tracking; you get a recap with insights and records; and you can share it with friends who back you, join shared goals together, and stay accountable. Everything counts — a gym session, a run, a 3-minute desk stretch, a breathing break.

**Tagline:** Keep your body sound.

## 2. Brand baseline (from the brand sheet)

- **Name:** Sody. Logotype is bold, bubbly, rounded — playful but confident.
- **Fonts:** Val Bold (display), Lekton Bold (secondary / mono accents).
- **Palette (as given):** `#FFFCE9` cream · `#D3CFFF` lavender · `#90AA47` olive-lime · `#324B3E` deep green — used in the sheet alongside a vivid royal blue and chartreuse lime for the logotype and brand elements.
- **Brand elements:** squiggle/loop line work, photographic body imagery with hand-drawn line overlays ("honor your body", "root yourself in presence", "learn to listen").
- **Voice:** warm, body-positive, evidence-aware. Never drill-sergeant. The coach listens first.
- The baseline is a starting point — evolve it wherever the product needs it (dark mode, semantic colors for pain/success/warning, data-viz, category tints for goals).

## 3. Who we're designing for (personas)

1. **Desk-bound Dana (28–45).** Sits 8h/day, neck and lower-back aches, wants short sessions that fit around meetings. Uses desk breaks, breather, 15-min sessions. Fears gym-bro apps.
2. **Chronic-condition Chris (25–60).** Scoliosis / chronic pain / post-injury. Needs the coach to *actually respect* pain regions, flare-up days, and medical context. Privacy of health data is non-negotiable.
3. **Everyday-gym Emma (20–35).** Trains 3–4×/week, wants progressive overload, PRs, fast set logging (Hevy-level speed), and to share workouts with friends.
4. **Event-chaser Eli (25–45).** Signed up for a marathon / Hyrox with friends. Wants a shared goal, a countdown, group progress (progress, not ranking), and a plan that adapts week by week.
5. **Restart Rita (30–55).** Fell off for months. Needs a kind comeback, tiny wins, streaks that forgive (weekly, not daily), and zero guilt-tripping.

## 4. Design principles (what we believe — challenge them)

1. **Today beats the plan.** Every workout entry runs through "how are you today?" — except deliberate repeats (own routines) and the queued goal workout, which gets a lightweight "Adjust for today" instead.
2. **One next thing.** Home leads with a single hero: the next queued workout. Not a dashboard dump.
3. **Everything counts.** Any activity can be attributed to a goal. A breather counts. A desk stretch counts.
4. **Progress, not ranking.** Shared goals show everyone moving; they never shame the slowest.
5. **Health data is sacred.** Conditions, meds, pain history, cycle data, coach memory: never on any public surface.
6. **The coach shows its work.** Adaptations say *why* ("built around mild knee sensitivity"). Evidence/citations are available.
7. **Logging must be faster than a notes app.** Tick a set = one tap. Clone a set = one swipe.
8. **Both light and dark mode, every screen, day one.**

**You are explicitly invited to be critical.** Things we already suspect are wrong: the session screens feel "zoomed-in" and cramped; the check-in may have too many steps; home/desk/insights sections compete for attention; the pain body-map is coarse (whole muscle groups, not spots); empty states are copy-heavy; iconography is inconsistent. Kill our darlings where justified.

## 5. App map (information architecture today — restructure if you see better)

**Tabs:** Social · Home · Goals · Profile (floating bar, hidden during auth/onboarding).

| Area | Screens |
|---|---|
| Auth | Welcome, sign in, sign up, email OTP verify (+ Apple/Google/Facebook SSO) |
| Onboarding | 4 steps: about you → first goal → health context → lifestyle |
| Home | Greeting, Next-up hero, other goals, quick actions, today's context, desk section (work hours), This Week insights |
| Training | Check-in (4 steps), Adjust-for-today, Session ready, Live session, Recap, Build-your-own, Breather |
| Goals | Goals list, New goal, Goal detail, Join by code |
| Library | Exercise picker (search / body map / custom / camera scan), Exercise detail + coach chat |
| Social | Feed, search, notifications inbox, share composer, post detail, comments, public profile, edit profile, blocked |
| Progress | Profile hub, Journey (achievements + PRs + heatmap), History, Routines |
| Health | Health context, Flare-up mode, Cycle log, Desk/posture survey |
| Settings | Settings hub, Privacy, Notifications, Training setup, Data & AI, Account |

---

# User stories

Numbered `S-<epic><nn>`. Each has acceptance criteria (AC) that describe *behavior*, not visuals. "Design ahead" stories at the end are not built yet — design them so the system has room to grow.

---

## Epic 1 — Brand shell, navigation & theming

Goal: a Sody-branded design system + app shell everything else lives in.

- **S-101.** As a user, I want the app to feel like one coherent brand (Sody) across every screen, so that it feels trustworthy and alive.
  - AC: full component library (type scale, colors incl. semantic + goal-category tints, buttons, cards, chips, inputs, sheets, toasts, skeletons, empty states, charts/heatmap, body map, tab bar, headers).
- **S-102.** As a user, I want light and dark mode on every screen, so the app is comfortable any time of day.
  - AC: every screen has both variants; theme follows System with Light/Dark override in Settings.
- **S-103.** As a user, I want a persistent, thumb-friendly tab navigation (currently Social · Home · Goals · Profile), so I always know where I am.
  - AC: badge support (unread notifications); hidden during auth/onboarding and full-screen flows (live session, check-in).
- **S-104.** As a user with accessibility needs, I want text to follow my OS text-size setting and a reduce-motion option, so I can actually use the app.
  - AC: layouts survive XL type without clipping; all celebratory animations have a reduced variant.
- **S-105.** As a user, I want loading skeletons, empty states, and error states designed for every screen, so the app never feels broken.
  - AC: every epic's screens include loading / empty / error / offline variants in the design file.

## Epic 2 — Auth & onboarding

Goal: from store install to a personalized first plan in under 3 minutes.

- **S-201.** As a new user, I want a welcome screen that sells the promise ("keep your body sound") and lets me sign up with Apple/Google/Facebook or email, so starting is frictionless.
- **S-202.** As an email user, I want sign-up with OTP verification and clear error recovery, so I never get stuck.
- **S-203.** As a new user, I want a short onboarding that captures: name + handle, age, gender; my first goal (7 categories: endurance, lose weight, gain weight, get stronger, build a habit, train for an event, something else — with event presets like marathon/Hyrox); activity level; session-length preference, so my first plan is mine.
  - AC: progress indicator; back/skip; every step survivable with minimal input.
- **S-204.** As a user with health issues, I want to declare injuries, conditions, and medications during onboarding with an explicit privacy promise, so the coach is safe from day one.
  - AC: visible "private, never shown to anyone" reassurance at the point of entry.
- **S-205.** As a female user (or "prefer not to say"), I want an optional menstrual-cycle-tracking opt-in, so my coaching can respect my cycle.
  - AC: only shown to eligible users; opt-in, never default-on.
- **S-206.** As a returning user, I want an optional "complete your profile" Q&A (AI-generated questions: sliders, choices, free text), so the coach keeps getting smarter.
  - AC: lives on Profile, not blocking Home. (Old design nagged on Home — we killed that.)

## Epic 3 — Home: Next up & today

Goal: open the app → know exactly what to do → start in one tap.

- **S-301.** As a user, I want a time-aware greeting and one **hero card for my next queued goal workout** (title, goal, duration, moves, what's new to me), so starting takes one tap.
  - AC: hero states: ready / coach-is-planning (skeleton) / failed (retry) / none (fallback to check-in CTA).
- **S-302.** As a user, I want **Start** and **Adjust for today** on the hero, so I can either dive in or tune it to my energy/pain/time first.
- **S-303.** As a user with multiple goals, I want a compact row of my other goals with their queue state, so nothing feels forgotten.
- **S-304.** As a user, I want quick actions — **Log my own** (build a workout) and **Take a breather** — always reachable on Home.
- **S-305.** As a user mid-flow, I want Home to reflect today's session state (needs check-in / building / ready / in progress / completed with summary), so I can always resume where I left off.
  - AC: completed state offers "go again" reusing today's check-in or doing a fresh one.
- **S-306.** As a desk worker, I want a work-hours-only desk section with 2–5 minute chair/standing micro-sessions matched to my trouble spots, so I can undo sitting damage without changing clothes.
  - AC: appears Mon–Fri 09:00–18:00 only; one-time posture survey (position, desk hours, trouble spots) with skip; tapping a template starts instantly (no check-in).
- **S-307.** As a user, I want a weekly "This Week" board: an AI headline about my week, ~4 stat cards (with trend + a one-line story), and 2–3 recommended sessions with the *reason* they're recommended, so the app feels like it knows me.
  - AC: recommendations can deep-link to a goal's queued workout or seed a check-in; thumbs up/down feedback on the week's view; generating / failed / cold-start states.
- **S-308.** As a user having a rough day, I want a **flare-up mode** toggle surfaced when relevant, so one tap tells the coach to ease off my flagged regions.
- **S-309.** As a cycle-tracking user, I want a subtle current-phase chip on Home that opens my cycle log, so the context is one glance away (and invisible to everyone else).

## Epic 4 — Daily check-in & Adjust-for-today

Goal: capture "today" fast, and prove the plan responds to it.

- **S-401.** As a user, I want a check-in that asks energy, sleep, pain (on a body map), stress, workout type + optional focus areas, intensity, and time available, so today's session is built on today's state.
  - AC: currently 4 steps — you may compress; every step skippable-fast for a "feeling great" day; required minimum: sleep, pain-ack, type, intensity, time.
- **S-402.** As a user with pain, I want to tap body regions and rate severity 0–10, so the coach works around them precisely.
  - AC: design the body map to support finer targeting than whole-body-sections (specific spot or area) — a known weakness of the old design.
- **S-403.** As a strength/hybrid user, I want the app to pre-suggest **Home or Gym** (from saved places, weekly rhythm, history) that I can flip in one tap, so I never re-enter context.
  - AC: inferred suggestions carry a subtle "inferred" marker (icon, not the word "likely"); cardio/mobility/recovery/runs skip the location question entirely; saved home equipment is shown as "using what you have" with an edit-for-today escape.
- **S-404.** As a user starting a queued goal workout, I want a lightweight **Adjust for today** (energy, pain + regions, time) instead of the full check-in, so repeat starts stay fast.
  - AC: the AI may drop/reorder/retune sets but never invents exercises; the resulting change is explained in one line ("shortened + knee-friendly").
- **S-405.** As a user, I want the check-in to end with visible generation progress and exercises appearing as they're ready (streaming), so waiting ~10–30s feels alive, not broken.

## Epic 5 — Session ready (plan review)

Goal: trust before sweat — see the plan, why it looks like this, and shape it.

- **S-501.** As a user, I want a "your session is ready" screen grouped by phases (warm-up / main / cooldown) with total time and a one-line reasoning strip echoing my check-in, so I trust the plan.
- **S-502.** As a user, I want to remove or replace an exercise, reorder by drag, and preview any exercise before starting, so the plan is mine.
  - AC: replace = pick from library **or** tell the coach what to swap in; removed sections/exercises restorable (see Lyane's "session is ready renovated" concept — removable timeline sections with restore chips; treat as inspiration).
- **S-503.** As an evidence-curious user, I want a "why this is safe/effective" panel with citations (research-backed), so the coach earns credibility.
- **S-504.** As a user, I want a single **Start session** action and a clean back-out/discard path, so nothing is trapped.

## Epic 6 — Live workout session

Goal: the fastest, most satisfying set-logger on the market, with a coach in the room. This is the highest-stakes screen in the app — the old one feels cramped ("too zoomed in"); rethink density and hierarchy.

- **S-601.** As a user, I want a live session with wall-clock workout timer, overall sets progress, and a phase/journey progress bar, so I always know where I am in the workout.
- **S-602.** As a user, I want per-set rows with sec/kg/reps/RPE and my previous values, and single-tap edit with centered cursor, so logging is instant.
  - AC: flat table (no boxes around inputs); column headers directly above values; RPE right of reps; supports metric types: weight×reps, duration, distance, breath, custom.
- **S-603.** As a user, I want to tick a set and feel it (whole card fills green with a quick satisfying animation), untick freely, and never be gated on completing the prior set, so logging matches how people actually train.
- **S-604.** As a user, I want **swipe right = clone the set** (carries sec/kg/RPE, unchecked), **swipe left = delete that row** (never the last one), with color feedback behind the card, so adding/removing sets needs no buttons.
  - AC: vertical swipes still scroll; horizontal swipes win even over inputs; a subtle gesture hint replaces explicit add/remove buttons; swipe actions hidden while a set is ticked.
- **S-605.** As a user, I want set types (warm-up / normal / failure / drop set) per row, so real training styles are loggable.
- **S-606.** As a user, I want a rest timer that auto-starts after a completed set, can be minimized to a draggable pill, adds time/skips, and chimes + notifies even when the app is backgrounded, so rest is handled for me.
- **S-607.** As a user, I want a per-exercise menu: remove, replace (library or "ask the coach to substitute"), skip (soft-collapse), notes, and rest duration, so mid-workout changes are two taps.
- **S-608.** As a user, I want to reorder exercises with drag-and-hold (minimal handles, text stays visible), and add exercises mid-session, so the session bends to gym reality (occupied racks!).
- **S-609.** As a user, I want tapping an exercise to open a focus/detail view (GIF, form cues, my records, history, coach chat) where I can also log the sets, so learning and logging live together.
- **S-610.** As a user, I want short coach comments to appear near the complete action at meaningful moments, so it feels like someone's watching my back — not spamming me.
- **S-611.** As a user, I want **Complete session** at the natural end of the content (not floating over everything) and a discard-with-confirm path, so finishing is deliberate.

## Epic 7 — Recap, save & share

Goal: end on a high; convert effort into identity.

- **S-701.** As a user, I want a recap with duration, date, modality, stat tiles (sets, volume, reps, avg RPE, distance), and highlighted PRs/first-times, so I see what I earned.
- **S-702.** As a user, I want a short AI coach note about the session (streams in; hidden on failure), so the recap feels personal.
- **S-703.** As a user, I want to attribute the session to any of my goals from the recap, so everything counts toward what matters.
- **S-704.** As a user, I want to save the session as a reusable routine (named), so favorites are repeatable in one tap later.
- **S-705.** As a user, I want a share composer: title, caption, up to 5 photos, audience (public / backers), optional training-environment tag, live preview, so posting is expressive but quick.
- **S-706.** As a user logging retroactively, I want to edit the date and duration manually when saving/logging a workout, so real life (forgot my phone) is representable.
- **S-707.** As a user, I want completing the day's session to return me to a Home that shows a small "done today" summary and offers another session, so momentum is honored.

## Epic 8 — Goals: solo, shared, invites, progress

Goal: goals are the unit of intent — one entity for solo programs and group accountability.

- **S-801.** As a user, I want a Goals tab listing my goals (in progress / done / archived) with progress %, category, next-workout state, and shared-member avatars, so my intents are one screen.
- **S-802.** As a user, I want to create a goal with category, optional event preset + date, title, target value + unit, direction (increase/decrease/maintain), start value where relevant, and deadline (4/8/12/16 weeks/none), so any ambition fits.
- **S-803.** As a user, I want the coach to generate a multi-week program per goal (weekly focus + summary) and always keep exactly **one next workout queued**, so there's never a "what now?".
  - AC: visible program timeline; generating / failed-with-retry states.
- **S-804.** As a user, I want to log progress manually (value + note) and see a sparkline + % toward target, so progress isn't only workouts.
- **S-805.** As a social user, I want to make a goal **shared** (invite-only or open), invite via code / share link, and see a members board with everyone's progress and sessions, so we move together.
  - AC: progress-not-ranking presentation; milestones at 25/50/75/100%; emoji reactions on member sessions.
- **S-806.** As an invitee, I want a join-by-code/link preview (title, category, members, days-to-go) and one-tap join, so joining a friend takes seconds.
- **S-807.** As a shared-goal member, I want the group blueprint to advance together while my personal plan adapts to *me*, so we share the journey without sharing my limitations.
- **S-808.** As a goal owner, I want to edit target, archive, delete (solo) or leave (shared), and unarchive, so lifecycle is manageable.
- **S-809.** As a user finishing a goal, I want a completion moment (and a "Goal reached" achievement), so endings are celebrated and a next goal is suggested.

## Epic 9 — Exercise library, builder & exercise detail

Goal: ~123-exercise catalog + custom exercises, powering build-your-own and in-session swaps.

- **S-901.** As a user, I want to browse/search exercises by body part (visual body selector) or category (chest/back/shoulders/arms/core/glutes/legs/full-body/cardio/mobility/recovery), so finding a movement is fast.
- **S-902.** As a user, I want to create custom exercises (name, muscles, metric type), so my weird favorite counts too.
- **S-903.** As a user, I want to point my camera at equipment and get exercise suggestions (AI recognition), so a hotel gym is never a blocker.
- **S-904.** As a user, I want a builder: multi-select exercises → arrange (drag order, sets/reps/rest, prefilled from my last targets) → start immediately (no check-in), so deliberate sessions are frictionless.
- **S-905.** As a user, I want an exercise detail view: animated demo (GIF), instructions, difficulty, secondary muscles, my records, my recent history, so form and context are one tap away.
- **S-906.** As a user, I want to chat with the coach about a specific exercise (multi-turn, exercise-scoped), so "does this hurt my scoliosis?" gets a real answer.

## Epic 10 — Social: feed, discover, backing, inbox

Goal: accountability without toxicity. The graph verb is **"Back"** (not follow) — backers support you.

- **S-1001.** As a user, I want a feed of workout posts from people I back: workout snapshot (duration, volume, reps, distance, RPE, body parts, highlights), caption, photos, so friends' effort is visible and celebrated.
- **S-1002.** As a user, I want reactions (cheer/fire/strong/clap), comments, and reposts-with-quote, so support takes one tap.
- **S-1003.** As a user, I want **Try this workout** on any post — start it now or save as routine — so inspiration converts to action (and posts show tried-count).
- **S-1004.** As a user, I want discover strips: this week's leaderboard (resets Monday; workouts + streak flame), trending workouts, people to back, trending open goals, so the network grows itself.
- **S-1005.** As a user, I want people search, public profiles (stats gated by their privacy, heatmap, achievements, goals, shared routines, posts), back/request flows for private accounts, so finding friends is easy and safe.
- **S-1006.** As a user, I want a notifications inbox (new backer, back request/accepted, cheer, comment, repost, workout tried, shared-goal invites & milestones) with mark-all-read and deep links, plus a tab-bar badge, so I never miss support.
- **S-1007.** As a user, I want block (severs both ways), report, and blocked-list management, so I feel safe.
- **S-1008.** As a private user, I want a private-account toggle and per-post audience (public/backers), so I control my exposure.
- **S-1009.** As a user looking for company, I want to browse/search **all open shared goals** (not just a trending strip), so I can find a group for my exact ambition.

## Epic 11 — Profile, journey, history, routines (progress hub)

Goal: identity + proof of progress; everything Home deliberately doesn't show.

- **S-1101.** As a user, I want a profile hub: avatar, name/@handle, stats (total workouts, minutes this month, week streak), current focus, activity heatmap, journey preview, recent workouts, routines, posts, so my whole story is one scroll.
  - AC: uniform card sizes; no text clipping — fit the longest entry.
- **S-1102.** As a user, I want the heatmap to swipe across months (24 back) and switch metric (minutes/distance/volume/sessions) with day-detail on tap, so consistency is visible and explorable.
- **S-1103.** As a user, I want a weekly streak built on *my* weekly goal (1–7 workouts/week, editable in a streak sheet), so streaks forgive life instead of punishing a rest day.
- **S-1104.** As a user, I want a Journey screen: achievements timeline with category filters (consistency, performance, exploration, goals, together, recovery), so milestones feel collected.
  - AC: ~15 deterministic achievements today (first workout, 10/50/100 workouts, 4/12-week streaks, hour session, 5000kg day, 10k distance, 3 modalities, custom builder, goal reached, joined shared goal, first share, comeback, recovery session). Recovery badges are private-only. Design the empty/locked states.
- **S-1105.** As a user, I want personal records per exercise (weight/reps/duration/distance, unit-aware) with history, so PRs are provable.
- **S-1106.** As a user, I want past workouts grouped by day with aggregate stats, opening the same recap view, including discarded ones, so history is honest.
- **S-1107.** As a user, I want saved routines: rename, delete, share-publicly toggle, one-tap start (no check-in), so favorites stay one tap away.

## Epic 12 — Health context: flare-ups, cycle, desk & breather

Goal: the features that make Sody *Sody* — the body-sound layer nobody else has.

- **S-1201.** As a chronic-pain user, I want a private health context: injuries, conditions, medications, lifestyle, plus my AI profile answers, all editable, so the coach's memory of my body is correctable.
- **S-1202.** As a user in a flare-up, I want flare-up mode: toggle + affected regions (neck, shoulders, upper/lower back, hips, knees, ankles, wrists), so every generated session eases off those areas until I turn it off.
  - AC: state visible wherever sessions are generated; one-line explanation of what the coach changed.
- **S-1203.** As a cycle-tracking user, I want to log period start (with day-offset and flow), see my current phase with a coaching tagline, and history, so training respects my cycle — privately.
- **S-1204.** As a desk worker, I want the posture survey (work position, desk hours, trouble spots) editable later in training setup, so desk suggestions stay accurate.
- **S-1205.** As a stressed user, I want a breather: box breathing with animated guide, 1/2/3-minute options, and logged active minutes, so calm counts as movement.
- **S-1206.** As a user, I want training setup: home equipment inventory (with photo/camera recognition), saved places (home/gym geofences), weekly rhythm (which days I'm where), so context never needs re-entering.
- **S-1207.** As a user, I want an **AI-generated summary of my current physical state** (on Profile or in health context) that I can talk back to — confirm, correct wrong assumptions, report a new status (flare-up, recovery, new injury) — so the coach's picture of my body stays accurate and I can see what it "thinks" of me.
  - AC: summary states what the coach currently believes (conditions, sensitive regions, trends); every item correctable; a free-text "update the coach" entry point; changes reflected in the next generated session.

## Epic 13 — Settings, privacy, notifications, account

Goal: grouped, boring-in-a-good-way settings — opened only from the Profile gear.

- **S-1301.** As a user, I want a grouped settings index: You & coaching / Training / Social & privacy / App / Data & AI / Account, so everything is findable.
- **S-1302.** As a user, I want privacy toggles per public-profile section (weekly activity, heatmap, achievements, goal progress, shared routines) and a default post audience, with a "preview my public profile" link, so I see exactly what others see.
  - AC: weekly-activity OFF also hides my streak everywhere public (profile flame, search, feed cards).
- **S-1303.** As a user, I want notification category toggles (backers, reactions, shared goals) that govern both inbox and push, so noise is controllable.
- **S-1304.** As a user, I want app preferences: theme (system/light/dark), units (metric/imperial), reduce motion, and a text-size deep-link to OS settings, so the app fits me.
- **S-1305.** As a user, I want data controls: export my data (JSON), clear coach memory, reset recommendations, temporarily deactivate (hides public profile until next sign-in), so I own my data.
- **S-1306.** As a user, I want sign-out (data preserved) and a confirmation-gated delete-account that wipes only my records, so leaving is safe and honest.

## Epic 14 — AI coach surfaces & trust

Goal: one coherent "coach" personality across its 13 surfaces — currently it appears in different shapes everywhere. Unify it.

- **S-1401.** As a user, I want the coach to be one recognizable presence (voice, visual identity, entry points) whether it's generating a plan, adapting a session, commenting mid-workout, writing my recap note, summarizing my week, or chatting about an exercise, so I build a relationship with *one* coach.
- **S-1402.** As a user, I want generation states designed everywhere the AI thinks (plan streaming, insights building, adapt running, ~10–30s latencies), so waiting feels like the coach working, not the app hanging.
- **S-1403.** As a user, I want the coach to always explain *why* (one-line reasoning strips: check-in echo, adaptation reason, recommendation reason), so trust compounds.
- **S-1404.** As a skeptical user, I want research citations reachable from plans, so claims are checkable (Semantic Scholar-backed today).
- **S-1405.** As a user, I want AI failures to degrade gracefully (deterministic fallback plans, retry affordances, never a dead end), so the coach never ghosts me.

## Epic 15 — Design-ahead (validated ideas from the team, not built yet)

Design these so the system has room; they're V-next but should not require a redesign later.

- **S-1501. Planned sessions calendar (social).** As a user, I want to plan a future session (title, type, time, duration, location, note) on a calendar, visible to my backers, so friends can tap **"I'm in"** and join me — with a who's-going list. (Lyane prototyped this; see reference images.)
- **S-1502. Predicted soreness.** As a user, I want check-in to *predict* likely-sore regions from my recent sessions ("Quads — maybe sore? From Tuesday's leg day") with confirm/dismiss, so check-ins get smarter over time.
- **S-1503. Weather-aware coaching.** As an outdoor user, I want opt-in weather awareness ("92°F in Dubai — we'll keep cardio lighter"), so plans respect conditions.
- **S-1504. Live group session.** As a gym buddy, I want to do the same workout with friends in real time — see each other's sets/weights, or one person logs for everyone — so training together works in-app.
- **S-1505. Gym partner matching ("gym tinder").** As a solo user, I want to discover compatible workout partners nearby, so the gym gets less lonely. (Early concept — explore what safe matching looks like.)
- **S-1506. Spotify integration.** As a user, I want my session's soundtrack attached to shared workouts (and maybe in-session controls), so posts carry vibe. (Connections panel: Spotify, Apple Health, wearables, Strava.)
- **S-1507. AI-populated targets.** As a user, I want the coach to pre-fill kg/reps/rest and set types (warm-up/drop) per exercise — seeded from height/weight at first, then from my history — so I never start from blank fields.
- **S-1508. Community events.** As a user, I want local sport suggestions (padel/tennis courts, community events by country), so Sody pushes me into the real world.
- **S-1509. Per-person post visibility.** As a user, I want custom audiences (choose exactly who sees a post), beyond public/backers.
- **S-1510. Wearable & health-app data.** As a user, I want Apple Health / Health Connect / watch data to flow into "everything counts" (the data model is already reserved for this).
- **S-1511. Rep-matched exercise animations.** As a user, I want the exercise demo to reflect my prescription (10 push-ups → the animation performs 10 push-ups, timed movements animate for their duration), so form guidance doubles as a pacing guide.

---

## Cross-cutting acceptance criteria (apply to every epic)

1. Light + dark variants for every screen.
2. Loading (skeleton-first), empty, error, and offline states for every screen.
3. All list surfaces paginate gracefully (feed, history, comments, notifications).
4. Haptics on primary confirmations; all animations respect reduce-motion.
5. No health data (conditions, meds, pain, cycle, coach memory, recovery badges) on any public surface, ever.
6. Streak hidden on all public surfaces when weekly-activity privacy is off.
7. Units follow the metric/imperial setting on every stat display.
8. Every AI wait ≥2s has a designed in-progress state; every AI failure has a designed recovery.

## What's explicitly out of scope for Irene

- Backend/data model changes (we adapt the backend to your designs afterward — flag anything you need).
- Marketing site / app-store assets (later, on top of your system).
- The BKOINZ list on the Trello board (social-media marketing ops, unrelated).

## Working agreement & where things live

- **This doc:** `docs/design/irene/sody-user-stories.md` (versioned in git; we PR edits).
- **Brief presentation:** `docs/design/irene/sody-design-brief.html` (open in any browser).
- **Trello:** list **"user stories irene"** mirrors these epics as cards — comment/annotate there; we'll sync decisions back into this doc.
- **Old-design screenshots** (context only, in `docs/design/irene/assets/research/` and on the Trello cards): they show what exists, not what we want.
- Cadence suggestion: design epics in this order — 1 (system) → 3/4/5/6/7 (core loop) → 8 → 10/11 → 2 → 12/13 → 14 → 15. Ship us flows epic-by-epic; we review against the ACs above.
