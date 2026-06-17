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
      "This is your command center. Analyze your niche, tune your voice, and generate content that sounds like you — it all starts right here.",
    placement: "bottom",
    skippable: false,
    navigate: "/",
    icon: Sparkles,
    iconColor: "var(--color-primary-400)",
    iconBg: "var(--color-primary-500)",
  },
  {
    id: "extension",
    target: "setup-checklist",
    title: "Install the Chrome Extension",
    description:
      "Save inspiration posts and generate AI replies directly in your X timeline with one click.",
    placement: "bottom",
    skippable: true,
    navigate: "/",
    externalAction: {
      label: "Install Extension",
      href: "https://github.com/rileydrakedesign/ContentAutomationPlatform/tree/main/chrome-extension",
    },
    icon: Chrome,
    iconColor: "var(--color-primary-400)",
    iconBg: "var(--color-primary-500)",
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
      "Add voice examples, tune the dials, or upload a CSV — generation is honed on your proven patterns, and Voice check scores any draft against your tuned voice. Click Next when you're ready to continue.",
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
      "Generate content that sounds like you, run a Voice Tune-Up from Insights, or explore your dashboard. The more you use it, the sharper your voice gets.",
    placement: "bottom",
    skippable: false,
    navigate: "/",
    icon: CheckCircle2,
    iconColor: "var(--color-success-400)",
    iconBg: "var(--color-success-500)",
  },
];

export const TOUR_STORAGE_KEY = "onboarding_tour_step";
