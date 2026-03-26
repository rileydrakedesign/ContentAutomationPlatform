"use client";

type DraftType = "X_POST" | "X_THREAD";

interface FormatSelectorProps {
  selected: DraftType;
  onChange: (type: DraftType) => void;
}

const formats: { type: DraftType; label: string; description: string }[] = [
  { type: "X_POST", label: "X Post", description: "Single post" },
  { type: "X_THREAD", label: "Thread", description: "Multi-post thread" },
];

export function FormatSelector({ selected, onChange }: FormatSelectorProps) {
  return (
    <div>
      <label className="block text-sm text-[var(--color-text-secondary)] mb-3">Format</label>
      <div className="flex gap-3">
        {formats.map(({ type, label, description }) => (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={`flex-1 p-4 rounded-lg border text-left transition ${
              selected === type
                ? "border-[var(--color-primary-400)] bg-[var(--color-primary-400)]/10"
                : "border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            <div className="font-medium text-[var(--color-text-primary)]">{label}</div>
            <div className="text-sm text-[var(--color-text-muted)] mt-1">{description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
