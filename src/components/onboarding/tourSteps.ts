import {
  Sparkles,
  Chrome,
  PlugZap,
  Sliders,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

export type TourPlacement = "bottom" | "right" | "top" | "left" | "center";

export interface TourStep {
  id: string;
  target: string | null; // data-tour selector value, null = centered card
  title: string;
  description: string;
  placement: TourPlacement;
  skippable: boolean;
  /** If set, the action button navigates within the app (router.push) */
  navigate?: string;
  /** If set, the action button opens an external URL in a new tab */
  externalAction?: {
    label: string;
    href: string;
  };
  /** If true, no overlay — user can freely interact with the page */
  interactive?: boolean;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: "dashboard-header",
    title: "Welcome to Agents for X",
    description:
      "This is your command center. You write, the assistant coaches — showing you where a post drifts from your voice and where it'll lose to the algorithm, grounded in your own top posts.",
    placement: "bottom",
    skippable: false,
    navigate: "/",
    icon: Sparkles,
    iconColor: "var(--color-accent-400)",
    iconBg: "var(--color-accent-500)",
  },
  {
    id: "extension",
    target: "setup-checklist",
    title: "Install the Chrome Extension",
    description:
      "Take the writing assistant onto X itself — voice and reach checks in X's composer, plus saved inspiration and in-voice replies, without leaving the timeline.",
    placement: "bottom",
    skippable: true,
    navigate: "/",
    externalAction: {
      label: "Install Extension",
      href: "https://github.com/rileydrakedesign/ContentAutomationPlatform/tree/main/chrome-extension",
    },
    icon: Chrome,
    iconColor: "var(--color-accent-400)",
    iconBg: "var(--color-accent-500)",
  },
  {
    id: "connect",
    target: "settings-x-account",
    title: "Connect Your X Account",
    description:
      "Click the button below to connect via OAuth. When you're done, click Next to continue.",
    placement: "right",
    skippable: true,
    navigate: "/settings",
    interactive: true,
    icon: PlugZap,
    iconColor: "var(--color-accent-400)",
    iconBg: "var(--color-accent-500)",
  },
  {
    id: "voice",
    target: "voice-header",
    title: "Tune Your Voice",
    description:
      "Add voice examples, tune the dials, or upload a CSV — the assistant is honed on your proven patterns and scores every draft against your tuned voice as you write. Click Next when you're ready to continue.",
    placement: "right",
    skippable: true,
    navigate: "/voice",
    interactive: true,
    icon: Sliders,
    iconColor: "var(--color-success-400)",
    iconBg: "var(--color-success-500)",
  },
  {
    id: "ready",
    target: "quick-actions",
    title: "You're all set!",
    description:
      "Hit \"Write a post\" to open the editor — the assistant checks voice and reach live as you type. When you want to sharpen its read on you, run a Voice Tune-Up from Insights.",
    placement: "bottom",
    skippable: false,
    navigate: "/",
    icon: CheckCircle2,
    iconColor: "var(--color-success-400)",
    iconBg: "var(--color-success-500)",
  },
];

export const TOUR_STORAGE_KEY = "onboarding_tour_step";
