# Bodfit redesign — summary

Branch: `cursor/bodfit-redesign-f72d`. Source of truth: Figma `nODLRMV0kddwStwQFgtYfk` (page `0:1`, 30 phone frames). Every frame was opened (screenshot + design context) before the matching screen was built.

## Brand

- **Name**: Embodi → **Bodfit** everywhere a user can read it (`app.json` display name, web manifest, permission strings, onboarding/login copy, coach system prompts, share text). Native bundle/package stay `com.nick4eto.embodi`. Deep-link scheme is `['embodi', 'bodfit']` (old scheme kept first so Clerk SSO redirects keep working). Public web host is a **new** EAS project so `embodi.expo.app` stays up: slug `bodfit`, project `7ed99813-393e-4cee-8352-4de136a72e22`, production URL `https://bodfit.expo.app`. The original project `b91a84ce-6d3f-46f8-9967-2ad6414cce74` still owns `embodi.expo.app`. Convex day-to-day stays `helpful-gopher-816`.
- **Logo**: `components/ui/bodfit-logo.tsx`. Mark = blue→lavender gradient tile with a geometric lowercase "b" (stem + ring + offset pulse dot). Wordmark `hero` (Sora ExtraBold "bod" + blue "fit") and `header` (tracked mono `BODFIT`, the lockup that sits top-right on every Figma frame). PNG assets regenerated from the same geometry via `pngjs` (SDF anti-aliasing): `icon.png`, `splash-icon.png`, `favicon.png`, Android adaptive foreground/background/monochrome. Template React logos removed.
- **Tokens** (`constants/design.ts`): white paper, near-black ink, `#4B9EFE` primary, `#C991F1` lavender partner, coach purple `#B751FF`, energy dot scale, pain scale (yellow→orange→red), hero gradient. Full dark palette. Sora for all text, DM Mono for eyebrow labels, Archivo Black for the Challenges masthead. Buttons are pill-shaped ink / gradient / hairline-outline.

## Screens (Figma frame → implementation)

