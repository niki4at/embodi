# AGENTS.md

## Project Overview

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Documentation Resources

When working on this project, **always consult the official Expo documentation** available at:

- **https://docs.expo.dev/llms.txt** - Index of all available documentation files
- **https://docs.expo.dev/llms-full.txt** - Complete Expo documentation including Expo Router, Expo Modules API, development process
- **https://docs.expo.dev/llms-eas.txt** - Complete EAS (Expo Application Services) documentation
- **https://docs.expo.dev/llms-sdk.txt** - Complete Expo SDK documentation
- **https://reactnative.dev/docs/getting-started** - Complete React Native documentation

These documentation files are specifically formatted for AI agents and should be your **primary reference** for:

- Expo APIs and best practices
- Expo Router navigation patterns
- EAS Build, Submit, and Update workflows
- Expo SDK modules and their usage
- Development and deployment processes

## Project Structure

```
/
├── app/                   # Expo Router file-based routing
│   ├── (tabs)/            # Tab-based navigation screens
│   │   ├── index.tsx      # Home screen
│   │   ├── explore.tsx    # Explore screen
│   │   └── _layout.tsx    # Tabs layout
│   ├── _layout.tsx        # Root layout with theme provider
│   └── modal.tsx          # Modal screen example
├── components/            # Reusable React components
│   ├── ui/                # UI primitives (IconSymbol, Collapsible)
│   └── ...                # Feature components (themed, haptic, parallax)
├── constants/             # App-wide constants (theme, colors)
├── hooks/                 # Custom React hooks (color scheme, theme)
├── assets/                # Static assets (images, fonts)
├── scripts/               # Utility scripts (reset-project)
├── .eas/workflows/        # EAS Workflows (CI/CD automation)
├── app.json               # Expo configuration
├── eas.json               # EAS Build/Submit configuration
└── package.json           # Dependencies and scripts
```

## Essential Commands

### Development

```bash
npx expo start                  # Start dev server
npx expo start --clear          # Clear cache and start dev server
npx expo install <package>      # Install packages with compatible versions
npx expo install --check        # Check which installed packages need to be updated
npx expo install --fix          # Automatically update any invalid package versions
npm run development-builds      # Create development builds (workflow)
npm run reset-project           # Reset to blank template
```

### Building & Testing

```bash
npx expo doctor      # Check project health and dependencies
npx expo lint        # Run ESLint
npm run draft        # Publish preview update and website (workflow)
```

### Production

```bash
npx eas-cli@latest build --platform ios -s          # Use EAS to build for iOS platform and submit to App Store
npx eas-cli@latest build --platform android -s      # Use EAS to build for Android platform and submit to Google Play Store
npm run deploy                                      # Deploy to production (workflow)
```

## Development Guidelines

### Code Style & Standards

- **TypeScript First**: Use TypeScript for all new code with strict type checking
- **Naming Conventions**: Use meaningful, descriptive names for variables, functions, and components
- **Self-Documenting Code**: Write clear, readable code that explains itself; only add comments for complex business logic or design decisions
- **React 19 Patterns**: Follow modern React patterns including:
  - Function components with hooks
  - Enable React Compiler
  - Proper dependency arrays in useEffect
  - Memoization when appropriate (useMemo, useCallback)
  - Error boundaries for better error handling

### Navigation & Routing

