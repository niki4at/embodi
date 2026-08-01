# Embodi — comprehensive feature inventory for UI/UX redesign

> Companion reference to `sody-user-stories.md`: this is the exhaustive, codebase-derived inventory of every screen, interaction, and state in the current app. Use it when a user story needs more behavioral detail.

**Product in one line:** Embodi is a mobile (Expo/React Native) fitness app where **goals** are the unit of intent. Each goal gets an AI multi-week program and **exactly one workout queued ahead**. Home leads with that next workout; Social is a backing/feed network; Profile is the progress hub. Auth is Clerk; backend is Convex; AI runs through OpenAI on Convex.

**Tab bar (floating):** Social · Home · Goals · Profile  
Tab bar is **hidden** during login/onboarding/account-completion.

**Typography:** Sora + Plus Jakarta Sans. Full light/dark theming.

---

## 0. App map (all routes)

| Route | Presentation | Purpose |
|---|---|---|
| `/(tabs)/index` | Tab | Home (also hosts login + onboarding) |
| `/(tabs)/social` | Tab | Feed + discover |
| `/(tabs)/goals` | Tab | Goal list |
| `/(tabs)/profile` | Tab | Progress hub |
| `/checkin` | Full-screen modal | Daily check-in → AI session |
| `/session/ready` | Push | Review AI plan before start |
| `/session` | Push | Live workout |
| `/session/recap` | Push | Post-workout summary |
| `/adjust-today` | Modal | Lightweight check-in for queued goal workout |
| `/breather` | Push from bottom | Box breathing |
| `/build-workout` | Push | Custom session builder |
| `/goal/new` | Push | Create goal |
| `/goal/[id]` | Push | Goal detail |
| `/join/[code]` | Modal-style | Join shared goal by invite |
| `/settings` | Modal | Settings index |
| `/health-context` | Push | Private health/coach memory editor |
| `/notification-settings` | Push | Notification categories |
| `/privacy-settings` | Push | Public visibility + post audience |
| `/training-setup` | Push | Equipment, places, rhythm, work style |
| `/history` | Push | Past workouts |
| `/journey` | Push | Achievements + PRs + heatmap |
| `/cycle` | Modal | Menstrual cycle log |
| `/routines` | Push | Saved routines |
| `/exercise/[id]` | Card from bottom | Exercise detail + coach chat |
| `/profile-questions` | Full-screen modal | AI profile Q&A |
| `/social/search` | Push | People search |
| `/social/notifications` | Push | Inbox |
| `/social/share` | Modal | Share workout composer |
| `/social/edit-profile` | Modal | Public profile edit |
| `/social/blocked` | Push | Blocked users |
| `/post/[id]` | Push | Post detail |
| `/post/[id]/comments` | Push | Comments thread |
| `/u/[username]` | Push | Public profile |
| `/sso-callback` | — | OAuth return |
| `/modal` | Modal | Template leftover |

**Global overlays (always mounted):** Rest timer pill + full overlay; social bootstrap (profile ensure / push token).

---

## 1. Auth & first-run

### 1.1 Welcome / Login (`components/login-screen.tsx`, shown on Home tab when signed out)

**Modes:** `welcome` → `sign-in` | `sign-up` → `verify` (email OTP).

**Interactions:**
- Welcome → create account / sign in
- Email + password; show/hide password
- SSO: **Apple, Google, Facebook**
- Sign-up email verification code entry
- Switch between sign-in / sign-up
- Back to welcome

**States:** idle, loading (“Signing you in” / “Creating account”), authenticating splash, field validation alerts.

**Exit:** Signed-in → onboarding gate or Home.

### 1.2 Onboarding (4 steps, same Home route; tab bar hidden)

Progress bar `N of 4`, Skip, Back (from step 2+).

