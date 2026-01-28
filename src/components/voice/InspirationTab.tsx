"use client";

import { useState } from "react";
import { UserInspiration } from "@/types/voice";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface InspirationTabProps {
  inspirations: UserInspiration[];
  onInspirationUpdate: (id: string, action: "pin" | "unpin" | "exclude" | "restore") => Promise<void>;
  onRefresh: () => Promise<void>;
}

interface KeywordGroup {
  keyword: string;
  items: UserInspiration[];
}

export function InspirationTab({ inspirations, onInspirationUpdate, onRefresh }: InspirationTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [adding, setAdding] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);

  // Group by keyword
  const groups: KeywordGroup[] = [];
  const keywordMap = new Map<string, UserInspiration[]>();

  for (const insp of inspirations.filter(i => !i.is_excluded)) {
    const existing = keywordMap.get(insp.keyword);
    if (existing) {
      existing.push(insp);
    } else {
      keywordMap.set(insp.keyword, [insp]);
    }
  }

  for (const [keyword, items] of keywordMap) {
    groups.push({ keyword, items });
  }

  const excludedItems = inspirations.filter(i => i.is_excluded);
  const pinnedItems = inspirations.filter(i => i.is_pinned && !i.is_excluded);

  const handleAdd = async () => {
    if (!newKeyword.trim() || !newContent.trim()) return;

    try {
      setAdding(true);
      const res = await fetch("/api/voice/inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          content_text: newContent.trim(),
          source_author: newAuthor.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to add inspiration");

      setNewKeyword("");
      setNewContent("");
      setNewAuthor("");
      setShowAddForm(false);
      await onRefresh();
    } catch (err) {
      console.error("Failed to add inspiration:", err);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Pinned Inspiration Set */}
      <Card className="p-4">
        <CardHeader className="mb-4">
          <CardTitle>Inspiration Set</CardTitle>
          <CardDescription>
            Pinned inspiration used as style reference in prompts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pinnedItems.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <p>No pinned inspiration yet.</p>
              <p className="text-sm mt-1">Pin examples below to use them in prompts.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pinnedItems.map((item) => (
                <InspirationCard
                  key={item.id}
                  item={item}
                  onUnpin={() => onInspirationUpdate(item.id, "unpin")}
                  onExclude={() => onInspirationUpdate(item.id, "exclude")}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keywords / Topics */}
      <Card className="p-4">
        <CardHeader className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Inspiration by Topic</CardTitle>
              <CardDescription>
                High-performing content organized by keyword.
              </CardDescription>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Add Inspiration
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <div className="bg-slate-800/50 rounded-lg p-4 mb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-white mb-1">Keyword/Topic</label>
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="e.g., AI, startups, productivity"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1">Content</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Paste the inspiring post content..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1">Author (optional)</label>
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder="@username"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={adding || !newKeyword.trim() || !newContent.trim()}
                  className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  {adding ? "Adding..." : "Add"}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-white px-4 py-2 text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No inspiration added yet.</p>
              <p className="text-sm mt-1">Add high-performing content from creators you admire.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.keyword}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="purple">{group.keyword}</Badge>
                    <span className="text-xs text-slate-500">{group.items.length} items</span>
                  </div>
                  <div className="space-y-2 ml-2">
                    {group.items.map((item) => (
                      <InspirationCard
                        key={item.id}
                        item={item}
                        onPin={() => onInspirationUpdate(item.id, "pin")}
                        onExclude={() => onInspirationUpdate(item.id, "exclude")}
                        compact
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Excluded */}
      {excludedItems.length > 0 && (
        <Card className="p-4">
          <CardHeader className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Excluded</CardTitle>
                <CardDescription>
                  These will never appear in prompts.
                </CardDescription>
              </div>
              <button
                onClick={() => setShowExcluded(!showExcluded)}
                className="text-sm text-slate-400 hover:text-white transition"
              >
                {showExcluded ? "Hide" : `Show (${excludedItems.length})`}
              </button>
            </div>
          </CardHeader>
          {showExcluded && (
            <CardContent>
              <div className="space-y-2">
                {excludedItems.map((item) => (
                  <InspirationCard
                    key={item.id}
                    item={item}
                    onRestore={() => onInspirationUpdate(item.id, "restore")}
                    compact
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

interface InspirationCardProps {
  item: UserInspiration;
  onPin?: () => void;
  onUnpin?: () => void;
  onExclude?: () => void;
  onRestore?: () => void;
  compact?: boolean;
}

function InspirationCard({
  item,
  onPin,
  onUnpin,
  onExclude,
  onRestore,
  compact = false,
}: InspirationCardProps) {
  const isPinned = item.is_pinned;
  const isExcluded = item.is_excluded;

  if (compact) {
    return (
      <div className={`bg-slate-800/50 rounded-lg p-3 ${isExcluded ? "opacity-60" : ""}`}>
        <p className="text-sm text-white line-clamp-2">{item.content_text}</p>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {item.source_author && (
              <span className="text-xs text-slate-500">@{item.source_author}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isExcluded ? (
              <button
                onClick={onRestore}
                className="text-xs text-amber-400 hover:text-amber-300 transition"
              >
                Restore
              </button>
            ) : (
              <>
                {isPinned ? (
                  <button
                    onClick={onUnpin}
                    className="text-xs text-slate-400 hover:text-white transition"
                  >
                    Unpin
                  </button>
                ) : (
                  <button
                    onClick={onPin}
                    className="text-xs text-amber-400 hover:text-amber-300 transition"
                  >
                    Pin
                  </button>
                )}
                <button
                  onClick={onExclude}
                  className="text-xs text-red-400 hover:text-red-300 transition"
                >
                  Exclude
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={`p-4 ${isExcluded ? "opacity-60" : ""}`}>
      <CardContent>
        <p className="text-white text-sm leading-relaxed mb-3">{item.content_text}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="purple">{item.keyword}</Badge>
            {item.source_author && (
              <span className="text-xs text-slate-500">@{item.source_author}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isExcluded ? (
              <button
                onClick={onRestore}
                className="text-xs text-amber-400 hover:text-amber-300 transition"
              >
                Restore
              </button>
            ) : (
              <>
                {isPinned ? (
                  <button
                    onClick={onUnpin}
                    className="text-xs text-slate-400 hover:text-white transition"
                  >
                    Unpin
                  </button>
                ) : (
                  <button
                    onClick={onPin}
                    className="text-xs text-amber-400 hover:text-amber-300 transition"
                  >
                    Pin
                  </button>
                )}
                <button
                  onClick={onExclude}
                  className="text-xs text-red-400 hover:text-red-300 transition"
                >
                  Exclude
                </button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