- Use **Expo Router** for all navigation
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`
- Docs: https://docs.expo.dev/router/introduction/

### Recommended Libraries

- **Navigation**: `expo-router` for navigation
- **Images**: `expo-image` for optimized image handling and caching
- **Animations**: `react-native-reanimated` for performant animations on native thread
- **Gestures**: `react-native-gesture-handler` for native gesture recognition
- **Storage**: Use `expo-sqlite` for persistent storage, `expo-sqlite/kv-store` for simple key-value storage

## Debugging & Development Tools

### DevTools Integration

- **React Native DevTools**: Use MCP `open_devtools` command to launch debugging tools
- **Network Inspection**: Monitor API calls and network requests in DevTools
- **Element Inspector**: Debug component hierarchy and styles
- **Performance Profiler**: Identify performance bottlenecks
- **Logging**: Use `console.log` for debugging (remove before production), `console.warn` for deprecation notices, `console.error` for actual errors, and implement error boundaries for production error handling

### Testing & Quality Assurance

#### Automated Testing with MCP Tools

Developers can configure the Expo MCP server with the following doc: https://docs.expo.dev/eas/ai/mcp/

- **Component Testing**: Add `testID` props to components for automation
- **Visual Testing**: Use MCP `automation_take_screenshot` to verify UI appearance
- **Interaction Testing**: Use MCP `automation_tap_by_testid` to simulate user interactions
- **View Verification**: Use MCP `automation_find_view_by_testid` to validate component rendering

## EAS Workflows CI/CD

This project is pre-configured with **EAS Workflows** for automating development and release processes. Workflows are defined in `.eas/workflows/` directory.

When working with EAS Workflows, **always refer to**:

- https://docs.expo.dev/eas/workflows/ for workflow examples
- The `.eas/workflows/` directory for existing workflow configurations
- You can check that a workflow YAML is valid using the workflows schema: https://exp.host/--/api/v2/workflows/schema

### Build Profiles (eas.json)

- **development**: Development builds with dev client
- **development-simulator**: Development builds for iOS simulator
- **preview**: Internal distribution preview builds
- **production**: Production builds with auto-increment

## Troubleshooting

### Expo Go Errors & Development Builds

If there are errors in **Expo Go** or the project is not running, create a **development build**. **Expo Go** is a sandbox environment with a limited set of native modules. To create development builds, run `eas build:dev`. Additionally, after installing new packages or adding config plugins, new development builds are often required.

## AI Agent Instructions

When working on this project:

1. **Always start by consulting the appropriate documentation**:

   - For general Expo questions: https://docs.expo.dev/llms-full.txt
   - For EAS/deployment questions: https://docs.expo.dev/llms-eas.txt
   - For SDK/API questions: https://docs.expo.dev/llms-sdk.txt

2. **Understand before implementing**: Read the relevant docs section before writing code

3. **Follow existing patterns**: Look at existing components and screens for patterns to follow

## Learned User Preferences

- Match the Figma designs exactly: typography, asset sizes, and the body figure illustration.
- Hide the bottom tab bar (Home/Challenges) on onboarding and account-completion screens.
- Ship every screen with both light and dark mode styles.
- In dark mode, header controls (theme toggle and similar) should use the same white icon treatment as the settings icon; keep `IconSymbol` mappings complete so Android/web render the same glyphs.
- Funnel every workout entry — including taps on recommended workouts — through the daily check-in flow so today's session is built on today's state, not stale onboarding data.
- Avoid manual refresh buttons when the UI can refetch on its own; prefer automatic, data-driven updates.
- Keep home-screen stat and insight cards at a uniform size and never let their text clip; pick a layout that fits the longest entry.
- Settings must offer both a regular sign-out (data preserved) and a confirmation-gated delete-account action that wipes only the current user's records.
- Surface the log-session-style layout at the top of the home screen; coach-assisted is the primary path into the guided session-build flow that used to sit behind "build today's session," so omit a redundant standalone "build today's session" control when that layout is present.
- On the active session / workout builder, reveal each exercise as soon as it is ready; give each row a compact menu to remove or replace an exercise (pick from the library or tell the trainer what to substitute), reorder by drag-and-hold with a minimal style (no borders, no circle around the leading icon, no "hold to reorder" labels, text stays visible during drag), and let tapping a row open a stage-relevant exercise preview. Keep the set table flat: no visible boxes/borders around the sec/kg/reps/RPE inputs, no circle around the tick, no circles around the trash/plus icons, centered column headers (SEC/REPS/RPE/PREVIOUS/SET) directly above their values, no placeholder dash while typing, and a centered input cursor (never flush right); drop per-set expandable dropdowns in favor of a "Notes" button beside the exercise name, remove the per-exercise set counter (e.g. 0/2) while keeping the single sets counter at the top, and place RPE to the right of reps.
- On movement-journey set rows, swipe right clones the set into a new unchecked row carrying its sec/kg/RPE and swipe left deletes that exact row; never allow deleting the last remaining set, surface green/red behind the card, allow free ticking and unticking, don't gate adding a set on completing the prior one, and keep the swipe animations snappy with only a subtle gesture hint instead of explicit add/remove buttons. Ticking a set fills the whole card green with a quick satisfying animation and hides the add/delete swipe actions while ticked; vertical swipes still scroll the page and horizontal swipes still add/remove a set even over an input, and inputs only enter edit mode on a single tap.
- When the user completes the day's session, navigate back to the home screen and re-show the "Start your movement" screen (with a small completed-today summary) so they can start another session, choosing to reuse today's check-in or do a fresh one; also offer a way to discard an in-progress workout without completing it and a Past Workouts history page.

## Learned Workspace Facts

- Primary Embodi Figma file (overall app design): https://www.figma.com/design/Btvt6p53EA2NQ6Z4XrUKFE/Embodi
- Pain rating page Figma file (Interactive Pain Rating Page): https://www.figma.com/make/rFbFQtHf4kUxSp7f0Nu69O/Interactive-Pain-Rating-Page--Copy-
- Convex OpenAI usage reads `OPENAI_MODEL` and `OPEN_API_KEY` from the Convex environment via `convex/openai.ts`; update the backend with `npx convex dev` or a deploy—Expo reload alone does not push Convex function changes.
- For the Embodi body / line artwork, prefer the supplied JPG over the SVG when both exist (per design handoff).
- The home screen uses a single state-aware `TodayCard` that always routes through check-in; `createPendingSession` in `convex/trainer.ts` is no longer wired to a no-context "Start workout" button.
- `convex/weeklyInsights.ts` regenerates the home "This Week" stats and recommendations on the weekly cron in `convex/crons.ts` and again after each completed workout; user thumbs-up/down feedback is stored and fed back into future generations.
- Menstrual-cycle tracking lives in `convex/cycle.ts` and `app/cycle.tsx`; it's opt-in via a Settings toggle shown only to users who selected female or "prefer not to say", and the current phase is passed into the trainer prompt in `convex/trainer.ts`.
- Account management lives in `convex/account.ts`: sign-out preserves data, while delete-account is confirmation-gated and scoped to only the current user's records.
- The web app is published at https://embodi.expo.app via Expo web hosting (EAS project `b91a84ce-6d3f-46f8-9967-2ad6414cce74`). `npm run draft` runs the EAS `create-draft` workflow (an `eas update` to the `test` channel plus a web deploy) but tends to hang locally on upload, so the reliable manual path is `npx expo export --platform web` then `npx eas-cli@latest deploy --prod`.
- The home screen's second tab is a Challenges screen (user-set goals like running a marathon, swimming regularly, or losing/gaining weight) that builds programs and tracks progress; it replaced the old Library tab. The exercise library is only surfaced when the user builds/starts their own workout or adds/replaces an exercise in the coach's session.
- The exercise picker (`components/library/exercise-library.tsx`) lists ~110 exercises grouped by body part from `constants/exercise-catalog.ts`, supports a tap-the-body-figure selector (`components/ui/body-part-selector.tsx`, figure shapes in `constants/body-shapes.ts`) and user-saved custom exercises (`convex/exercises.ts`, `custom_exercises` table); the same picker powers both build-your-own and in-session AI-coach substitution (`components/trainer/ExerciseMenuSheet.tsx`).

## Cursor Cloud specific instructions

Dependencies are refreshed automatically on startup (`npm install`). Standard commands live in this file's "Essential Commands" and in `package.json`. Notes below are the non-obvious bits for running this stack in a cloud VM.

### Two services must run for a full end-to-end test

1. **Convex backend** (database + all server functions). Run it isolated so you don't touch a real dev deployment:
   ```bash
   CONVEX_AGENT_MODE=anonymous npx convex dev
   ```
   First run downloads a local backend binary and writes `CONVEX_DEPLOYMENT`, `EXPO_PUBLIC_CONVEX_URL` (`http://127.0.0.1:3210`), and `EXPO_PUBLIC_CONVEX_SITE_URL` into `.env.local`. The first push **blocks until `CLERK_FRONTEND_API_URL` is set on the deployment** (`convex/auth.config.js` reads it).
