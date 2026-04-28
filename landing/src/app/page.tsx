"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Zap,
  Calendar,
  BarChart3,
  Brain,
  Target,
  Layers,
  Chrome,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  Check,
  ArrowRight,
  Heart,
  Repeat2,
  Bookmark,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.agentsforx.com";

const CYCLING_WORDS = [
  "your personal voice",
  "pattern intelligence",
  "smart scheduling",
  "real analytics",
];

/* ------------------------------------------------------------------ */
/*  Scroll reveal hook                                                 */
/* ------------------------------------------------------------------ */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ------------------------------------------------------------------ */
/*  Navbar scroll hook                                                 */
/* ------------------------------------------------------------------ */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrolled;
}

/* ------------------------------------------------------------------ */
/*  Logo                                                               */
/* ------------------------------------------------------------------ */
function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const h = size === "sm" ? 18 : 24;
  const fs = size === "sm" ? 24 : 32;
  const mt = size === "sm" ? -3 : -5;
  const icon = size === "sm" ? 18 : 24;
  return (
    <span className="flex items-center gap-1.5">
      <span className="overflow-hidden flex-shrink-0" style={{ height: h }}>
        <span
          className="font-extrabold text-white uppercase tracking-tight whitespace-nowrap block"
          style={{ fontSize: fs, lineHeight: 1, marginTop: mt }}
        >
          Agents For
        </span>
      </span>
      <span
        className="bg-amber-500 flex items-center justify-center flex-shrink-0 rounded overflow-hidden"
        style={{ width: h, height: h }}
      >
        <Image src="/x-logo.png" alt="X" width={icon + 6} height={icon + 6} />
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  const scrolled = useScrolled();

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* ============================================================ */}
      {/*  1. NAVBAR                                                    */}
      {/* ============================================================ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
        style={{
          background: scrolled
            ? "var(--color-glass-medium)"
            : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled
            ? "1px solid var(--color-border-subtle)"
            : "1px solid transparent",
        }}
      >
        <div className="mx-auto flex max-w-[var(--container-max)] items-center justify-between px-6 py-4">
          <Logo />
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors no-underline"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors no-underline"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Pricing
            </a>
            <a
              href="/blog"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors no-underline"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Blog
            </a>
            <a
              href="#faq"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors no-underline"
              style={{ color: "var(--color-text-secondary)" }}
            >
              FAQ
            </a>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`${APP_URL}/login`}
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors no-underline hidden sm:block"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Log in
            </a>
            <a href={`${APP_URL}/signup`}>
              <button
                className="text-sm font-medium px-4 py-2 rounded-[var(--radius-lg)] border transition-all cursor-pointer"
                style={{
                  background: "transparent",
                  color: "var(--color-text-primary)",
                  borderColor: "var(--color-border-default)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--color-primary-500)";
                  e.currentTarget.style.background =
                    "var(--glow-primary-soft)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--color-border-default)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Get Started
              </button>
            </a>
          </div>
        </div>
      </nav>

      {/* ============================================================ */}
      {/*  2. HERO                                                      */}
      {/* ============================================================ */}
      <section
        className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-24"
        style={{ background: "var(--gradient-hero-bg)" }}
      >
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px]"
          style={{
            background:
              "radial-gradient(circle, var(--glow-primary-medium) 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-[var(--container-max)] px-6 flex flex-col items-center text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: "var(--glow-primary-soft)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              color: "var(--color-primary-300)",
              fontFamily: "var(--font-mono)",
              animationName: "slideUp",
              animationDuration: "0.6s",
              animationTimingFunction: "ease",
              animationFillMode: "both",
              animationDelay: "0.1s",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-400)]"
              style={{ animation: "fadeIn 1s ease infinite alternate" }}
            />
            Now in early access
          </div>

          {/* Headline */}
          <h1
            className="mt-8 max-w-4xl"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-hero)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              animationName: "slideUp",
              animationDuration: "0.6s",
              animationTimingFunction: "ease",
              animationFillMode: "both",
              animationDelay: "0.2s",
            }}
          >
            <span style={{ color: "var(--color-text-muted)" }}>
              Grow on{" "}
            </span>
            <span style={{ color: "var(--color-text-primary)" }}>
              &#x1D54F;{" "}
            </span>
            <span style={{ color: "var(--color-text-muted)" }}>with </span>
            <br className="hidden sm:block" />
            <span
              className="inline-block overflow-hidden align-bottom"
              style={{ height: "1.15em" }}
            >
              <span
                className="gradient-text block"
                style={{ animation: "cycle 10s ease-in-out infinite" }}
              >
                <span className="block" style={{ height: "1.15em" }}>
                  {CYCLING_WORDS[0]}
                </span>
                <span className="block" style={{ height: "1.15em" }}>
                  {CYCLING_WORDS[1]}
                </span>
                <span className="block" style={{ height: "1.15em" }}>
                  {CYCLING_WORDS[2]}
                </span>
                <span className="block" style={{ height: "1.15em" }}>
                  {CYCLING_WORDS[3]}
                </span>
              </span>
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className="mt-6 max-w-xl text-base sm:text-lg"
            style={{
              color: "var(--color-text-secondary)",
              lineHeight: "var(--leading-relaxed)",
              animationName: "slideUp",
              animationDuration: "0.6s",
              animationTimingFunction: "ease",
              animationFillMode: "both",
              animationDelay: "0.35s",
            }}
          >
            AI agents that save inspiration, generate content in your voice,
            find your winning patterns, and publish — all from inside your
            timeline.
          </p>

          {/* CTAs */}
          <div
            className="mt-8 flex flex-col sm:flex-row gap-3"
            style={{
              animationName: "slideUp",
              animationDuration: "0.6s",
              animationTimingFunction: "ease",
              animationFillMode: "both",
              animationDelay: "0.5s",
            }}
          >
            <a href={`${APP_URL}/signup`}>
              <button
                className="flex items-center justify-center gap-2 text-base font-semibold px-8 py-3 rounded-[var(--radius-xl)] text-white cursor-pointer transition-all sm:min-w-[200px]"
                style={{
                  background: "var(--gradient-accent)",
                  boxShadow: "var(--shadow-cta-glow)",
                  border: "none",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "var(--shadow-cta-glow-hover)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "var(--shadow-cta-glow)";
                }}
              >
                Get started free
                <ArrowRight size={16} />
              </button>
            </a>
            <a href="#features">
              <button
                className="text-base font-medium px-8 py-3 rounded-[var(--radius-xl)] cursor-pointer transition-all sm:min-w-[200px]"
                style={{
                  background: "transparent",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-default)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--color-primary-500)";
                  e.currentTarget.style.background =
                    "var(--glow-primary-soft)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--color-border-default)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                See how it works
              </button>
            </a>
          </div>

          {/* Trust text */}
          <p
            className="mt-4 text-xs"
            style={{
              color: "var(--color-text-muted)",
              animationName: "slideUp",
              animationDuration: "0.6s",
              animationTimingFunction: "ease",
              animationFillMode: "both",
              animationDelay: "0.6s",
            }}
          >
            Free to start &middot; No credit card required
          </p>

          {/* Hero image placeholder */}
          <div
            className="mt-12 w-full max-w-4xl mx-auto"
            style={{
              animationName: "slideUp",
              animationDuration: "0.8s",
              animationTimingFunction: "ease",
              animationFillMode: "both",
              animationDelay: "0.7s",
            }}
          >
            <div
              className="w-full aspect-[16/9] rounded-[var(--radius-2xl)] flex items-center justify-center"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-default)",
                boxShadow: "var(--shadow-hero-image)",
                transform: "perspective(1000px) rotateX(2deg)",
              }}
            >
              <span
                className="text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                App screenshot
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  3. SOCIAL PROOF BAR                                          */}
      {/* ============================================================ */}
      <SocialProofBar />

      {/* ============================================================ */}
      {/*  4. TESTIMONIALS                                              */}
      {/* ============================================================ */}
      <Testimonials />

      {/* ============================================================ */}
      {/*  5. PAIN → SOLUTION BRIDGE                                    */}
      {/* ============================================================ */}
      <PainSolution />

      {/* ============================================================ */}
      {/*  6. FEATURE SHOWCASE                                          */}
      {/* ============================================================ */}
      <FeatureShowcase />

      {/* ============================================================ */}
      {/*  7. HOW IT WORKS                                              */}
      {/* ============================================================ */}
      <HowItWorks />

      {/* ============================================================ */}
      {/*  8. FEATURE GRID                                              */}
      {/* ============================================================ */}
      <FeatureGrid />

      {/* ============================================================ */}
      {/*  9. PRICING                                                   */}
      {/* ============================================================ */}
      <Pricing />

      {/* ============================================================ */}
      {/*  10. FAQ                                                      */}
      {/* ============================================================ */}
      <FAQ />

      {/* ============================================================ */}
      {/*  11. FINAL CTA                                                */}
      {/* ============================================================ */}
      <FinalCTA />

      {/* ============================================================ */}
      {/*  12. FOOTER                                                   */}
      {/* ============================================================ */}
      <Footer />
    </div>
  );
}