| Step | Title | Inputs |
|---|---|---|
| 1 | Tell us about yourself | Name, handle (username), age, gender (Male / Female / Prefer not to say) |
| 2 | Your first goal | Goal category chips (all 7), optional target, activity level (5), time per session multi-select (15–90+) |
| 3 | Your health context | Injury chips, condition chips, medications free text; privacy banner |
| 4 | Almost there | Smoking, alcohol; menstrual cycle toggle **if gender = female** |

**On complete:** Saves onboarding; creates first **personal goal** from category/target; claims username; then Home.

**States:** Incomplete fields can still Continue (mostly optional after basics); Skip advances without filling.

### 1.3 Profile questions (`/profile-questions`)

AI-generated personalized Q&A (slider / single / multi / text). Status: generating → ready → completed / failed. Feeds extended coach profile. Opened from profile-completion banner (when present).

---

## 2. Home tab — `/(tabs)/index` → `HomeContent`

**Entry:** Default tab after onboarding.  
**Purpose:** Action-focused; next goal workout first.

### Data shown
- Time-based greeting + first name
- Optional cycle phase chip (if tracking on) → opens `/cycle`
- **Today card** (when an open/generating/ready/in-progress/orphan check-in session outranks Next Up)
- **Next up hero** (primary): goal pill, workout title, duration/moves/modality, exercise chips, “new to you” banner
- **Other goals** horizontal row
- **Quick actions:** Log my own → `/build-workout`; Take a breather → `/breather`
- **Today’s context** summary (training environment suggestion / editor)
- **Desk section** (Mon–Fri 09:00–18:00 local only)
- **This Week** weekly insights board
- Optional flare-up mode card (in health/context surfaces)
- Completed-today summary when sessions already finished

### Today card states
| State | UI / actions |
|---|---|
| `loading` | Skeletons / spinner |
| `needs-checkin` | Start path → full check-in (or “Ask the coach”) |
| `checkin-orphan` | Check-in exists, no session built → resume/start from today’s check-in |
| `generating` | Coach building plan |
| `ready` | Open ready screen |
| `in-progress` | Resume session |
| `completed` | Small completed summary; can start another (reuse check-in or fresh) |

### Next up hero interactions
- Tap goal pill → `/goal/[id]`
- **Start** → start planned session → `/session`
- **Adjust for today** → `/adjust-today?sessionId=`
- `generating`: skeleton + “coach is planning”
- `failed`: tap to open goal / retry messaging

### Other goals row
- Chips for non-hero goals → goal detail or start that goal’s queue

### Desk section
- One-time **posture survey** (work position, desk hours, trouble spots) or skip/dismiss
- Up to 3 short templates matched to trouble spots (2–5 min); chair templates filtered out for standing/on-feet
- Tap → creates custom session → `/session` (skips check-in)

### Weekly insights (“This Week”)
- Headline, 4 personalized stat cards (value/unit/icon/trend/story)
- Aligned recommendations + exploration recommendations (title, duration, moves, modality, badge, tags, reasoning; optional `goalId`)
- Tap recommendation: if `goalId` → start that goal’s queued workout / open goal; else → check-in with recommendation seed
- Thumbs up/down feedback (+ optional comment)
- States: generating, ready, failed, cold-start regenerate, empty

### Navigation out
`/checkin`, `/adjust-today`, `/session`, `/session/ready`, `/goal/[id]`, `/build-workout`, `/breather`, `/cycle`, `/routines`, `/training-setup` (via context).

**Explicitly not on Home:** settings gear, theme toggle, streak dashboard, routines management, history lists, profile-completion prompts.

---

## 3. Goals tab — `/(tabs)/goals`

### Interactions
- **New goal** pill → `/goal/new`
- **Start a shared goal** → `/goal/new?shared=1`
- **Join with code** → modal code entry → join → detail
- Goal cards: open detail; **Log** opens progress sheet (value + optional note)
- Sections: IN PROGRESS, DONE, ARCHIVED (collapsible toggle)
- Empty: category example chips → create

### Data on card
Title, category tint/icon, progress caption (cumulative vs reading), percent, shared avatar stack, next-workout status, sparkline-ish progress.