2. **Expo web app**: `npx expo start --web` (serves `http://localhost:8081`). Native modules (camera, notifications) need a dev build, but web is enough to exercise auth → onboarding → check-in → AI session.

### Required configuration (provided via Cloud Agent secrets)

- **Client env** lives in `.env.local` (gitignored). The app throws on boot without `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, so put it (and `EXPO_PUBLIC_CONVEX_URL`) there.
- **Convex-side env must be set ON the deployment**, not just in the shell — Convex reads its own deployment env. After the secrets are in the VM environment:
  ```bash
  CONVEX_AGENT_MODE=anonymous npx convex env set CLERK_FRONTEND_API_URL "$CLERK_FRONTEND_API_URL"
  CONVEX_AGENT_MODE=anonymous npx convex env set OPEN_API_KEY "$OPEN_API_KEY"
  CONVEX_AGENT_MODE=anonymous npx convex env set OPENAI_MODEL "$OPENAI_MODEL"
  ```
  `OPEN_API_KEY` is spelled without the second `I` (see `convex/openai.ts`). `OPENAI_MODEL` is required but absent from `env.example`. `SEMANTIC_SCHOLAR_API_KEY` and `WORKOUTX_API_KEY` are optional.

### Testing notes

- The app gates everything behind Clerk auth (`components/login-screen.tsx`) then onboarding before reaching home. For automated sign-up on a Clerk **development** instance, use a `+clerk_test` email and the fixed OTP `424242`.
- AI session generation (and coach chat / weekly insights / exercise recognition) calls OpenAI through Convex actions and takes ~10-30s; wait before concluding it failed.
- `npx expo lint` is the project lint and passes clean. `npx tsc --noEmit` and `eslint .` surface a few pre-existing issues outside the `expo lint` scope (a Node script's globals, one type error in `components/trainer/ExerciseSetRow.tsx`); they are not part of the standard workflow.

### Live preview from a cloud agent (option 4) — let the user click through changes

The VM-local Convex backend (`127.0.0.1:3210`) is **not reachable off-VM**, so a tunnel to only the Expo server gives a broken app. Tunnel **both** the app and Convex:

1. Run Convex + Expo as usual (Convex in anonymous mode, Expo on 8081).
2. Publicly expose Convex (no account needed) with a cloudflared quick tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:3210   # → https://<x>.trycloudflare.com  (also do 3211 for HTTP-actions/storage)
   ```
