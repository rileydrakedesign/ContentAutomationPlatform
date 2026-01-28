"use client";

import { useState } from "react";
import { UserVoiceExample } from "@/types/voice";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { ExampleCard } from "./ExampleCard";

interface VoiceProfileTabProps {
  pinnedExamples: UserVoiceExample[];
  autoExamples: UserVoiceExample[];
  excludedExamples: UserVoiceExample[];
  onExampleUpdate: (id: string, action: "pin" | "unpin" | "exclude" | "restore") => Promise<void>;
  onReorderPinned: (ids: string[]) => Promise<void>;
}

export function VoiceProfileTab({
  pinnedExamples,
  autoExamples,
  excludedExamples,
  onExampleUpdate,
}: VoiceProfileTabProps) {
  const [showExcluded, setShowExcluded] = useState(false);

  return (
    <div className="space-y-4">
      {/* Pinned Examples */}
      <Card className="p-4">
        <CardHeader className="mb-4">
          <CardTitle>Pinned Examples</CardTitle>
          <CardDescription>
            These examples always appear in prompts. Drag to reorder priority.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pinnedExamples.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No pinned examples yet.</p>
              <p className="text-sm mt-1">Pin examples from the auto-selected list below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pinnedExamples
                .sort((a, b) => (a.pinned_rank || 0) - (b.pinned_rank || 0))
                .map((example) => (
                  <ExampleCard
                    key={example.id}
                    example={example}
                    onUnpin={() => onExampleUpdate(example.id, "unpin")}
                    onExclude={() => onExampleUpdate(example.id, "exclude")}
                    showDragHandle
                  />
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-Selected Top Examples */}
      <Card className="p-4">
        <CardHeader className="mb-4">
          <CardTitle>Top Performing Examples</CardTitle>
          <CardDescription>
            Auto-selected based on engagement. Refresh weekly to update.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {autoExamples.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No auto-selected examples yet.</p>
              <p className="text-sm mt-1">Click "Refresh Examples" to populate from your top posts.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {autoExamples.map((example) => (
                <ExampleCard
                  key={example.id}
                  example={example}
                  onPin={() => onExampleUpdate(example.id, "pin")}
                  onExclude={() => onExampleUpdate(example.id, "exclude")}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Excluded Examples */}
      {excludedExamples.length > 0 && (
        <Card className="p-4">
          <CardHeader className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Excluded Examples</CardTitle>
                <CardDescription>
                  These will never appear in prompts.
                </CardDescription>
              </div>
              <button
                onClick={() => setShowExcluded(!showExcluded)}
                className="text-sm text-slate-400 hover:text-white transition"
              >
                {showExcluded ? "Hide" : `Show (${excludedExamples.length})`}
              </button>
            </div>
          </CardHeader>
          {showExcluded && (
            <CardContent>
              <div className="space-y-3">
                {excludedExamples.map((example) => (
                  <ExampleCard
                    key={example.id}
                    example={example}
                    onRestore={() => onExampleUpdate(example.id, "restore")}
                  />
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