### States
Loading skeletons; empty; active/completed/archived/generating/failed (failed surfaced on detail).

---

## 4. Goal create — `/goal/new`

**Fields:**
- Category (7): Endurance, Lose weight, Gain weight, Get stronger, Build a habit, Train for an event, Something else
- Event presets (marathon, half, 10K, Ironman, Hyrox) when category = event
- Title, description
- Start value (required for reading metrics: weight/lift)
- Target value + unit
- Direction: Increase / Decrease / Maintain
- Deadline: 4 / 8 / 12 / 16 weeks / none
- Shared toggle; if shared → visibility invite-only vs open to anyone

**Submit:** Creates goal (status `generating` program) → `/goal/[id]`.  
**States:** Submitting spinner; validation disables Create until title + target (+ start if reading).

---

## 5. Goal detail — `/goal/[id]`

### Data
- Header: title, category, status badges (generating / failed / completed / archived)
- Progress % + sparkline of logs
- Target caption; personal target
- Program timeline (weeks: focus, summary, target)
- Next workout card (generating / ready / failed) with Start / Adjust
- Members board (shared): avatars, progress, sessions count, cheer reactions on member sessions
- Activity events: joined, workout_done, milestone, reaction
- Progress log list

### Interactions
- Back
- Menu (owner): Set target, Archive; Delete (solo) or Leave (member/shared)
- Unarchive restore when archived
- Log progress sheet
- Share invite (native Share with invite code / deep link)
- Join (if open/invite preview path)
- React to member session (emoji)
- Retry program / ensure next workout when failed/generating stuck
- Start / Adjust for today on next workout

### States
Loading spinner; not available; generating program; failed with retry; completed; archived.

---

## 6. Join by code — `/join/[code]`

Preview: title, category, member count, days to go.  
Actions: Join → detail; Close.  
States: loading; invite not found; already-member open; joining busy + error alert.

---

## 7. Adjust for today — `/adjust-today`

Lightweight check-in for **queued goal workouts** (not full check-in).

**Inputs:** Energy 1–10; Pain 0–10; body areas if pain > 0; time 15/30/45/60.  
**CTA:** Adjust and start → AI `adaptPlanForToday` (may drop/reorder/retune sets, **never invents exercises**; deterministic fallback) → start planned → `/session` with adapt note.  
**Exit:** X → back. Error alert with message.

---

## 8. Full check-in — `/checkin` (4 steps)

Triggered from Home “Ask the coach”, weekly recs without goalId, orphan recovery, etc. Can receive recommendation seed + training context params.

| Step | Content | Required to proceed |
|---|---|---|
| 0 | Energy slider 1–10; Sleep (rough/okay/decent/great) | Sleep |
| 1 | Pain body map (tap region → rate 0–10); Stress 1–5 | Always |
| 2 | Workout type (strength/mobility/cardio/recovery/mixed); optional multi focus areas (full/upper/lower/chest/back/shoulders/arms/core/legs/glutes); Intensity (easy/moderate/push me) | Type + intensity |
| 3 | Time (15/30/45/60); training context summary (Home/Gym/Outdoors/Travel + equipment intent); confirm if low confidence; optional notes; home empty inventory alert → Training setup | Time + confirmed context |

**Location/equipment suggestion sources:** manual, place geofence, workout_need, weekly_rhythm, history, fallback. Inferred suggestions marked with subtle icon (not “likely” text).

**Submit:** Creates check-in + starts AI session generation → `/session/ready`.  
**Strength/hybrid:** preselects Home/Gym suggestion; home equipment soft-constrains coach; location skipped for runs/walks/mobility/recovery.

---

## 9. Session ready — `/session/ready`

**For:** Coach-generated plans (custom sessions skip this).

**Shown:** Plan grouped by phases (warmup / main / cooldown etc.), exercise cards, citations button, reorder by hold-and-drag, tap exercise preview, remove/replace via menu, health facts/citations panel.

**CTA:** Start → `/session`.  
**Back / discard paths** available. Generating continues if plan still streaming (exercises appear as ready).

