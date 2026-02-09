"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, Circle, ExternalLink, KeyRound, PlugZap, Upload } from "lucide-react";

type ChecklistItem = {
  id: string;
  title: string;
  desc?: string;
  done: boolean;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
    external?: boolean;
  };
};

type XStatus = { connected: boolean; username?: string } | null;

type ByoStatus = { configured: boolean } | null;

type CsvStatus = {
  uploaded_at?: string | null;
  total_posts?: number | null;
} | null;

export function SetupChecklist({
  xStatus,
  byoStatus,
  csvStatus,
  onUploadCsv,
}: {
  xStatus: XStatus;
  byoStatus: ByoStatus;
  csvStatus: CsvStatus;
  onUploadCsv: () => void;
}) {
  const items: ChecklistItem[] = [
    {
      id: "extension",
      title: "Install the Chrome extension",
      desc: "Save inspiration + use the reply agent directly inside X.",
      done: true, // we can't reliably detect; treat as informational
      cta: {
        label: "Open extension folder",
        href: "https://github.com/rileydrakedesign/ContentAutomationPlatform/tree/main/chrome-extension",
        external: true,
      },
    },
    {
      id: "csv",
      title: "Upload X analytics CSV",
      desc: "Unlock best-times + performance insights without X API calls.",
      done: !!csvStatus?.uploaded_at,
      cta: {
        label: csvStatus?.uploaded_at ? "Re-upload" : "Upload",
        onClick: onUploadCsv,
      },
    },
    {
      id: "byo",
      title: "Add your X API key + secret (BYO)",
      desc: "Publishing uses your own rate limits.",
      done: !!byoStatus?.configured,
      cta: {
        label: "Go to Settings",
        href: "/settings",
      },
    },
    {
      id: "connect",
      title: "Connect your X account",
      desc: "Required for posting/scheduling from the dashboard.",
      done: !!xStatus?.connected,
      cta: {
        label: "Go to Settings",
        href: "/settings",
      },
    },
  ];

  const remaining = items.filter((i) => !i.done && i.id !== "extension");

  // If everything is done, keep it minimal (don’t nag)
  if (remaining.length === 0) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="success" dot>
                  Ready
                </Badge>
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Setup complete
                </h2>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                You’re good to go. Create drafts, ship, and iterate.
              </p>
            </div>
            <Link href="/create">
              <Button variant="primary" size="sm" glow>
                Create
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="warning" dot>
                Setup
              </Badge>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Finish setup
              </h2>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Do these once. After that, the dashboard becomes your daily cockpit.
            </p>
          </div>
          <Link href="/settings">
            <Button variant="secondary" size="sm">
              Settings
            </Button>
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {items
            .filter((i) => i.id !== "extension")
            .map((item) => {
              const Icon = item.id === "csv" ? Upload : item.id === "byo" ? KeyRound : PlugZap;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    item.done
                      ? "bg-[var(--color-bg-elevated)] border-[var(--color-border-default)]"
                      : "bg-[var(--color-primary-500)]/5 border-[var(--color-primary-500)]/15"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {item.done ? (
                            <CheckCircle2 className="w-4 h-4 text-[var(--color-success-400)]" />
                          ) : (
                            <Circle className="w-4 h-4 text-[var(--color-text-muted)]" />
                          )}
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">
                            {item.title}
                          </p>
                        </div>
                        {item.desc && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-1">
                            {item.desc}
                          </p>
                        )}
                        {item.id === "connect" && xStatus?.connected && xStatus.username && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-2">
                            connected as <span className="font-mono">@{xStatus.username}</span>
                          </p>
                        )}
                        {item.id === "csv" && csvStatus?.uploaded_at && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-2">
                            last upload: {new Date(csvStatus.uploaded_at).toLocaleDateString()}
                            {typeof csvStatus.total_posts === "number" ? ` · ${csvStatus.total_posts} posts` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {item.cta && (
                      <div className="shrink-0">
                        {item.cta.href ? (
                          <Link href={item.cta.href} target={item.cta.external ? "_blank" : undefined}>
                            <Button variant={item.done ? "secondary" : "primary"} size="sm" icon={item.cta.external ? <ExternalLink className="w-3.5 h-3.5" /> : undefined}>
                              {item.cta.label}
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            variant={item.done ? "secondary" : "primary"}
                            size="sm"
                            onClick={item.cta.onClick}
                          >
                            {item.cta.label}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
