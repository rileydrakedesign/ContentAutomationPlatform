"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, ChevronRight } from "lucide-react";
import { getBlogPost, BLOG_POSTS } from "@/lib/blog-data";

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
function Logo() {
  return (
    <Link href="/" className="flex items-center gap-1.5 no-underline">
      <span className="overflow-hidden flex-shrink-0" style={{ height: 24 }}>
        <span
          className="font-extrabold text-white uppercase tracking-tight whitespace-nowrap block"
          style={{ fontSize: 32, lineHeight: 1, marginTop: -5 }}
        >
          Agents For
        </span>
      </span>
      <span
        className="bg-amber-500 flex items-center justify-center flex-shrink-0 rounded overflow-hidden"
        style={{ width: 24, height: 24 }}
      >
        <Image src="/x-logo.png" alt="X" width={30} height={30} />
      </span>
    </Link>
  );
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.agentsforx.com";

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
export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const post = getBlogPost(slug);
  const scrolled = useScrolled();

  if (!post) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--color-bg-base)" }}
      >
        <div className="text-center">
          <h1
            className="text-2xl font-bold mb-4"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--color-text-primary)",
            }}
          >
            Post not found
          </h1>
          <Link
            href="/blog"
            className="text-sm"
            style={{ color: "var(--color-primary-400)" }}
          >
            Back to blog
          </Link>
        </div>
      </div>
    );
  }

  // Find related posts (same category or adjacent)
  const related = BLOG_POSTS.filter((p) => p.slug !== slug).slice(0, 3);

  // Parse markdown-like content to JSX
  const paragraphs = post.content.trim().split("\n\n");

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

      {/* Breadcrumbs */}
      <div className="pt-28 pb-4 px-6">
        <div className="mx-auto max-w-[800px]">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <Link href="/blog" className="no-underline hover:text-[var(--color-text-secondary)] transition-colors" style={{ color: "var(--color-text-muted)" }}>
              Blog
            </Link>
            <ChevronRight size={12} />
            <span style={{ color: "var(--color-text-secondary)" }}>{post.category}</span>
          </div>
        </div>
      </div>

      {/* Article header */}
      <header className="px-6 pb-8">
        <div className="mx-auto max-w-[800px]">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{
                color: CATEGORY_COLORS[post.category] || "var(--color-primary-400)",
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

          <h1
            className="mb-6"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              color: "var(--color-text-primary)",
            }}
          >
            {post.title}
          </h1>

          <div className="flex items-center gap-3 pb-8" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                background: "var(--color-bg-elevated)",
                color: "var(--color-text-secondary)",
              }}
            >
              {post.author.name[0]}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                {post.author.name}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {post.date}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Article body */}
      <article className="px-6 pb-16">
        <div className="mx-auto max-w-[800px]">
          <div className="flex flex-col gap-5">
            {paragraphs.map((para, i) => {
              const trimmed = para.trim();
              if (!trimmed) return null;

              // H2
              if (trimmed.startsWith("## ")) {
                return (
                  <h2
                    key={i}
                    className="mt-6"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "var(--text-2xl)",
                      fontWeight: 700,
                      color: "var(--color-text-primary)",
                      lineHeight: 1.3,
                    }}
                  >
                    {trimmed.replace("## ", "")}
                  </h2>
                );
              }

              // H3
              if (trimmed.startsWith("### ")) {
                return (
                  <h3
                    key={i}
                    className="mt-4"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "var(--text-xl)",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      lineHeight: 1.3,
                    }}
                  >
                    {trimmed.replace("### ", "")}
                  </h3>
                );
              }

              // Bullet list
              if (trimmed.startsWith("- ")) {
                const items = trimmed.split("\n").filter((l) => l.trim().startsWith("- "));
                return (
                  <ul key={i} className="flex flex-col gap-2 pl-1">
                    {items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2.5">
                        <span
                          className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: "var(--color-primary-400)" }}
                        />
                        <span
                          className="text-base leading-relaxed"
                          style={{ color: "var(--color-text-secondary)" }}
                          dangerouslySetInnerHTML={{
                            __html: formatInline(item.replace(/^- /, "")),
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                );
              }

              // Numbered list
              if (/^\d+\. /.test(trimmed)) {
                const items = trimmed.split("\n").filter((l) => /^\d+\. /.test(l.trim()));
                return (
                  <ol key={i} className="flex flex-col gap-2 pl-1">
                    {items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2.5">
                        <span
                          className="mt-0.5 text-sm font-semibold flex-shrink-0"
                          style={{
                            color: "var(--color-primary-400)",
                            fontFamily: "var(--font-mono)",
                            minWidth: "1.25rem",
                          }}
                        >
                          {j + 1}.
                        </span>
                        <span
                          className="text-base leading-relaxed"
                          style={{ color: "var(--color-text-secondary)" }}
                          dangerouslySetInnerHTML={{
                            __html: formatInline(
                              item.replace(/^\d+\.\s*/, "")
                            ),
                          }}
                        />
                      </li>
                    ))}
                  </ol>
                );
              }

              // Regular paragraph
              return (
                <p
                  key={i}
                  className="text-base leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                  dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
                />
              );
            })}
          </div>
        </div>
      </article>

      {/* CTA banner */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-[800px]">
          <div
            className="rounded-[var(--radius-2xl)] p-8 text-center relative overflow-hidden"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px]"
              style={{
                background: "radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)",
              }}
            />
            <div className="relative">
              <h3
                className="mb-2 text-xl font-bold"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--color-text-primary)",
                }}
              >
                Ready to put this into practice?
              </h3>
              <p
                className="text-sm mb-6"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Start using AI agents to grow your X audience today.
              </p>
              <a href={`${APP_URL}/signup`}>
                <button
                  className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-[var(--radius-xl)] text-white cursor-pointer transition-all"
                  style={{
                    background: "linear-gradient(135deg, var(--color-primary-500), var(--color-primary-400))",
                    boxShadow: "0 4px 16px rgba(99, 102, 241, 0.3)",
                    border: "none",
                  }}
                >
                  Get started free <ArrowRight size={14} />
                </button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Related posts */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-[1200px]">
          <h2
            className="mb-8"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
            }}
          >
            Keep reading
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="no-underline block group"
              >
                <div
                  className="rounded-[var(--radius-xl)] p-6 h-full transition-all duration-200 group-hover:-translate-y-1"
                  style={{
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border-default)",
                  }}
                >
                  <span
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{
                      color: CATEGORY_COLORS[r.category] || "var(--color-primary-400)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {r.category}
                  </span>
                  <h3
                    className="mt-2 mb-2 group-hover:text-[var(--color-primary-400)] transition-colors"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "var(--text-base)",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      lineHeight: 1.3,
                    }}
                  >
                    {r.title}
                  </h3>
                  <p
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {r.readTime} &middot; {r.date}
                  </p>
                </div>
              </Link>
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
          <Link href="/" className="no-underline">
            <span className="flex items-center gap-1.5">
              <span className="overflow-hidden flex-shrink-0" style={{ height: 18 }}>
                <span
                  className="font-extrabold text-white uppercase tracking-tight whitespace-nowrap block"
                  style={{ fontSize: 24, lineHeight: 1, marginTop: -3 }}
                >
                  Agents For
                </span>
              </span>
              <span
                className="bg-amber-500 flex items-center justify-center flex-shrink-0 rounded overflow-hidden"
                style={{ width: 18, height: 18 }}
              >
                <Image src="/x-logo.png" alt="X" width={24} height={24} />
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-xs no-underline hover:text-[var(--color-text-secondary)] transition-colors" style={{ color: "var(--color-text-muted)" }}>
              Terms
            </Link>
            <Link href="/privacy" className="text-xs no-underline hover:text-[var(--color-text-secondary)] transition-colors" style={{ color: "var(--color-text-muted)" }}>
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
/*  Inline markdown formatting                                         */
/* ------------------------------------------------------------------ */
function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color: var(--color-text-primary); font-weight: 600">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background: var(--color-bg-elevated); padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-family: var(--font-mono); font-size: 0.875em">$1</code>');
}