---

## 10. Live session — `/session`

### Header / chrome
- Workout timer (wall-clock from `startedAt`)
- Sets counter (global, not per-exercise 0/N)
- Overflow menu: citations, discard workout
- Add exercise
- Movement journey bar (phase progress; shows/hides on scroll)

### Exercise list
- Coach sessions: phase groups; custom: flat list
- **Drag-and-hold reorder** (minimal style: no borders/circles on handle)
- Tap row → exercise preview / focus (`/exercise/[id]` keeps rest pill visible)
- Per-exercise **⋯ menu:** remove, replace (library pick or tell trainer what to substitute), skip (soft-skip collapses card), set rest duration
- **Notes** button beside exercise name (no per-set expandable dropdowns)
- Coach comment bubbles above Complete (triggered by events; prefetched)

### Set logging (`ExerciseTable`)
Tracking metrics: `weight_reps` | `duration` | `distance` | `breath` | `custom`.

Per set:
- Inputs: SEC/KG/REPS/RPE/PREVIOUS/SET columns; flat (no boxes); centered headers & cursor; no placeholder dash
- RPE to the right of reps
- Set types: warmup / normal / failure / drop (popover)
- **Tick** completes set → whole card fills green with snappy animation; free untick
- While ticked: swipe add/delete hidden
- **Swipe right:** clone set (sec/kg/RPE) into new unchecked row
- **Swipe left:** delete that row (blocked if last remaining set)
- Green/red backdrop behind card; vertical scroll still works; horizontal swipe wins over inputs
- Inputs enter edit mode on single tap only
- Previous values shown from history when available
- Rest timer **auto-starts** after completed set (per-exercise restSec)

### Rest timer (global)
- Full overlay + **draggable minimizable pill**
- Add time / skip / minimize / expand
- Chime (`rest_done.wav`) + haptics + push notification when backgrounded
- Modes: idle / running / finished (auto-dismiss ~5s)

### Complete / discard
- **Complete session** → `/session/recap` (completion mode)
- **Discard** confirm → history as discarded → Home

### States
Loading session; generating append; empty plan; completing busy; error toasts.

---

## 11. Recap — `/session/recap`

**Hero:** Workout complete / discarded; duration (actual); date · modality.

**Sections:**
- Training context summary + link to update equipment
- **Goal attribution** row (attribute any session to a goal)
- Stat tiles (up to 4): sets, volume kg, reps, avg RPE, distance, exercises
- Highlights (PRs / first-times)
- AI coach note (streams in; soft-fail hide)
- Exercise breakdown by phase with logged sets
- Save as routine (name modal)
- Share workout → `/social/share`
- Done → Home

**From history:** same screen as read-only-ish review (back instead of Done replace).

---

## 12. Build your own — `/build-workout`

**Step A — Pick:** Exercise library (search, category vs body map, custom exercises, scan equipment camera recognition, multi-select).  
**Step B — Arrange:** Drag reorder; edit sets/reps/rest; auto-suggest goal from modalities; last-targets prefill.  
**Start:** `createCustomSession` → `/session` (skips check-in & ready; `source: 'custom'`).

Same library powers in-session add/replace.

---

## 13. Breather — `/breather`

Box breathing: In / Hold / Out / Hold (4s each). Duration chips 1/2/3 min. Animated circle. Start / Stop early / Done. Logs active minutes via `activity.logActiveMinutes`. No AI.

---

## 14. Social tab — `/(tabs)/social`

### Header
Search → `/social/search`; Notifications → `/social/notifications` (unread badge).

### Strips (conditional)
1. **This week’s leaderboard** (horizontal): rank, avatar, workouts this week, streak flame; tap → profile (not self). Hidden if &lt;2 entries. Resets Monday.
2. **Trending this week:** most-tried public workouts; tap → post.
3. **Discover — People to back:** suggested profiles; Back CTA; tap → profile.
4. **Discover — Trending goals:** open shared goals; tap → join/detail.