| Frame(s) | Screen | File(s) |
| --- | --- | --- |
| `1:2`, `123:610` home | Masthead with the gradient Bodfit mark + BODFIT on the left and Today/This Week on the right (Figma's lone top-right wordmark read as stranded on phones), gradient greeting name, context line, cycle + flare-up chips, gradient **Start** orb with state copy, "Adjust for today", 2×2 context tiles, AI coach bubble, Your other goals, Suggested tonight card, Quick actions, At your desk | `components/home/*` |
| `136:1500`, `136:1918` adjust sheet | Bottom sheet: Full adjustment chip, Energy tiles, Pain chips + Edit on body map, 20/30/45 time, **Retune workout** | `components/home/adjust-sheet.tsx`, `convex/checkin.ts#retuneTodaysSession` |
| `101:12`, `103:109` step 1 | "Feeling great? Skip to workout" card, Sleep (4), Energy (5 with dots), Stress (3) | `components/checkin/CheckInScreen.tsx` |
| `103:150`, `103:359`, `124:1106` step 2 | Quick body chips, dashed "Adjust on body map", "Nothing today" | same |
| `125:1139`, `125:1184`, `125:1204`, `125:1250`, `125:1293` body map | Front/Back toggle, tap-the-spot dots, inline **How bad** 0–10 card with Remove, numbered colour badges, rated chips | `components/checkin/PainBodyMap.tsx` |
| `103:207`, `103:260` time | 10–60 min grid, ink selected | CheckInScreen (backend `timeAvailable` widened to accept 10/20/40/50) |
| `103:293`, `136:1843`, `103:392`, `136:2530` set up | Type (6), Focus chips, Intensity with RPE + sparkle suggestion, **Where** card (segmented Home/Gym/Outdoors/Travel with inferred sparkle, reason line, "Using what you have / Select the following", Edit for today), gradient **Build my session** | CheckInScreen |
| `137:2623` (thin frame: "Adjust again / Knee-friendly / COACH SAYS") | Covered by the ready list header + coach's advice bubble | `app/session/ready.tsx` |
| `103:427` building, `109:515` ready | Orb COACH IS PLANNING / READY + summary rows + See your session / Change an answer | `app/session/ready.tsx` (summary view) |
| `64:556` session | Gradient mono eyebrow, "Your session is ready", basis line, Coach's advice, phase eyebrows with minutes, hairline exercise rows, Start session / Swap a move or shorten it | `app/session/ready.tsx` (list view) |
| `95:777` live session | ← / pulsing timer / BODFIT bar, "Movement journey" + gradient progress + N / M SETS, phase status pills (DONE / IN PROGRESS / START), per-exercise DONE / NOW / NEXT UP, orange "now" border, gradient Complete session, **Something hurts** | `app/session/index.tsx`, `components/trainer/ExerciseTable.tsx` (chrome only) |
| `96:1170`, `96:1460` hurt | Sheet: area chips, Twinge / Sore / Stop now, "Coach will…" note, Accept and continue / Just note it. Accept persists the area to flare-up regions; Sore opens the replace sheet pre-prompted; Stop skips the exercise | `components/trainer/HurtSheet.tsx` |
| `123:551` finished | `WED · 6:40 PM` + BODFIT, orb DONE / 38 min, Session done, goal, stats, Energy/Body/Time/Set up rows | `app/session/recap.tsx` |
| `36:226` challenges | Built on the frame's coordinates: header 59, THE 88 / CHALLENGES 115 (25/27pt Archivo Black), subtitle 152 (Sora 11), tabs 199 (12pt, no underline) over a 0.5pt `#868686` rule at 218, challenge rows on a 130pt pitch (22pt %, 11pt title, 9pt line, 3pt `#D9D9D9` track, 9pt mono tag; 127pt with the Shared challenge pill), Create button 33pt below (330×34, r15, 80% gradient), GROUP CHALLENGES 45pt below, 29pt arrow rows, 57pt 1pt-gradient-ring FAB. Empty tabs keep the same row anatomy instead of chips. The FAB opens a sheet (works on web) | `app/(tabs)/challenges.tsx`, `components/social/together-section.tsx` |
| `40:362` challenge detail | Frame rhythm: back 59, 9pt eyebrow 95, 16pt title / 20pt % 109–134, track 141, 9pt line 148, 269pt NEXT UP card 21pt below (99×25 Start/Adjust), PROGRAM 28pt below, five-week window around the current week as 27pt nodes on a 44pt pitch with elbow curves + coach cheer, PROGRESS LOG card (r15, 1pt `#D9D9D9`), 96×25 Edit Target / Archive goal 30pt below | `app/challenge/[id].tsx` |

Auth, welcome, loading and onboarding have no Figma frames; they were restyled to the same system (Bodfit mark, segmented step bars, borderless inputs, ink/outline pills).

## Verify-pass fixes (Grok 4.7 review, round 1)

| # | Finding | Fix |
| --- | --- | --- |
| 1 | Backend not on `helpful-gopher-816` | **Still blocked from this VM**: no Convex credentials are available (`npx convex dev --once` against `dev:helpful-gopher-816` asks for an interactive login; the only secrets injected are Clerk, OpenAI, and `EXPO_TOKEN`). Add a **dev** deploy key for `helpful-gopher-816` as a Cloud Agent secret named `CONVEX_DEPLOY_KEY`, or run `npx convex dev --once` on this branch from a logged-in machine. Until then "Retune workout", per-spot pain badges, archived challenges, and the 10/20/40/50 time tiles fail on the staging preview. Never use a key for `valiant-salamander-348`. |
| 2 | Archived tab empty, no way back | `listChallenges` now returns archived goals; the Archived tab lists them (grey), detail shows **Restore goal** (`unarchiveChallenge`). |
| 3 | Where control not HOME / WORK / TRAVELLING | Three Figma segments. `WORK` maps to the backend `gym` environment and `TRAVELLING` to `travel`; `outdoors` is still reachable through "Edit for today". Sparkle marks the inferred segment, reason line, USING WHAT YOU HAVE / SELECT THE FOLLOWING, gear line, Edit for today unchanged. |
| 4 | Retune copy vs behaviour | **True in-place retune.** `retuneTodaysSession` edits the existing plan only: time ratio trims/extends sets, lower energy shortens reps and adds rest, pain areas skip moves that load them. No new moves. Sheet copy "The coach retunes your N planned moves. It won't add new ones." is now accurate; a completed session gets "Saved for today". |
| 5 | BODYFYT vs BODFIT | Kept **Bodfit** per product decision; Figma lockup lags. |
| 6 | Goal cards | **Queued / Planning** labels; line is `current week focus · N wk` (or "Coach is building"). |
| 7 | Frame 137:2623 | Implemented as the post-adjust session header: `← Adjust again` (reopens the sheet on Home), green mono `6 OF 7 MOVES · 45 mins`, modality eyebrow, retune title (e.g. "Shoulders-friendly"), **COACH SAYS** bubble with the retune note. Shown whenever a session carries `retune`. |
| 8 | Suggested tonight | Photo from the Figma frame (`assets/images/suggested-tonight.jpg`) with the exact gradient wave path (Vector 7) and a soft paper wash. |
| 9 | Chevron circle | Removed. "Add a move" stays (AGENTS.md: users add/replace exercises in the coach session); it is off-frame and intentional. |
| 10 | Phase pill | Phase holding the NOW exercise reads IN PROGRESS before the first tick. |
| 11 | Shared challenge chip | Communities the user belongs to render as rows in **In-progress** with `Shared challenge · N members`; Group challenges keeps only Join / Start (placeholder rows from 36:226 not copied). |
| 12 | Note for the coach | Removed from step 4. |
| 13 | Typeface | Eyebrows, counters and the BODFIT lockup now use **Intel One Mono** (Regular/Medium/Bold) as in the file; Sora stays for everything else (DM Mono dropped). |
| 14 | Font scaling | Header lockup and the ready/recap/home orb labels scale with OS text size (capped at 1.3–1.4× so the orb copy stays inside the circle). Only the hero logo wordmark stays fixed. |
| 15 | Pain badges | Check-in stores `painRatings` (area → 0–10); the adjust sheet shows one chip per spot with its own level. |
| 16 | Dark mode | Spot-checked home, check-in, live session, adjust sheet in dark (see PR screenshots). |

## Behaviour kept (AGENTS.md)

- Every workout entry goes through the daily check-in; recommendations, desk micro-sessions, "Take a breather" and challenge "Start" all seed the check-in.
- Location is asked only for strength/hybrid/cardio (not run, mobility, recovery); inferred suggestions are marked with a sparkle, no "likely" text.
- Home stays action-focused; weekly analytics live behind the "This Week" tab the Figma specifies; settings/theme stay on Profile.
- Tab bar hidden on login/onboarding (unchanged logic in `app/(tabs)/index.tsx`).
- Set table rules in `ExerciseTable` are untouched (only header chrome changed).

## Known gaps / judgement calls

- Retune is deterministic (sets/reps/rest/skips), not an AI pass; it never adds moves. If the energy or time change needs new exercises the user takes "Full adjustment".
- `WORK` maps to the backend `gym` environment; `outdoors` has no segment and lives behind "Edit for today".
- "Run" type is stored as `cardio` + focus tag `running` (no `run` literal in the schema).
- The finished-session frame shows three "9" boxes with no labels; not implemented since their meaning is undefined in the file. Session stats tiles (sets / exercises / PRs) sit in that slot instead.
- "Edit Target" on a challenge creates a new version (no edit mutation exists); it says so in a confirm dialog.
- `MovementJourneyBar` (floating phase strip) was removed in favour of the Figma inline progress bar.
- `#D9D9D9` filled context tiles from the file are rendered as a lighter `surface` tone for contrast.

## Verification

- `npx expo lint` clean, `npx tsc --noEmit` clean, `vitest` 50/50.
- Manual web walkthrough against an isolated anonymous Convex deployment: sign-in → home → full check-in (including body map rating) → "Coach is planning" → ready list → live session → "Something hurts" → complete → recap → challenges; light and dark mode.

## Public web host

- **https://bodfit.expo.app** is the Bodfit production alias (latest deployment `xpkv9ywkqs`, https://bodfit--xpkv9ywkqs.expo.app, script `entry-1bdaa1665b400526bddaf0c0a63d6908.js`, etag `84272880286662bb816f380fd5eb8cb1`, 2 Oct 2026 13:30 GMT, Challenges list and detail aligned to frames 36:226 / 40:362; first deployment was `rt40v0ux0n`). It belongs to a new EAS project, `@nick4eto/bodfit` (`7ed99813-393e-4cee-8352-4de136a72e22`), because an EAS Hosting preview subdomain cannot be renamed on the existing project. The preview subdomain `bodfit` was claimed on that project, then deployment `rt40v0ux0n` was promoted to production there only. Live HTML `last-modified` is Thu, 01 Oct 2026 06:52:32 GMT. The welcome screen shows the Bodfit mark and "Built around how you feel today."
- **https://embodi.expo.app** is unchanged. It stays on `@nick4eto/embodi` (`b91a84ce-6d3f-46f8-9967-2ad6414cce74`), still the old Embody welcome ("Understand your body."). Response etag `35d8310dca4449c9c86e29807bc63ab5`, `last-modified` Mon, 27 Jul 2026 19:41:14 GMT, same as before this deploy. Do not run `eas deploy` or `eas deploy --prod` against that project.
- The Bodfit web bundle is exported with `EXPO_PUBLIC_CONVEX_URL=https://helpful-gopher-816.convex.cloud` (and the matching `.convex.site` URL). It does not point at Convex prod `valiant-salamander-348`.
- Earlier preview on the old project: **https://embodi--eytcbs4u2e.expo.app** (no production promote). Leave it.
- **Raw schema dump after sign-in (fixed 2 Oct 2026).** `helpful-gopher-816` now runs this branch's backend, but Nick's `training_preferences` row still carries `workStyle` from his local desk-survey build. `trainingPreferences.get` spread the raw row into a strict `returns` validator, threw `ReturnsValidationError`, and `AppErrorBoundary` printed that message (document plus validator) on every signed-in screen. The client now reads preferences through `useTrainingPreferences` (falls back to defaults on a query error) and the boundary only shows raw errors in development; that part is live. The backend side (`get` projects fields explicitly, schema accepts `workStyle`, `saveWorkStyle` restored for the embodi build) still needs `npx convex dev --once` against `helpful-gopher-816` from a logged-in machine. That deployment also lacks Nick's `goals`, `activity`, and `trainer.adaptPlanForToday` functions, which the live embodi.expo.app bundle calls.
- Backend changes on this branch (`checkin.retuneTodaysSession`, `painRatings`, `session.retune`, `challenges.unarchiveChallenge`, archived rows in `listChallenges`, 10/20/40/50 `timeAvailable`) are **not yet pushed** to `helpful-gopher-816`: this VM has no Convex credentials (see verify-pass fix #1). The isolated anonymous deployment used for local testing has the full backend.

## Verify pass

A **Grok 4.7** verify pass will review this branch against the Figma frames and send findings back for fixes.
