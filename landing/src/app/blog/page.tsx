"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Clock } from "lucide-react";
import { BLOG_POSTS } from "@/lib/blog-data";

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
    <Link href="/" className="flex items-center gap-1.5 no-underline">
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
    </Link>
  );
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.agentsforx.com";

/* Category colors */
const CATEGORY_COLORS: Record<string, string> = {
  "Growth Strategy": "var(--color-primary-400)",
  "AI & Voice": "var(--color-accent-400)",
  Analytics: "var(--color-success-400)",
  Workflows: "var(--color-warning-400)",
  Publishing: "var(--color-primary-300)",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function BlogPage() {
  const scrolled = useScrolled();
  const featured = BLOG_POSTS[0];
  const rest = BLOG_POSTS.slice(1);

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* Navbar */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
        style={{
          background: scrolled ? "var(--color-glass-medium)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled
            ? "1px solid var(--color-border-subtle)"
            : "1px solid transparent",
        }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <Logo />
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/#features"
              className="text-sm no-underline transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Features
            </Link>
            <Link
              href="/#pricing"
              className="text-sm no-underline transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Pricing
            </Link>
            <Link
              href="/blog"
              className="text-sm no-underline transition-colors"
              style={{ color: "var(--color-text-primary)" }}
            >
              Blog
            </Link>
            <Link
              href="/#faq"
              className="text-sm no-underline transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
            >
              FAQ
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`${APP_URL}/login`}
              className="text-sm no-underline hidden sm:block transition-colors"
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
              >
                Get Started
              </button>
            </a>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-12 px-6">
        <div className="mx-auto max-w-[1200px]">
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-display)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ color: "var(--color-text-muted)" }}>
              The{" "}
            </span>
            <span style={{ color: "var(--color-text-primary)" }}>Blog</span>
          </h1>
          <p
            className="mt-4 text-lg max-w-xl"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Strategies, workflows, and insights for growing your audience on X
            — from creators who&apos;ve done it.
          </p>
        </div>
      </section>

      {/* Featured post */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-[1200px]">
          <Link href={`/blog/${featured.slug}`} className="no-underline block group">
            <div
              className="rounded-[var(--radius-2xl)] p-8 md:p-10 transition-all duration-200 group-hover:-translate-y-1"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-default)",
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                {/* Image placeholder */}
                <div
                  className="w-full md:w-[45%] aspect-[16/9] rounded-[var(--radius-xl)] flex-shrink-0 flex items-center justify-center"
                  style={{
                    background: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Featured image
                  </span>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="text-xs font-medium uppercase tracking-wider"
                      style={{
                        color:
                          CATEGORY_COLORS[featured.category] ||
                          "var(--color-primary-400)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {featured.category}
                    </span>
                    <span
                      className="text-xs flex items-center gap-1"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <Clock size={11} />
                      {featured.readTime}
                    </span>
                  </div>
                  <h2
                    className="mb-3 group-hover:text-[var(--color-primary-400)] transition-colors"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "clamp(1.5rem, 3vw, 2rem)",
                      fontWeight: 700,
                      color: "var(--color-text-primary)",
                      lineHeight: 1.2,
                    }}
                  >
                    {featured.title}
                  </h2>
                  <p
                    className="text-base leading-relaxed mb-4"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {featured.excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {featured.author.name} &middot; {featured.date}
                    </span>
                    <span
                      className="flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all"
                      style={{ color: "var(--color-primary-400)" }}
                    >
                      Read more <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Post grid */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-6"
        style={{
          background: "var(--color-bg-base)",
          borderTop: "1px solid var(--color-border-subtle)",
          padding: "3rem 0 2rem",
          color: "var(--color-text-muted)",
          fontSize: "var(--text-sm)",
        }}
      >
        <div className="mx-auto max-w-[1200px] px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            <Link
              href="/terms"
              className="text-xs no-underline hover:text-[var(--color-text-secondary)] transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-xs no-underline hover:text-[var(--color-text-secondary)] transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              Privacy
            </Link>
          </div>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            &copy; {new Date().getFullYear()} Agents For X
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Blog card                                                          */
/* ------------------------------------------------------------------ */
function BlogCard({
  post,
}: {
  post: (typeof BLOG_POSTS)[number];
}) {
  return (
    <Link href={`/blog/${post.slug}`} className="no-underline block group">
      <article
        className="rounded-[var(--radius-2xl)] overflow-hidden transition-all duration-200 group-hover:-translate-y-1 h-full flex flex-col"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-default)",
        }}
      >
        {/* Image placeholder */}
        <div
          className="w-full aspect-[16/9] flex items-center justify-center"
          style={{
            background: "var(--color-bg-elevated)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Cover image
          </span>
        </div>

        <div className="p-6 flex flex-col flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{
                color:
                  CATEGORY_COLORS[post.category] || "var(--color-primary-400)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {post.category}
            </span>
            <span
              className="text-xs flex items-center gap-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Clock size={11} />
              {post.readTime}
            </span>
          </div>

          <h3
            className="mb-2 group-hover:text-[var(--color-primary-400)] transition-colors"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              lineHeight: 1.3,
            }}
          >
            {post.title}
          </h3>

          <p
            className="text-sm leading-relaxed mb-4 flex-1"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {post.excerpt}
          </p>

          <div className="flex items-center justify-between mt-auto pt-4"
            style={{ borderTop: "1px solid var(--color-border-subtle)" }}
          >
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {post.date}
            </span>
            <span
              className="flex items-center gap-1 text-xs font-medium group-hover:gap-2 transition-all"
              style={{ color: "var(--color-primary-400)" }}
            >
              Read <ArrowRight size={12} />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