### Feed
Paginated posts (`PostCard`):
- Author avatar/name → profile
- Workout snapshot card (duration, volume, reps, distance, RPE, body parts, highlights, optional training environment)
- Caption, photos (up to 5 on create)
- Reactions: cheer / fire / strong / clap (picker; toggle off)
- Comment → comments screen
- Repost with optional quote
- Overflow: report, block
- **Try this workout** → start session or save as routine (increments triedCount)

Empty/loading/load-more states.

### Related social screens
| Screen | Capabilities |
|---|---|
| `/social/search` | People search; results show streak only if their `publicActivity` on |
| `/social/notifications` | Types below; mark all read; tap deep-links |
| `/social/share` | Title, caption, photos (camera/library, max 5), visibility public/backers, share training environment toggle, live preview, Post |
| `/social/edit-profile` | Avatar upload, display name, username, bio, private account toggle |
| `/social/blocked` | List + unblock |
| `/post/[id]` | Full post + try workout sheet |
| `/post/[id]/comments` | List/add/delete own comments |
| `/u/[username]` | Public profile: stats (gated), heatmap, achievements, goals, shared routines, posts; Back / Request / Accept; block/report |

**Social graph term:** “Back” (follow). Private accounts → pending requests.

**Notification types:** `new_backer`, `back_request`, `back_accepted`, `cheer`, `comment`, `repost`, `workout_tried`, `community_invite`, `community_milestone` (UI: Shared goals).

---

## 15. Profile tab — `/(tabs)/profile`

### Sections
1. **Header** — avatar, name, @handle, gear → `/settings`, “view as others”
2. **Stats row** — total workouts, min this month, week streak (tap → streak sheet)
3. **Current focus** — active goal / weekly goal progress
4. **Activity heatmap** — swipe months (24 back); metrics: Minutes / Distance / Volume / Sessions; tap day detail; units from settings
5. **Journey preview** → `/journey`
6. **Recent workouts** → `/history`
7. **Routines preview** → `/routines`
8. **Posts preview** → public profile

### Streak sheet
Weekly goal (1–7 workouts/week), current/longest streak, this week progress, set goal.

Loading: spinner. Empty hints per section.

---

## 16. Journey — `/journey`

- Full heatmap (same component)
- **Personal records** list (weight/reps/duration/distance; unit-aware)
- **Achievements** timeline with filters: All, Consistency, Performance, Exploration, Goals, Together, Recovery
- Recovery badges labeled private

### Achievement catalog (deterministic)

| Key | Title | Category |
|---|---|---|
| first_workout | First movement | consistency |
| workouts_10 / 50 / 100 | Ten / Fifty / Century | consistency |
| streak_4 / streak_12 | One month / Season | consistency |
| hour_session | The long haul | performance |
| volume_5000 | Heavy day | performance |
| distance_10k | Double digits | performance |
| modalities_3 | Well rounded | exploration |
| custom_builder | Your own blueprint | exploration |
| challenge_complete | Goal reached | challenges→Goals |
| community_join | Better together | community→Together |
| first_share | Out loud | community |
| comeback | The comeback | recovery (private) |
| recovery_session | Rest is training | recovery (private) |

---

## 17. History — `/history`

Aggregate stats + paginated list grouped by day (Today/Yesterday/date).  
Each row: title, modality, duration, sets, environment, completed vs discarded.  
Tap → recap. Load more. Empty state.

---

## 18. Routines — `/routines`

List saved routines; rename; delete; share toggle (`isShared`, gated by `publicRoutines`); start (skips check-in, `source: custom`). Profile shows shared routines when privacy allows.

---

## 19. Exercise detail — `/exercise/[id]`

GIF/media (WorkoutX-synced), instructions, secondary muscles, difficulty.  
My records grid; recent history (last ~8).  
**Chat with coach** (exercise-scoped thread).  
Add to workout (when in builder/session context).  
Session focus mode for logging from detail.

---

## 20. Settings hub — `/settings` (modal from Profile gear)

### Profile card → edit profile

