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
import type * as crons from "../crons.js";
import type * as cycle from "../cycle.js";
import type * as exerciseMedia from "../exerciseMedia.js";
import type * as exerciseStats from "../exerciseStats.js";
import type * as exercises from "../exercises.js";
import type * as messages from "../messages.js";
import type * as onboarding from "../onboarding.js";
import type * as openai from "../openai.js";
import type * as profileQuestions from "../profileQuestions.js";
import type * as trainer from "../trainer.js";
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
  crons: typeof crons;
  cycle: typeof cycle;
  exerciseMedia: typeof exerciseMedia;
  exerciseStats: typeof exerciseStats;
  exercises: typeof exercises;
  messages: typeof messages;
  onboarding: typeof onboarding;
  openai: typeof openai;
  profileQuestions: typeof profileQuestions;
  trainer: typeof trainer;
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