/* ================================================================== */
/*  SECTION COMPONENTS                                                 */
/* ================================================================== */

/* ---- Social Proof Bar ---- */
function SocialProofBar() {
  const ref = useReveal();
  return (
    <section
      ref={ref}
      className="reveal py-12 border-y"
      style={{
        borderColor: "var(--color-border-subtle)",
        background: "var(--color-bg-base)",
      }}
    >
      <div className="mx-auto max-w-[var(--container-max)] px-6 flex flex-col sm:flex-row items-center justify-center gap-4">
        {/* Avatar stack */}
        <div className="flex items-center -space-x-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium"
              style={{
                background: `hsl(${i * 60 + 230}, 60%, 40%)`,
                border: "2px solid var(--color-bg-base)",
                color: "white",
              }}
            >
              {String.fromCharCode(64 + i)}
            </div>
          ))}
        </div>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Joined by{" "}
          <span
            className="font-semibold"
            style={{
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            200+
          </span>{" "}
          creators growing on &#x1D54F;
        </p>
      </div>
    </section>
  );
}

/* ---- Testimonials ---- */
function Testimonials() {
  const ref = useReveal();

  const tweets = [
    {
      name: "Alex R.",
      handle: "@alex_builds",
      body: "Been using @AgentsForX for two weeks. My reply game has never been this consistent. The voice matching is actually scary good.",
      date: "2:14 PM · Mar 12, 2026",
      likes: 47,
      retweets: 8,
      bookmarks: 12,
    },
    {
      name: "Sarah K.",
      handle: "@sarahk_writes",
      body: "The pattern extraction alone is worth the subscription. It found my best hook style and now every generated post starts with that energy.",
      date: "9:30 AM · Mar 8, 2026",
      likes: 89,
      retweets: 14,
      bookmarks: 31,
    },
    {
      name: "Mike T.",
      handle: "@miket_dev",
      body: "Chrome extension makes saving inspiration posts dead simple. One click, it's in my library, and the AI learns from it. Genius workflow.",
      date: "11:45 PM · Mar 15, 2026",
      likes: 63,
      retweets: 11,
      bookmarks: 22,
    },
  ];

  return (
    <section
      ref={ref}
      className="reveal"
      style={{
        padding: "var(--section-padding) 0",
        background: "var(--color-bg-base)",
      }}
    >
      <div className="mx-auto max-w-[var(--container-max)] px-6">
        <h2
          className="text-center mb-12"
          style={{
            fontSize: "var(--text-display)",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
          }}
        >
          <span style={{ color: "var(--color-text-muted)" }}>
            Creators are{" "}
          </span>
          <span style={{ color: "var(--color-text-primary)" }}>
            already growing
          </span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tweets.map((t) => (
            <TweetCard key={t.handle} {...t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TweetCard({
  name,
  handle,
  body,
  date,
  likes,
  retweets,
  bookmarks,
}: {
  name: string;
  handle: string;
  body: string;
  date: string;
  likes: number;
  retweets: number;
  bookmarks: number;
}) {
  return (
    <div
      className="p-6 rounded-[var(--radius-2xl)] transition-all duration-200 hover:-translate-y-1"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-default)",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{
              background: "var(--color-bg-elevated)",
              color: "var(--color-text-secondary)",
            }}
          >
            {name[0]}
          </div>
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {name}
            </p>
            <p
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {handle}
            </p>
          </div>
        </div>
        <Image src="/x-logo.png" alt="X" width={16} height={16} className="opacity-40" />
      </div>

      <p
        className="text-sm leading-relaxed mb-4"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {body.split("@").map((part, i) =>
          i === 0 ? (
            part
          ) : (
            <span key={i}>
              <span style={{ color: "var(--color-primary-400)" }}>
                @{part.split(" ")[0]}
              </span>
              {part.substring(part.indexOf(" "))}
            </span>
          )
        )}
      </p>

      <p
        className="text-xs mb-3"
        style={{ color: "var(--color-text-muted)" }}
      >
        {date}
      </p>

      <div
        className="flex items-center gap-4 pt-3"
        style={{ borderTop: "1px solid var(--color-border-subtle)" }}
      >
        <span
          className="flex items-center gap-1.5 text-xs"
          style={{
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <Heart size={13} /> {likes}
        </span>
        <span
          className="flex items-center gap-1.5 text-xs"
          style={{
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <Repeat2 size={13} /> {retweets}
        </span>
        <span
          className="flex items-center gap-1.5 text-xs"
          style={{
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <Bookmark size={13} /> {bookmarks}
        </span>
      </div>
    </div>
  );
}

/* ---- Pain → Solution Bridge ---- */
function PainSolution() {
  const ref = useReveal();
  return (
    <section
      ref={ref}
      className="reveal"
      style={{
        padding: "var(--section-padding) 0",
        background: "var(--color-bg-surface)",
      }}
    >
      <div className="mx-auto max-w-[var(--container-narrow)] px-6 text-center">
        <p
          className="text-lg sm:text-xl leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          You know consistent posting drives growth. But writing daily, finding
          your voice, tracking what works, and publishing on schedule?
        </p>
        <p
          className="mt-6 text-xl sm:text-2xl font-semibold"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--color-text-primary)",
          }}
        >
          That&apos;s a full-time job.{" "}
          <span className="gradient-text">We automated it.</span>
        </p>
      </div>
    </section>
  );
}

/* ---- Feature Showcase ---- */
function FeatureShowcase() {
  const features = [
    {
      badge: "Chrome Extension",
      badgeIcon: <Chrome size={12} />,
      title: "Save inspiration. Generate replies. Without leaving X.",
      description:
        "One-click save any post to your inspiration library. Generate context-aware replies in your voice — directly in your timeline. No tab switching, no copy-paste.",
      bullets: [
        { icon: <Sparkles size={16} />, text: "One-click post capture" },
        { icon: <MessageSquare size={16} />, text: "In-timeline reply generation" },
        { icon: <Zap size={16} />, text: "5 tone presets for any context" },
      ],
      image: "/chrome-extension.png",
    },
    {
      badge: "Voice Engine",
      badgeIcon: <Brain size={12} />,
      title: "Your voice. Infinite firepower.",
      description:
        "Fine-tune 4 voice dials, set guardrails, pin examples. The AI learns how you write — not how everyone writes. Every output sounds like you, not a bot.",
      bullets: [
        { icon: <Target size={16} />, text: "4 tunable voice dials" },
        { icon: <Layers size={16} />, text: "Custom guardrails & rules" },
        { icon: <RefreshCw size={16} />, text: "Auto-refreshing examples" },
      ],
      image: "/voice.png",
    },
    {
      badge: "Pattern Intelligence",
      badgeIcon: <BarChart3 size={12} />,
      title: "Find what works. Then do more of it.",
      description:
        "ML-powered pattern extraction analyzes your top posts to find your winning hooks, formats, and timing. Apply those patterns to every new piece of content.",
      bullets: [
        { icon: <Sparkles size={16} />, text: "Hook & format detection" },
        { icon: <BarChart3 size={16} />, text: "Engagement multiplier scoring" },
        { icon: <Target size={16} />, text: "One-click pattern application" },
      ],
      image: "/patterns.png",
    },
    {
      badge: "Publishing",
      badgeIcon: <Calendar size={12} />,
      title: "Post at the perfect time. Every time.",
      description:
        "Draft, schedule, and publish from a visual calendar. Best-time recommendations based on your analytics. Never miss a window again.",
      bullets: [
        { icon: <Calendar size={16} />, text: "Visual calendar scheduling" },
        { icon: <Zap size={16} />, text: "Best-time recommendations" },
        { icon: <RefreshCw size={16} />, text: "Auto-retry on failure" },
      ],
      image: "/scheduler.png",
    },
  ];

  return (
    <section
      id="features"
      style={{
        padding: "var(--section-padding) 0",
        background: "var(--color-bg-base)",
      }}
    >
      <div className="mx-auto max-w-[var(--container-max)] px-6">
        <div className="text-center mb-16">
          <RevealBlock>
            <h2
              style={{
                fontSize: "var(--text-display)",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
              }}
            >
              <span style={{ color: "var(--color-text-muted)" }}>
                Everything you need to{" "}
              </span>
              <span className="gradient-text">grow on &#x1D54F;</span>
            </h2>
          </RevealBlock>
        </div>

        <div className="flex flex-col gap-24">
          {features.map((feature, i) => (
            <FeatureSection
              key={feature.badge}
              {...feature}
              reversed={i % 2 === 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureSection({
  badge,
  badgeIcon,
  title,
  description,
  bullets,
  image,
  reversed,
}: {
  badge: string;
  badgeIcon: React.ReactNode;
  title: string;
  description: string;
  bullets: { icon: React.ReactNode; text: string }[];
  image: string;
  reversed: boolean;
}) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
        reversed ? "lg:[direction:rtl]" : ""
      }`}
    >
      {/* Text */}
      <div className={reversed ? "lg:[direction:ltr]" : ""}>
        <span
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider mb-4"
          style={{
            background: "var(--glow-primary-soft)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            color: "var(--color-primary-300)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {badgeIcon}
          {badge}
        </span>
        <h3
          className="mb-4"
          style={{
            fontSize: "var(--text-feature-title)",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </h3>
        <p
          className="text-base leading-relaxed mb-6"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {description}
        </p>
        <div className="flex flex-col gap-3">
          {bullets.map((b) => (
            <div key={b.text} className="flex items-center gap-3">
              <span style={{ color: "var(--color-primary-400)" }}>
                {b.icon}
              </span>
              <span
                className="text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {b.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Image */}
      <div className={reversed ? "lg:[direction:ltr]" : ""}>
        <div
          className="w-full aspect-[4/3] rounded-[var(--radius-xl)] overflow-hidden relative"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-default)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <Image
            src={image}
            alt={`${badge} screenshot`}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </div>
  );
}

/* ---- How It Works ---- */
function HowItWorks() {
  const ref = useReveal();
  const steps = [
    {
      num: 1,
      title: "Save what inspires you",
      desc: "Browse X like normal. When a post catches your eye, one click saves it to your library. The AI studies your taste.",
    },
    {
      num: 2,
      title: "Generate in your voice",
      desc: "Create posts, threads, and replies powered by your patterns and voice settings. Multiple variations, one click.",
    },
    {
      num: 3,
      title: "Schedule & grow",
      desc: "Queue content to your calendar, publish at optimal times, and watch your patterns compound into real growth.",
    },
  ];

  return (
    <section
      ref={ref}
      className="reveal"
      style={{
        padding: "var(--section-padding) 0",
        background: "var(--color-bg-surface)",
      }}
    >
      <div className="mx-auto max-w-[var(--container-max)] px-6">
        <h2
          className="text-center mb-16"
          style={{
            fontSize: "var(--text-display)",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
          }}
        >
          <span style={{ color: "var(--color-text-muted)" }}>
            How it{" "}
          </span>
          <span style={{ color: "var(--color-text-primary)" }}>works</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto relative">
          {/* Connecting line (desktop only) */}
          <div
            className="hidden md:block absolute top-6 left-[16.67%] right-[16.67%] h-[2px]"
            style={{
              background:
                "linear-gradient(90deg, var(--color-primary-500), var(--color-primary-400), var(--color-accent-400))",
              opacity: 0.3,
            }}
          />

          {steps.map((step) => (
            <div key={step.num} className="text-center relative">
              <div
                className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-xl font-bold text-white relative z-10"
                style={{
                  background: "var(--gradient-accent)",
                  fontFamily: "var(--font-heading)",
                  boxShadow: "var(--shadow-glow-primary)",
                }}
              >
                {step.num}
              </div>
              <h3
                className="mb-2 text-lg font-semibold"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--color-text-primary)",
                }}
              >
                {step.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---- Feature Grid ---- */
function FeatureGrid() {
  const ref = useReveal();
  const categories = [
    {
      title: "Content Creation",
      items: [
        { text: "AI post & thread generation", ai: true },
        { text: "Multi-model AI (Claude, GPT, Grok)", ai: true },
        { text: "Inspiration library", ai: false },
        { text: "Topic-based generation", ai: true },
        { text: "Draft management", ai: false },
      ],
    },
    {
      title: "Analytics & Insights",
      items: [
        { text: "CSV & live X API analytics", ai: false },
        { text: "Engagement funnel tracking", ai: false },
        { text: "Best day & time analysis", ai: true },
        { text: "AI insights chat assistant", ai: true },
        { text: "Niche & topic profiling", ai: true },
      ],
    },
    {
      title: "Publishing & Growth",
      items: [
        { text: "Visual calendar scheduling", ai: false },
        { text: "Optimal time posting", ai: true },
        { text: "Content strategy planner", ai: false },
        { text: "Pattern-guided generation", ai: true },
        { text: "Chrome extension", ai: false },
      ],
    },
  ];

  return (
    <section
      ref={ref}
      className="reveal"
      style={{
        padding: "var(--section-padding) 0",
        background: "var(--color-bg-base)",
      }}
    >
      <div className="mx-auto max-w-[var(--container-max)] px-6">
        <h2
          className="text-center mb-16"
          style={{
            fontSize: "var(--text-display)",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
          }}
        >
          <span style={{ color: "var(--color-text-muted)" }}>
            All the features{" "}
          </span>
          <span style={{ color: "var(--color-text-primary)" }}>
            you were hoping for
          </span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-4xl mx-auto">
          {categories.map((cat) => (
            <div key={cat.title}>
              <h4
                className="text-lg font-semibold mb-4"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--color-text-primary)",
                }}
              >
                {cat.title}
              </h4>
              <div className="flex flex-col gap-3">
                {cat.items.map((item) => (
                  <div key={item.text} className="flex items-start gap-2.5">
                    <Check
                      size={16}
                      className="mt-0.5 flex-shrink-0"
                      style={{ color: "var(--color-primary-400)" }}
                    />
                    <span
                      className="text-sm flex items-center gap-1.5"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {item.text}
                      {item.ai && (
                        <Zap
                          size={11}
                          style={{ color: "var(--color-accent-400)" }}
                        />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---- Pricing ---- */
function Pricing() {
  const ref = useReveal();
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "/month",
      description: "Get started and explore the core tools.",
      features: [
        "CSV & extension imports",
        "5 AI generations per day",
        "Manual posting",
        "Basic analytics",
        "Voice configuration",
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Pro",
      price: "$19",
      period: "/month",
      description: "Unlock the full growth engine.",
      features: [
        "Everything in Free",
        "X API sync & live analytics",
        "Unlimited AI generations",
        "Post scheduling & calendar",
        "Pattern extraction",
        "Insights chat assistant",
        "Niche analysis",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
  ];

  return (
    <section
      id="pricing"
      ref={ref}
      className="reveal"
      style={{
        padding: "var(--section-padding) 0",
        background: "var(--color-bg-surface)",
      }}
    >
      <div className="mx-auto max-w-[var(--container-max)] px-6">
        <h2
          className="text-center mb-4"
          style={{
            fontSize: "var(--text-display)",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
          }}
        >
          <span style={{ color: "var(--color-text-muted)" }}>
            Simple,{" "}
          </span>
          <span style={{ color: "var(--color-text-primary)" }}>
            transparent pricing
          </span>
        </h2>
        <p
          className="text-center mb-12 text-base"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Start free. Upgrade when you&apos;re ready.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="rounded-[var(--radius-2xl)] p-8 relative"
              style={{
                background: plan.popular
                  ? "var(--color-bg-elevated)"
                  : "var(--color-bg-surface)",
                border: plan.popular
                  ? "1px solid var(--color-primary-500)"
                  : "1px solid var(--color-border-default)",
                boxShadow: plan.popular
                  ? "var(--shadow-glow-primary)"
                  : "none",
              }}
            >
              {plan.popular && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: "var(--color-accent-500)",
                    color: "white",
                  }}
                >
                  Most Popular
                </span>
              )}
              <h3
                className="text-lg font-semibold mb-2"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--color-text-primary)",
                }}
              >
                {plan.name}
              </h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span
                  className="text-4xl font-bold"
                  style={{
                    fontFamily: "var(--font-heading)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  {plan.price}
                </span>
                <span
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {plan.period}
                </span>
              </div>
              <p
                className="text-sm mb-6"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {plan.description}
              </p>
              <div className="flex flex-col gap-3 mb-8">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <Check
                      size={15}
                      className="flex-shrink-0"
                      style={{
                        color: plan.popular
                          ? "var(--color-primary-400)"
                          : "var(--color-success-400)",
                      }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {f}
                    </span>
                  </div>
                ))}
              </div>
              <a href={`${APP_URL}/signup`} className="block">
                <button
                  className="w-full py-3 rounded-[var(--radius-xl)] text-sm font-semibold cursor-pointer transition-all"
                  style={{
                    background: plan.popular
                      ? "var(--gradient-accent)"
                      : "transparent",
                    color: plan.popular
                      ? "white"
                      : "var(--color-text-primary)",
                    border: plan.popular
                      ? "none"
                      : "1px solid var(--color-border-default)",
                    boxShadow: plan.popular
                      ? "var(--shadow-cta-glow)"
                      : "none",
                  }}
                >
                  {plan.cta}
                </button>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---- FAQ ---- */
function FAQ() {
  const ref = useReveal();
  const faqs = [
    {
      q: "How does the Chrome extension work?",
      a: "Install it once and it adds controls directly to your X timeline. You can save any post as inspiration with one click, and generate AI replies in your voice without leaving the page.",
    },
    {
      q: "Will the AI content sound like me?",
      a: "Yes. The voice engine uses your pinned examples, dial settings, and guardrails to match your writing style. You can fine-tune formality, energy, humor, and more.",
    },
    {
      q: "What AI models are available?",
      a: "You can choose between Claude, GPT, and Grok for content generation. Switch anytime from your voice settings.",
    },
    {
      q: "How does pattern extraction work?",
      a: "Upload your X analytics CSV or sync via the API. Our ML analyzes your top-performing posts to find hook styles, formats, timing patterns, and engagement triggers — then applies them to new content.",
    },
    {
      q: "Can I schedule posts?",
      a: "Yes — Pro plan includes a visual calendar for scheduling posts and threads. You get best-time recommendations based on your analytics, and auto-retry if publishing fails.",
    },
    {
      q: "Is there a free trial?",
      a: "The free plan is always free with 5 AI generations per day. Pro features come with a 7-day free trial — cancel anytime.",
    },
    {
      q: "How do I import my analytics?",
      a: "Two ways: upload a CSV export from X analytics, or connect your X account for live API sync (Pro plan). Both feed into the same analytics engine.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. No contracts, no commitments. Cancel from your settings page and you'll keep access through the end of your billing period.",
    },
  ];

  return (
    <section
      id="faq"
      ref={ref}
      className="reveal"
      style={{
        padding: "var(--section-padding) 0",
        background: "var(--color-bg-base)",
      }}
    >
      <div className="mx-auto max-w-[var(--container-narrow)] px-6">
        <h2
          className="text-center mb-12"
          style={{
            fontSize: "var(--text-display)",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
          }}
        >
          <span style={{ color: "var(--color-text-muted)" }}>
            Frequently asked{" "}
          </span>
          <span style={{ color: "var(--color-text-primary)" }}>
            questions
          </span>
        </h2>

        <div className="flex flex-col">
          {faqs.map((faq) => (
            <FAQItem key={faq.q} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="py-5"
      style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
    >
      <button
        className="w-full flex items-center justify-between text-left cursor-pointer transition-colors"
        style={{
          background: "none",
          border: "none",
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: "var(--text-lg)",
          color: "var(--color-text-primary)",
        }}
        onClick={() => setOpen(!open)}
      >
        {question}
        <ChevronDown
          size={18}
          className="flex-shrink-0 ml-4 transition-transform duration-300"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: open
              ? "var(--color-primary-400)"
              : "var(--color-text-muted)",
          }}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: open ? "200px" : "0px",
          opacity: open ? 1 : 0,
        }}
      >
        <p
          className="pt-3 text-base leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {answer}
        </p>
      </div>
    </div>
  );
}

/* ---- Final CTA ---- */
function FinalCTA() {
  const ref = useReveal();
  return (
    <section
      ref={ref}
      className="reveal relative overflow-hidden"
      style={{
        padding: "var(--section-padding) 0",
        background: "var(--color-bg-surface)",
      }}
    >
      {/* Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px]"
        style={{
          background:
            "radial-gradient(ellipse, var(--glow-primary-medium) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[var(--container-narrow)] px-6 text-center">
        <h2
          style={{
            fontSize: "var(--text-display)",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
          }}
        >
          <span style={{ color: "var(--color-text-muted)" }}>
            Ready to{" "}
          </span>
          <span className="gradient-text">grow on &#x1D54F;?</span>
        </h2>
        <p
          className="mt-4 text-base sm:text-lg"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Join hundreds of creators using AI agents to write better, post
          smarter, and grow faster.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href={`${APP_URL}/signup`}>
            <button
              className="flex items-center justify-center gap-2 text-base font-semibold px-10 py-3.5 rounded-[var(--radius-xl)] text-white cursor-pointer transition-all"
              style={{
                background: "var(--gradient-accent)",
                boxShadow: "var(--shadow-cta-glow)",
                border: "none",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "var(--shadow-cta-glow-hover)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "var(--shadow-cta-glow)";
              }}
            >
              Get started free
              <ArrowRight size={16} />
            </button>
          </a>
        </div>
        <p
          className="mt-4 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          Free to start &middot; No credit card required
        </p>
      </div>
    </section>
  );
}

/* ---- Footer ---- */
function Footer() {
  return (
    <footer
      className="px-6"
      style={{
        background: "var(--color-bg-base)",
        borderTop: "1px solid var(--color-border-subtle)",
        padding: "var(--space-12) 0 var(--space-8)",
        color: "var(--color-text-muted)",
        fontSize: "var(--text-sm)",
      }}
    >
      <div className="mx-auto max-w-[var(--container-max)] px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Logo size="sm" />
            <p
              className="mt-3 text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              AI agents that grow your &#x1D54F; presence.
            </p>
          </div>

          {/* Product */}
          <div>
            <h5
              className="text-sm font-semibold mb-3"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--color-text-primary)",
              }}
            >
              Product
            </h5>
            <div className="flex flex-col gap-2">
              <a
                href="#features"
                className="text-sm hover:text-[var(--color-text-secondary)] transition-colors no-underline"
                style={{ color: "var(--color-text-muted)" }}
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-sm hover:text-[var(--color-text-secondary)] transition-colors no-underline"
                style={{ color: "var(--color-text-muted)" }}
              >
                Pricing
              </a>
              <a
                href={`${APP_URL}/signup`}
                className="text-sm hover:text-[var(--color-text-secondary)] transition-colors no-underline"
                style={{ color: "var(--color-text-muted)" }}
              >
                Chrome Extension
              </a>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h5
              className="text-sm font-semibold mb-3"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--color-text-primary)",
              }}
            >
              Resources
            </h5>
            <div className="flex flex-col gap-2">
              <a
                href="/blog"
                className="text-sm hover:text-[var(--color-text-secondary)] transition-colors no-underline"
                style={{ color: "var(--color-text-muted)" }}
              >
                Blog
              </a>
              <a
                href="#faq"
                className="text-sm hover:text-[var(--color-text-secondary)] transition-colors no-underline"
                style={{ color: "var(--color-text-muted)" }}
              >
                FAQ
              </a>
              <a
                href={`${APP_URL}/developers`}
                className="text-sm hover:text-[var(--color-text-secondary)] transition-colors no-underline"
                style={{ color: "var(--color-text-muted)" }}
              >
                API Docs
              </a>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h5
              className="text-sm font-semibold mb-3"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--color-text-primary)",
              }}
            >
              Legal
            </h5>
            <div className="flex flex-col gap-2">
              <a
                href="/terms"
                className="text-sm hover:text-[var(--color-text-secondary)] transition-colors no-underline"
                style={{ color: "var(--color-text-muted)" }}
              >
                Terms of Service
              </a>
              <a
                href="/privacy"
                className="text-sm hover:text-[var(--color-text-secondary)] transition-colors no-underline"
                style={{ color: "var(--color-text-muted)" }}
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid var(--color-border-subtle)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            &copy; {new Date().getFullYear()} Agents For X. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ---- Reveal wrapper ---- */
function RevealBlock({ children }: { children: React.ReactNode }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="reveal">
      {children}
    </div>
  );
}
