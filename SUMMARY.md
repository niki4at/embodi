# Bodfit redesign — summary

Branch: `cursor/bodfit-redesign-f72d`. Source of truth: Figma `nODLRMV0kddwStwQFgtYfk` (page `0:1`, 30 phone frames). Every frame was opened (screenshot + design context) before the matching screen was built.

## Brand

- **Name**: Embodi → **Bodfit** everywhere a user can read it (`app.json` display name, web manifest, permission strings, onboarding/login copy, coach system prompts, share text). Infra IDs are untouched: bundle/package `com.nick4eto.embodi`, slug `embodi`, EAS project, Convex deployments, `embodi.expo.app` host. Deep-link scheme is now `['embodi', 'bodfit']` (old scheme kept first so Clerk SSO redirects keep working).
- **Logo**: `components/ui/bodfit-logo.tsx`. Mark = blue→lavender gradient tile with a geometric lowercase "b" (stem + ring + offset pulse dot). Wordmark `hero` (Sora ExtraBold "bod" + blue "fit") and `header` (tracked mono `BODFIT`, the lockup that sits top-right on every Figma frame). PNG assets regenerated from the same geometry via `pngjs` (SDF anti-aliasing): `icon.png`, `splash-icon.png`, `favicon.png`, Android adaptive foreground/background/monochrome. Template React logos removed.
- **Tokens** (`constants/design.ts`): white paper, near-black ink, `#4B9EFE` primary, `#C991F1` lavender partner, coach purple `#B751FF`, energy dot scale, pain scale (yellow→orange→red), hero gradient. Full dark palette. Sora for all text, DM Mono for eyebrow labels, Archivo Black for the Challenges masthead. Buttons are pill-shaped ink / gradient / hairline-outline.

## Screens (Figma frame → implementation)

| Frame(s) | Screen | File(s) |
| --- | --- | --- |
| `1:2`, `123:610` home | Today/This Week tabs + BODFIT, gradient greeting name, context line, cycle + flare-up chips, gradient **Start** orb with state copy, "Adjust for today", 2×2 context tiles, AI coach bubble, Your other goals, Suggested tonight card, Quick actions, At your desk | `components/home/*` |
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
| `36:226` challenges | GOALS · N in progress, THE / outlined-gradient CHALLENGES masthead, In-progress/Done/Archived tabs, percentage rows with hairlines, gradient Create, Group challenges rows + gradient "+" | `app/(tabs)/challenges.tsx`, `components/social/together-section.tsx` |
| `40:362` challenge detail | ← Back to Challenges, eyebrow + %, progress line, NEXT UP card with Start/Adjust, winding **Program** path with ✓/▶/○ nodes + coach cheer, Progress log card + mini bars + Log Progress, Edit Target / Archive goal | `app/challenge/[id].tsx` |

Auth, welcome, loading and onboarding have no Figma frames; they were restyled to the same system (Bodfit mark, segmented step bars, borderless inputs, ink/outline pills).

## Behaviour kept (AGENTS.md)

- Every workout entry goes through the daily check-in; recommendations, desk micro-sessions, "Take a breather" and challenge "Start" all seed the check-in.
- Location is asked only for strength/hybrid/cardio (not run, mobility, recovery); inferred suggestions are marked with a sparkle, no "likely" text.
- Home stays action-focused; weekly analytics live behind the "This Week" tab the Figma specifies; settings/theme stay on Profile.
- Tab bar hidden on login/onboarding (unchanged logic in `app/(tabs)/index.tsx`).
- Set table rules in `ExerciseTable` are untouched (only header chrome changed).

## Known gaps / judgement calls

- **Retune** rebuilds the session from the updated check-in when it has not been started (Figma copy promises an in-place retune of the same moves). A started session keeps its plan; the new values shape the next one.
- Figma's `WORK` location segment is rendered as **Gym** (the backend has home/gym/outdoors/travel; no "work" environment).
- "Run" type is stored as `cardio` + focus tag `running` (no `run` literal in the schema).
- The finished-session frame shows three "9" boxes with no labels; not implemented since their meaning is undefined in the file. Session stats tiles (sets / exercises / PRs) sit in that slot instead.
- "Edit Target" on a challenge creates a new version (no edit mutation exists); it says so in a confirm dialog.
- `MovementJourneyBar` (floating phase strip) was removed in favour of the Figma inline progress bar.
- `#D9D9D9` filled context tiles from the file are rendered as a lighter `surface` tone for contrast.

## Verification

- `npx expo lint` clean, `npx tsc --noEmit` clean, `vitest` 50/50.
- Manual web walkthrough against an isolated anonymous Convex deployment: sign-in → home → full check-in (including body map rating) → "Coach is planning" → ready list → live session → "Something hurts" → complete → recap → challenges; light and dark mode.

## Staging preview (not production)

- Web preview on EAS Hosting: **https://embodi--g8niug3e8e.expo.app** (created with `npx expo export --platform web` + `npx eas-cli@latest deploy`, no `--prod`). Production `embodi.expo.app` is untouched; no store submit, no Convex prod cutover.
- The preview bundle points at the day-to-day Convex dev deployment `helpful-gopher-816` (per AGENTS.md). The two backend additions on this branch (`checkin.retuneTodaysSession` and the 10/20/40/50-minute `timeAvailable` literals) are not pushed to that deployment from this VM (no deploy key). Until `npx convex dev` is run against `helpful-gopher-816` from a logged-in machine, "Retune workout" and the 10/20/40/50 time tiles will fail on the preview; everything else runs against existing functions. The isolated anonymous deployment used for local testing has the full backend.

## Verify pass

A **Grok 4.7** verify pass will review this branch against the Figma frames and send findings back for fixes.
