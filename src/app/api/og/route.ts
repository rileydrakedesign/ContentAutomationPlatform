import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";
export const maxDuration = 15;

// GET /api/og?url=<encoded> — fetch Open Graph / Twitter Card metadata for a URL
// server-side (don't rely on X to expand it) so the composer can render a link
// preview. Read-only, no auth side effects; bounded + SSRF-guarded.
//
// SSRF posture: the host's literal form is checked AND its DNS resolution is
// validated against private/link-local/loopback ranges (defeats DNS rebinding),
// for IPv4 and IPv6 incl. IPv4-mapped IPv6. Redirects are followed MANUALLY so
// each hop is re-validated — a public URL can't 30x-redirect to an internal one.

const MAX_REDIRECTS = 4;

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

// Private / loopback / link-local / unique-local / reserved ranges. Covers the
// canonical SSRF targets (cloud metadata 169.254.169.254, loopback, RFC1918,
// CGNAT, IPv6 ::1/fc00::/fe80::, and IPv4-mapped IPv6 ::ffff:a.b.c.d).
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = p;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // IPv4-mapped/embedded — validate the embedded v4.
    const mapped = lower.match(/(?:::ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    if (lower.startsWith("fe80") || lower.startsWith("fe9") ||
        lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local
    if (/^f[cd]/.test(lower)) return true; // unique-local fc00::/7
    return false;
  }
  // Not a parseable IP — treat as unsafe.
  return true;
}

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return (
    h === "localhost" ||
    h === "ip6-localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  );
}

function parseHttpUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (isBlockedHostname(u.hostname)) return null;
  return u;
}

// Validate that the URL's host resolves only to public IPs. If the host is a
// literal IP, validate it directly; otherwise resolve every address.
async function assertPublicTarget(u: URL): Promise<boolean> {
  const host = u.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (net.isIP(host)) return !isPrivateIp(host);
  try {
    const records = await lookup(host, { all: true });
    if (!records.length) return false;
    return records.every((r) => !isPrivateIp(r.address));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  let current = parseHttpUrl(raw);
  if (!current) {
    return NextResponse.json({ error: "Invalid or disallowed url" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let res: Response | null = null;
    try {
      // Manual redirect loop — re-validate the target IP at every hop.
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        if (!(await assertPublicTarget(current))) {
          return NextResponse.json(
            { error: "Invalid or disallowed url" },
            { status: 400 }
          );
        }

        res = await fetch(current.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; AgentsForX-LinkPreview/1.0)",
            Accept: "text/html,application/xhtml+xml",
          },
          signal: controller.signal,
          redirect: "manual",
        });

        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          if (!loc) break;
          const next = parseHttpUrl(new URL(loc, current).toString());
          if (!next) {
            return NextResponse.json(
              { error: "Invalid or disallowed url" },
              { status: 400 }
            );
          }
          current = next;
          continue;
        }
        break;
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!res || !res.ok) {
      return NextResponse.json(
        { error: `Fetch failed (${res?.status ?? "no response"})` },
        { status: 200 }
      );
    }

    // Only parse HTML, and cap the bytes we read.
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ url: current.toString(), title: null, description: null, image: null });
    }
    const html = (await res.text()).slice(0, 500_000);

    const title =
      pickMeta(html, ["og:title", "twitter:title"]) ||
      (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null);
    const description = pickMeta(html, ["og:description", "twitter:description", "description"]);
    const image = pickMeta(html, ["og:image", "twitter:image", "twitter:image:src"]);
    const siteName = pickMeta(html, ["og:site_name"]);

    return NextResponse.json({
      url: current.toString(),
      title,
      description,
      image: image ? new URL(image, current).toString() : null,
      site_name: siteName,
    });
  } catch {
    // Timeout / network error — preview is best-effort, don't 500 the composer.
    return NextResponse.json({ url: current.toString(), title: null, description: null, image: null });
  }
}
