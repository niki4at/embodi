/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as challenges from "../challenges.js";
import type * as checkin from "../checkin.js";
import type * as citations from "../citations.js";
import type * as coachChat from "../coachChat.js";
import type * as communities from "../communities.js";
import type * as crons from "../crons.js";
import type * as cycle from "../cycle.js";
import type * as discover from "../discover.js";
import type * as exerciseMedia from "../exerciseMedia.js";
import type * as exerciseRecognition from "../exerciseRecognition.js";
import type * as exerciseStats from "../exerciseStats.js";
import type * as exercises from "../exercises.js";
import type * as flareUp from "../flareUp.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as openai from "../openai.js";
import type * as profileQuestions from "../profileQuestions.js";
import type * as profiles from "../profiles.js";
import type * as routines from "../routines.js";
import type * as sessionInsights from "../sessionInsights.js";
import type * as social from "../social.js";
import type * as socialHelpers from "../socialHelpers.js";
import type * as streaks from "../streaks.js";
import type * as trainer from "../trainer.js";
import type * as trending from "../trending.js";
import type * as weeklyInsights from "../weeklyInsights.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  challenges: typeof challenges;
  checkin: typeof checkin;
  citations: typeof citations;
  coachChat: typeof coachChat;
  communities: typeof communities;
  crons: typeof crons;
  cycle: typeof cycle;
  discover: typeof discover;
  exerciseMedia: typeof exerciseMedia;
  exerciseRecognition: typeof exerciseRecognition;
  exerciseStats: typeof exerciseStats;
  exercises: typeof exercises;
  flareUp: typeof flareUp;
  messages: typeof messages;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  openai: typeof openai;
  profileQuestions: typeof profileQuestions;
  profiles: typeof profiles;
  routines: typeof routines;
  sessionInsights: typeof sessionInsights;
  social: typeof social;
  socialHelpers: typeof socialHelpers;
  streaks: typeof streaks;
  trainer: typeof trainer;
  trending: typeof trending;
  weeklyInsights: typeof weeklyInsights;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
