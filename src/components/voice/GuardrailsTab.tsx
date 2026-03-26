"use client";

import { useState } from "react";
import { UserVoiceSettings, VoiceGuardrails } from "@/types/voice";
import { X, Plus } from "lucide-react";

interface GuardrailsTabProps {
  settings: UserVoiceSettings;
  onSettingsUpdate: (updates: Partial<UserVoiceSettings>) => Promise<void>;
}

export function GuardrailsTab({ settings, onSettingsUpdate }: GuardrailsTabProps) {
  const guardrails = settings.guardrails || {
    avoid_words: [],
    avoid_topics: [],
    custom_rules: [],
  };

  const [newWord, setNewWord] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newRule, setNewRule] = useState("");

  const updateGuardrails = async (updates: Partial<VoiceGuardrails>) => {
    await onSettingsUpdate({
      guardrails: { ...guardrails, ...updates },
    });
  };

  const addWord = async () => {
    if (!newWord.trim()) return;
    const words = [...guardrails.avoid_words, newWord.trim().toLowerCase()];
    await updateGuardrails({ avoid_words: words });
    setNewWord("");
  };

  const removeWord = async (word: string) => {
    const words = guardrails.avoid_words.filter((w) => w !== word);
    await updateGuardrails({ avoid_words: words });
  };

  const addTopic = async () => {
    if (!newTopic.trim()) return;
    const topics = [...guardrails.avoid_topics, newTopic.trim()];
    await updateGuardrails({ avoid_topics: topics });
    setNewTopic("");
  };

  const removeTopic = async (topic: string) => {
    const topics = guardrails.avoid_topics.filter((t) => t !== topic);
    await updateGuardrails({ avoid_topics: topics });
  };

  const addRule = async () => {
    if (!newRule.trim()) return;
    const rules = [...guardrails.custom_rules, newRule.trim()];
    await updateGuardrails({ custom_rules: rules });
    setNewRule("");
  };

  const removeRule = async (rule: string) => {
    const rules = guardrails.custom_rules.filter((r) => r !== rule);
    await updateGuardrails({ custom_rules: rules });
  };

  return (
    <div className="space-y-6">
      {/* Words to Avoid */}
      <div className="bg-[var(--color-bg-base)] border border-[var(--color-border-default)] rounded-lg p-6">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">Words to Avoid</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          The AI will never use these words in generated content.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {guardrails.avoid_words.map((word) => (
            <span
              key={word}
              className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--color-danger-500)]/10 text-[var(--color-danger-400)] rounded-full text-sm"
            >
              {word}
              <button
                onClick={() => removeWord(word)}
                className="p-0.5 hover:bg-[var(--color-danger-500)]/20 rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {guardrails.avoid_words.length === 0 && (
            <span className="text-sm text-[var(--color-text-muted)] italic">No words added yet</span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWord()}
            placeholder="Add a word..."
            className="flex-1 px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
          />
          <button
            onClick={addWord}
            disabled={!newWord.trim()}
            className="px-4 py-2 bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Topics to Avoid */}
      <div className="bg-[var(--color-bg-base)] border border-[var(--color-border-default)] rounded-lg p-6">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">Topics to Avoid</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          The AI will steer clear of these subjects in generated content.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {guardrails.avoid_topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500/10 text-orange-400 rounded-full text-sm"
            >
              {topic}
              <button
                onClick={() => removeTopic(topic)}
                className="p-0.5 hover:bg-orange-500/20 rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {guardrails.avoid_topics.length === 0 && (
            <span className="text-sm text-[var(--color-text-muted)] italic">No topics added yet</span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTopic()}
            placeholder="Add a topic..."
            className="flex-1 px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
          />
          <button
            onClick={addTopic}
            disabled={!newTopic.trim()}
            className="px-4 py-2 bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Custom Rules */}
      <div className="bg-[var(--color-bg-base)] border border-[var(--color-border-default)] rounded-lg p-6">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">Custom Rules</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Add specific instructions the AI should always follow.
        </p>

        <div className="space-y-2 mb-4">
          {guardrails.custom_rules.map((rule, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 bg-[var(--color-bg-elevated)]/50 border border-[var(--color-border-default)]/50 rounded-lg"
            >
              <span className="text-sm text-[var(--color-text-secondary)] flex-1">{rule}</span>
              <button
                onClick={() => removeRule(rule)}
                className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger-400)] hover:bg-[var(--color-danger-500)]/10 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {guardrails.custom_rules.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)] italic">No custom rules added yet</p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRule()}
            placeholder="e.g., Always end with a call to action"
            className="flex-1 px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
          />
          <button
            onClick={addRule}
            disabled={!newRule.trim()}
            className="px-4 py-2 bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
