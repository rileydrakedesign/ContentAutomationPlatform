"use client";

import { useState } from "react";
import { UserVoiceSettings, VoiceGuardrails } from "@/types/voice";
import { X, Plus } from "lucide-react";

interface GuardrailsSectionProps {
  settings: UserVoiceSettings;
  onSettingsUpdate: (updates: Partial<UserVoiceSettings>) => Promise<void>;
}

export function GuardrailsSection({ settings, onSettingsUpdate }: GuardrailsSectionProps) {
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
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Guardrails</h3>
        <p className="text-xs text-slate-500">
          Set boundaries for AI-generated content.
        </p>
      </div>

      {/* Words to Avoid */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-2">Words to Avoid</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          {guardrails.avoid_words.map((word) => (
            <span
              key={word}
              className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs"
            >
              {word}
              <button
                onClick={() => removeWord(word)}
                className="p-0.5 hover:bg-red-500/20 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {guardrails.avoid_words.length === 0 && (
            <span className="text-xs text-slate-500 italic">None</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWord()}
            placeholder="Add word..."
            className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm placeholder-slate-500 focus:outline-none focus:outline-none focus:border-slate-500"
          />
          <button
            onClick={addWord}
            disabled={!newWord.trim()}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Topics to Avoid */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-2">Topics to Avoid</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          {guardrails.avoid_topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/10 text-orange-400 rounded text-xs"
            >
              {topic}
              <button
                onClick={() => removeTopic(topic)}
                className="p-0.5 hover:bg-orange-500/20 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {guardrails.avoid_topics.length === 0 && (
            <span className="text-xs text-slate-500 italic">None</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTopic()}
            placeholder="Add topic..."
            className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm placeholder-slate-500 focus:outline-none focus:outline-none focus:border-slate-500"
          />
          <button
            onClick={addTopic}
            disabled={!newTopic.trim()}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Custom Rules */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-2">Custom Rules</h4>
        <div className="space-y-2 mb-3">
          {guardrails.custom_rules.map((rule, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-2 bg-slate-800/50 border border-slate-700/50 rounded"
            >
              <span className="text-xs text-slate-300 flex-1">{rule}</span>
              <button
                onClick={() => removeRule(rule)}
                className="p-0.5 text-slate-400 hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {guardrails.custom_rules.length === 0 && (
            <p className="text-xs text-slate-500 italic">None</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRule()}
            placeholder="e.g., Always end with a call to action"
            className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm placeholder-slate-500 focus:outline-none focus:outline-none focus:border-slate-500"
          />
          <button
            onClick={addRule}
            disabled={!newRule.trim()}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
