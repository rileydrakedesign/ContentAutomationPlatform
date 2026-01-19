/**
 * Framework registry - exports all frameworks and provides lookup
 */

import { INSIGHT_DROP_FRAMEWORK } from "./insight-drop";
import { BUILD_UPDATE_FRAMEWORK } from "./build-update";
import { TACTICAL_GUIDE_FRAMEWORK } from "./tactical-guide";
import { OPINION_FRAMEWORK } from "./opinion";
import { THREAD_DEEP_DIVE_FRAMEWORK } from "./thread-deep-dive";

export type FrameworkType =
  | "insight_drop"
  | "build_update"
  | "tactical_guide"
  | "opinion"
  | "thread_deep_dive";

export const FRAMEWORKS: Record<FrameworkType, string> = {
  insight_drop: INSIGHT_DROP_FRAMEWORK,
  build_update: BUILD_UPDATE_FRAMEWORK,
  tactical_guide: TACTICAL_GUIDE_FRAMEWORK,
  opinion: OPINION_FRAMEWORK,
  thread_deep_dive: THREAD_DEEP_DIVE_FRAMEWORK,
};

export function getFramework(type: FrameworkType): string {
  return FRAMEWORKS[type];
}

export {
  INSIGHT_DROP_FRAMEWORK,
  BUILD_UPDATE_FRAMEWORK,
  TACTICAL_GUIDE_FRAMEWORK,
  OPINION_FRAMEWORK,
  THREAD_DEEP_DIVE_FRAMEWORK,
};