**You & coaching**
- Health & coaching → `/health-context`
- Cycle tracking toggle (female / prefer-not-to-say only) + Open cycle log

**Training**
- Training setup
- Past workouts

**Social & privacy**
- Edit profile, Privacy, Notifications, Blocked people

**App**
- Theme: System / Light / Dark
- Units: Metric / Imperial
- Reduce motion
- Text size: deep-link to OS accessibility settings (no in-app scale)

**Data & AI** (`DataSection`)
- Export data (JSON share sheet)
- Clear coach memory
- Reset recommendations
- Temporarily deactivate (hides public profile; reactivates on sign-in)

**Account**
- Log out (data kept)
- Delete account (confirmation; wipes only this user’s Convex data + Clerk user)

---

## 21. Health context — `/health-context`

Private: injuries, conditions, medications, smoking, alcohol, AI profile answers by category (goals/lifestyle/training/recovery/nutrition/health), AI summary flags.  
Edit via modal; delete answers. **Never shown on public profile.**

Also: flare-up mode (toggle + region multi-select: neck, shoulders, upper/lower back, hips, knees, ankles, wrists) — trainer eases off flagged regions.

---

## 22. Privacy — `/privacy-settings`

Section toggles: Weekly activity (also hides streak on public surfaces when off), Heatmap, Achievements, Goal progress, Shared routines.  
Default post audience: Public / Backers / Private (maps private→backers for posts).  
Preview public profile link. Health/coach/cycle always private.

---

## 23. Notifications settings — `/notification-settings`

Toggles: Backers; Reactions; Shared goals. Applies to inbox + push.  
Footnote: workout reminders & rest-timer sounds = device settings.

---

## 24. Training setup — `/training-setup`

| Section | What user does |
|---|---|
| Equipment | CRUD home inventory; photo; capabilities; archive; camera inventory recognition |
| Places | Save Home/Gym geofences (encrypted coords); radius; enable location |
| Weekly rhythm | Per weekday morning/evening environment + equipment intent |
| Work style | Position, desk hours, trouble spots (feeds desk templates) |
| Suggestions | Preview how context scoring would pick today’s setup; sharing defaults |

---

## 25. Cycle — `/cycle`

Eligible via onboarding/settings.  
Shows current phase + coaching tagline (menstrual / follicular / ovulatory / luteal / unknown).  
Log period start (day offset 0–7 ago, flow light/medium/heavy); mark ended; delete entries; history list.  
Phase feeds trainer prompt when enabled.

---

## 26. Cross-cutting features (designer checklist)

### Theme & motion
- System / Light / Dark; dark header icons match settings icon treatment
- Reduce motion preference
- Haptics on most primary actions
- Floating tab bar with safe insets

### Streaks
- Weekly (not daily): hit personal weekly workout goal → streak week increments
- Flame on profile, leaderboard, public profiles (if `publicActivity`)
- Cron finalizes lapsed streaks

### AI coach surfaces
1. Goal program generation (multi-week outline)
2. Next goal workout generation (one ahead; shared goals use blueprint then personal adapt)
3. Full check-in session generation (+ streaming exercises)
4. Adapt for today
5. Exercise alternatives / “tell trainer what to substitute”
6. Prefetched in-session coach comments
7. Exercise coach chat (multi-turn)
8. Weekly insights + regen after workouts / weekly batch
9. Session recap note
10. Profile questions + extended summary
11. Citations search (evidence panel on sessions)
12. Exercise / inventory recognition from camera (OpenAI vision)
13. Equipment soft-constraints from inventory

### Session entry matrix (important product rules)

| Entry | Check-in? |
|---|---|
| Ask the coach / weekly rec (no goal) | Full check-in |
| Goal queued Start | Direct start |
| Goal Adjust for today | Lightweight adjust |
| Own routine / visitor Try routine | Skip (deliberate repeat) |
| Build your own / desk / breather | Skip |