3. Put those public URLs in `.env.local` as `EXPO_PUBLIC_CONVEX_URL` / `EXPO_PUBLIC_CONVEX_SITE_URL` (they're read at bundle time, so set them **before** starting Expo).
4. Expose the app: `npm install --no-save @expo/ngrok` then `npx expo start --tunnel`. The public web URL is `https://<sub>-anonymous-8081.exp.direct` (find the exact subdomain via `curl -s http://localhost:4040/api/tunnels`).

Hand the `*.exp.direct` URL to the user. Edits hot-reload live; `npx convex dev` keeps pushing backend edits to the tunneled deployment. Caveats: tunnels live only while this VM/session is up and the URLs change on each restart; prefer a dev build over Expo Go since Clerk SSO/secure-store/camera don't work in Go.

### Promoting to prod (only on explicit request)

Prod is **only** these; nothing else touches it:
- **Website `embodi.expo.app`**: `npx expo export -p web` then `npx eas-cli@latest deploy --prod` (drop `--prod` for a throwaway preview URL).
- **Native apps + `production` OTA channel**: pushing to `main` triggers `.eas/workflows/deploy-to-production.yml` (builds + store submit), or run it directly with `npm run deploy`.

All EAS commands need `EXPO_TOKEN` (or `eas login`) to run non-interactively; it's provided as a Cloud Agent secret (robot user `cursor-cloud-agent` on the `nick4eto` account — verify with `npx eas-cli@latest whoami`). Prod builds read `EXPO_PUBLIC_CONVEX_URL` from the EAS `production` environment (the real prod Convex deployment), not from `.env.local`/tunnels. Do the merge-to-`main` + prod deploy only when the user explicitly says to ship.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
