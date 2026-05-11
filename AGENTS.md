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
- Hide the bottom tab bar (Home/Library) on onboarding and account-completion screens.
- Ship every screen with both light and dark mode styles.
- In dark mode, header controls (theme toggle and similar) should use the same white icon treatment as the settings icon; keep `IconSymbol` mappings complete so Android/web render the same glyphs.
- Funnel every workout entry — including taps on recommended workouts — through the daily check-in flow so today's session is built on today's state, not stale onboarding data.
- Avoid manual refresh buttons when the UI can refetch on its own; prefer automatic, data-driven updates.
- Keep home-screen stat and insight cards at a uniform size and never let their text clip; pick a layout that fits the longest entry.
- Settings must offer both a regular sign-out (data preserved) and a confirmation-gated delete-account action that wipes only the current user's records.

## Learned Workspace Facts

- Primary Embodi Figma file (overall app design): https://www.figma.com/design/Btvt6p53EA2NQ6Z4XrUKFE/Embodi
- Pain rating page Figma file (Interactive Pain Rating Page): https://www.figma.com/make/rFbFQtHf4kUxSp7f0Nu69O/Interactive-Pain-Rating-Page--Copy-
- Convex OpenAI usage reads `OPENAI_MODEL` and `OPEN_API_KEY` from the Convex environment via `convex/openai.ts`; update the backend with `npx convex dev` or a deploy—Expo reload alone does not push Convex function changes.
- For the Embodi body / line artwork, prefer the supplied JPG over the SVG when both exist (per design handoff).
- The home screen uses a single state-aware `TodayCard` that always routes through check-in; `createPendingSession` in `convex/trainer.ts` is no longer wired to a no-context "Start workout" button.
- `convex/weeklyInsights.ts` regenerates the home "This Week" stats and recommendations on the weekly cron in `convex/crons.ts` and again after each completed workout; user thumbs-up/down feedback is stored and fed back into future generations.
- Menstrual-cycle tracking lives in `convex/cycle.ts` and `app/cycle.tsx`; it's opt-in via a Settings toggle shown only to users who selected female or "prefer not to say", and the current phase is passed into the trainer prompt in `convex/trainer.ts`.
- Account management lives in `convex/account.ts`: sign-out preserves data, while delete-account is confirmation-gated and scoped to only the current user's records.
