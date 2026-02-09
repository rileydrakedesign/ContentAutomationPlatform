"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface CsvUploadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

export function CsvUploadDrawer({
  isOpen,
  onClose,
  onUploadComplete,
}: CsvUploadDrawerProps) {
  const [step, setStep] = useState<"instructions" | "upload" | "success" | "error">(
    "instructions"
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    total_posts: number;
    total_replies: number;
    total_rows: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/analytics/csv", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload CSV");
      }

      setResult(data.summary);
      setStep("success");
      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload CSV");
      setStep("error");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setStep("instructions");
    setError(null);
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={handleClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] z-50 animate-slide-in-right overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Upload Analytics CSV
            </h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <X className="w-5 h-5 text-[var(--color-text-muted)]" />
            </button>
          </div>

          {/* Instructions Step */}
          {step === "instructions" && (
            <div className="space-y-6">
              <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
                  How to export your X Analytics CSV
                </h3>
                <ol className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--color-primary-500)]/20 text-[var(--color-primary-400)] text-xs font-medium flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span>
                      Go to{" "}
                      <a
                        href="https://analytics.twitter.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-primary-400)] hover:underline inline-flex items-center gap-1"
                      >
                        analytics.twitter.com
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--color-primary-500)]/20 text-[var(--color-primary-400)] text-xs font-medium flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span>Click on "Posts" in the left sidebar</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--color-primary-500)]/20 text-[var(--color-primary-400)] text-xs font-medium flex items-center justify-center shrink-0">
                      3
                    </span>
                    <span>Select your desired date range (up to 91 days)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--color-primary-500)]/20 text-[var(--color-primary-400)] text-xs font-medium flex items-center justify-center shrink-0">
                      4
                    </span>
                    <span>Click "Export data" button in the top right</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--color-primary-500)]/20 text-[var(--color-primary-400)] text-xs font-medium flex items-center justify-center shrink-0">
                      5
                    </span>
                    <span>Select "By post" and download the CSV</span>
                  </li>
                </ol>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="text-sm">
                    <p className="text-amber-200 font-medium mb-1">
                      X Premium Required
                    </p>
                    <p className="text-amber-200/70">
                      X Analytics CSV export is only available for X Premium subscribers.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                variant="primary"
                fullWidth
                onClick={() => setStep("upload")}
                glow
              >
                I have my CSV ready
              </Button>
            </div>
          )}

          {/* Upload Step */}
          {step === "upload" && (
            <div className="space-y-6">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary-400)] rounded-xl p-8 text-center cursor-pointer transition-colors"
              >
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-[var(--color-primary-400)] animate-spin mb-3" />
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Processing CSV...
                    </p>
                  </div>
                ) : (
                  <>
                    <FileSpreadsheet className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
                    <p className="text-sm text-[var(--color-text-primary)] font-medium mb-1">
                      Click to select your CSV file
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      or drag and drop
                    </p>
                  </>
                )}
              </div>

              <button
                onClick={() => setStep("instructions")}
                className="w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                ← Back to instructions
              </button>
            </div>
          )}

          {/* Success Step */}
          {step === "success" && result && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-400/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                  Upload Successful!
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Your analytics data has been processed
                </p>
              </div>

              <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-semibold text-[var(--color-text-primary)] font-mono">
                      {result.total_rows}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-blue-400 font-mono">
                      {result.total_posts}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">Posts</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-emerald-400 font-mono">
                      {result.total_replies}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">Replies</p>
                  </div>
                </div>
              </div>

              <Button variant="primary" fullWidth onClick={handleClose} glow>
                View Dashboard
              </Button>
            </div>
          )}

          {/* Error Step */}
          {step === "error" && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-red-400/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                  Upload Failed
                </h3>
                <p className="text-sm text-red-400">{error}</p>
              </div>

              <div className="space-y-2">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => setStep("upload")}
                >
                  Try Again
                </Button>
                <Button variant="ghost" fullWidth onClick={() => setStep("instructions")}>
                  Back to Instructions
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
