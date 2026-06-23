import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 15;

// GET /api/og?url=<encoded> — fetch Open Graph / Twitter Card metadata for a URL
// server-side (don't rely on X to expand it) so the composer can render a link
// preview. Read-only, no auth side effects; bounded + SSRF-guarded.

function pickMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    // property="og:title" content="..."  (either attribute order)
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`,
      "i"
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
      "i"
    );
    const m = html.match(re1) || html.match(re2);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function isPublicHttpUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  // Block obvious internal/loopback targets (SSRF guard).
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null;
  }
  return u;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  const u = isPublicHttpUrl(raw);
  if (!u) {
    return NextResponse.json({ error: "Invalid or disallowed url" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(u.toString(), {
      headers: {
        // Identify as a bot that wants metadata; many sites serve OG tags to this.
        "User-Agent": "Mozilla/5.0 (compatible; AgentsForX-LinkPreview/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      redirect: "follow",
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed (${res.status})` }, { status: 200 });
    }

    // Only parse HTML, and cap the bytes we read.
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ url: u.toString(), title: null, description: null, image: null });
    }
    const html = (await res.text()).slice(0, 500_000);

    const title =
      pickMeta(html, ["og:title", "twitter:title"]) ||
      (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null);
    const description = pickMeta(html, ["og:description", "twitter:description", "description"]);
    const image = pickMeta(html, ["og:image", "twitter:image", "twitter:image:src"]);
    const siteName = pickMeta(html, ["og:site_name"]);

    return NextResponse.json({
      url: u.toString(),
      title,
      description,
      image: image ? new URL(image, u).toString() : null,
      site_name: siteName,
    });
  } catch {
    // Timeout / network error — preview is best-effort, don't 500 the composer.
    return NextResponse.json({ url: u.toString(), title: null, description: null, image: null });
  }
}