### Exercise library
- **~123 catalog exercises** via `ex(...)` entries
- Groups: chest, back, shoulders, arms, core, glutes, legs, fullBody, cardio, mobility, recovery
- Modalities: strength, mobility, cardio, recovery
- User custom exercises; body-part selector; search; scan-equipment flow
- Media GIFs cached from WorkoutX

### Desk templates (6)
Seated shoulder release, Standing reset, Wrist/neck unwind, Lower back relief, Two-minute calm, On-your-feet relief. Trouble spots: neck, shoulders, lower_back, wrists, hips, eyes.

### Goal categories & metrics
See `constants/goal-meta.ts`: distance/body_weight/frequency/duration/custom; accumulation cumulative vs reading; event presets with week targets.

### Shared goals / invites
- `isShared`, `inviteCode`, visibility invite|open
- Members board, reactions, milestones at 25/50/75/100%, notifications
- Shared blueprint advances for the group; each member gets adapted plan

### Social feed mechanics
- Workout posts snapshot stats at share time (no live join)
- Reposts with quote
- Cheer kinds with denormalized counts
- Try workout → session or routine + trending
- Blocks sever follows both ways; reports (App Store)

### Units
Metric/imperial for distance/weight displays (heatmap, PRs, journey). Logging still largely kg/m internally.

### Activity samples (future-ready)
`activity_samples` for manual/session/healthkit/health_connect/watch; breather writes manual active minutes today.

### Coming soon / placeholders
Settings “coming soon” cards if present; Spotify tracks field on posts reserved; wearable ingest reserved.

---

## 27. Backend capability index (by domain)

| Domain | Key APIs / tables |
|---|---|
| Goals | `goals.*` — CRUD, join, progress, program AI, next workout, attribute session, reactions |
| Trainer | Sessions lifecycle, plan gen, adapt, set logging, reorder/replace/skip, complete/discard |
| Check-in | `daily_checkins`, create + start session |
| Routines | Save/start/rename/delete/share |
| Social | Posts, reactions, comments, try, leaderboard, trending, discover |
| Profiles | Username, avatar, back/block/report, private accounts |
| Achievements | Deterministic rules post-completion |
| Streaks | Weekly goal + streak weeks |
| Weekly insights | Generate, feedback, batch cron |
| Coach chat | Exercise threads |
| Cycle | Entries + phase computation |
| Activity | Active minutes |
| Equipment / places / context | Inventory, encrypted places, suggestion scorer |
| User settings | Notify categories, units, public sections |
| Account | Export, purge, deactivate, clear memory |
| Exercise stats | History, PRs, last targets |
| Session insights | Recap stats + AI note |
| Flare-up | Persistent region easing |
| Notifications | Inbox + push tokens |
| Citations | Semantic Scholar-backed search |
| Exercise media / recognition | GIF sync, vision ID |

---

## 28. Suggested user-story epics (for designer → PM)

1. Auth & onboarding (identity + first goal + health)
2. Home Next Up & today’s session states
3. Goals lifecycle (solo + shared + invites + logging)
4. Check-in vs Adjust-for-today vs skip paths
5. Live session (sets, swipes, rest, reorder, coach)
6. Recap → save routine → share
7. Social graph, feed, try-workout, discover
8. Profile / journey / heatmap / streaks / achievements
9. Privacy, notifications, units, theme, account safety
10. Training setup, desk breaks, cycle, flare-up, health context
11. Exercise library + custom + coach chat + recognition

---

## 29. Design-system notes from current product

- Floating tab bar; Home is action stack not dashboard dump
- Cards used for interactive units (Next Up, goals, posts); avoid inventing more chrome than needed
- Category color system from `goal-meta` tints
- Only intentional gradient in product: Breather CTA / circle
- Empty states are copy-led with one clear CTA
- Loading: skeletons on Home/Goals/Next Up; spinners on secondary screens
- Errors: Alert dialogs with recoverable actions (retry, start as planned, etc.)

This inventory is intentionally exhaustive so every current interaction can become a user story or acceptance criterion in a greenfield redesign.