"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  UserVoiceSettings,
  VoiceType,
  ChatMessage as ChatMessageType,
  ConversationStage,
} from "@/types/voice";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { SettingsPreview } from "./SettingsPreview";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Trash2, MessageCircle, Sparkles } from "lucide-react";

interface VoiceEditorViewProps {
  settings: UserVoiceSettings;
  voiceType: VoiceType;
  onSettingsUpdate: (updates: Partial<UserVoiceSettings>) => Promise<void>;
}

export function VoiceEditorView({
  settings,
  voiceType,
  onSettingsUpdate,
}: VoiceEditorViewProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [acceptedMessageIds, setAcceptedMessageIds] = useState<Set<string>>(
    new Set()
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derive current stage from messages
  const getCurrentStage = useCallback((): ConversationStage => {
    const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
    return lastAssistant?.stage || "initial";
  }, [messages]);

  const currentStage = getCurrentStage();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchChatHistory = async () => {
    try {
      const res = await fetch(`/api/voice/chat?type=${voiceType}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to fetch chat history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatHistory();
    setAcceptedMessageIds(new Set());
  }, [voiceType]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Regular message sending
  const handleSendMessage = async (message: string) => {
    setSending(true);
    try {
      const res = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_type: voiceType,
          message,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.userMessage, data.assistantMessage]);

        // If settings were updated, notify parent
        if (data.settingsUpdates) {
          await onSettingsUpdate(data.settingsUpdates);
        }
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  // Accept proposed changes
  const handleAcceptChanges = async (
    changes: Partial<UserVoiceSettings>,
    messageId: string
  ) => {
    setSending(true);
    try {
      const res = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_type: voiceType,
          action: "accept_changes",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.assistantMessage]);
        setAcceptedMessageIds((prev) => new Set(prev).add(messageId));

        // Apply settings update
        if (data.settingsUpdates) {
          await onSettingsUpdate(data.settingsUpdates);
        }
      }
    } catch (err) {
      console.error("Failed to accept changes:", err);
    } finally {
      setSending(false);
    }
  };

  // Modify proposed changes - just focuses the input
  const handleModifyChanges = () => {
    // The user can just type in the chat input to modify
    // This is a no-op but keeps the interface consistent
  };

  // Submit guardrails
  const handleGuardrailsSubmit = async (words: string[]) => {
    setSending(true);
    try {
      const res = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_type: voiceType,
          action: "submit_guardrails",
          actionData: { words },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.assistantMessage]);
      }
    } catch (err) {
      console.error("Failed to submit guardrails:", err);
    } finally {
      setSending(false);
    }
  };

  // Skip guardrails
  const handleGuardrailsSkip = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_type: voiceType,
          action: "skip_guardrails",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.assistantMessage]);
      }
    } catch (err) {
      console.error("Failed to skip guardrails:", err);
    } finally {
      setSending(false);
    }
  };

  // Submit sample input (topic or post to reply to)
  const handleSampleInputSubmit = async (input: string) => {
    setSending(true);
    try {
      const res = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_type: voiceType,
          action: "submit_sample_input",
          actionData: { input },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.userMessage, data.assistantMessage]);
      }
    } catch (err) {
      console.error("Failed to submit sample input:", err);
    } finally {
      setSending(false);
    }
  };

  // Clear chat history
  const handleClearHistory = async () => {
    try {
      await fetch(`/api/voice/chat?type=${voiceType}`, {
        method: "DELETE",
      });
      setMessages([]);
      setAcceptedMessageIds(new Set());
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  };

  // Get placeholder text based on current stage
  const getPlaceholder = (): string => {
    if (sending) return "Thinking...";

    switch (currentStage) {
      case "initial":
        return `Describe how you want your ${voiceType === "reply" ? "replies" : "posts"} to sound...`;
      case "review_changes":
        return "Type modifications or click Accept...";
      case "collect_guardrails":
        return "Use the form above or type words to avoid...";
      case "collect_sample_input":
        return voiceType === "post"
          ? "Enter a topic above or type here..."
          : "Paste a post above or type here...";
      case "review_sample":
        return "What would you like to change about this?";
      default:
        return "Type a message...";
    }
  };

  // Check if the last message requires a specific action (not regular text input)
  const lastMessageRequiresAction = (): boolean => {
    const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
    if (!lastAssistant?.requiresAction) return false;

    // These actions have their own UI components
    return ["accept_changes", "provide_guardrails", "provide_input"].includes(
      lastAssistant.requiresAction
    );
  };

  // Check if the last action-requiring message has been handled
  const isLastActionHandled = (): boolean => {
    const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
    if (!lastAssistant) return true;

    // If it required accept_changes and we've accepted it
    if (
      lastAssistant.requiresAction === "accept_changes" &&
      acceptedMessageIds.has(lastAssistant.id)
    ) {
      return true;
    }

    return false;
  };

  // Determine if the chat input should be shown
  const shouldShowChatInput = (): boolean => {
    // Always show input for feedback stage
    if (currentStage === "review_sample") return true;

    // Show input in initial stage
    if (currentStage === "initial") return true;

    // Show input in review_changes for modifications (even if there's an action button)
    if (currentStage === "review_changes") return true;

    // Hide input when there's an unhandled action (guardrails, sample input)
    if (lastMessageRequiresAction() && !isLastActionHandled()) {
      return false;
    }

    return true;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[650px]">
      {/* Chat area - 2/3 width */}
      <Card className="lg:col-span-2 flex flex-col overflow-hidden">
        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-default)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-500)]/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[var(--color-primary-400)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                AI Voice Editor
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                {currentStage === "initial" && "Describe your voice style"}
                {currentStage === "review_changes" && "Review proposed settings"}
                {currentStage === "collect_guardrails" && "Set up guardrails"}
                {currentStage === "collect_sample_input" && "Provide sample input"}
                {currentStage === "review_sample" && "Refine your voice"}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearHistory}
              aria-label="Clear chat history"
            >
              <Trash2 className="w-4 h-4 text-[var(--color-text-muted)] hover:text-[var(--color-danger-400)]" />
            </Button>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-[var(--color-primary-500)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-20 h-20 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center mb-6">
                <MessageCircle className="w-10 h-10 text-[var(--color-text-muted)]" />
              </div>
              <h4 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
                Configure your {voiceType} voice
              </h4>
              <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-6">
                Describe how you want your content to sound. I'll guide you
                through setting up your voice step by step.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "I want to sound confident and casual",
                  "Professional but approachable",
                  "Bold and opinionated",
                  "Friendly and conversational",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSendMessage(suggestion)}
                    className="px-3 py-1.5 text-xs font-medium text-[var(--color-primary-400)] bg-[var(--color-primary-500)]/10 rounded-full border border-[var(--color-primary-500)]/20 hover:bg-[var(--color-primary-500)]/20 transition-colors cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                // Check if this is the last assistant message
                const isLastAssistantMessage =
                  message.role === "assistant" &&
                  index ===
                    messages.length -
                      1 -
                      (messages[messages.length - 1]?.role === "user" ? 1 : 0);

                return (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    voiceType={voiceType}
                    onAcceptChanges={
                      message.pendingChanges || message.suggestedChanges
                        ? (changes) => handleAcceptChanges(changes, message.id)
                        : undefined
                    }
                    onModifyChanges={
                      message.requiresAction === "accept_changes"
                        ? handleModifyChanges
                        : undefined
                    }
                    onGuardrailsSubmit={
                      isLastAssistantMessage &&
                      message.requiresAction === "provide_guardrails"
                        ? handleGuardrailsSubmit
                        : undefined
                    }
                    onGuardrailsSkip={
                      isLastAssistantMessage &&
                      message.requiresAction === "provide_guardrails"
                        ? handleGuardrailsSkip
                        : undefined
                    }
                    onSampleInputSubmit={
                      isLastAssistantMessage &&
                      message.requiresAction === "provide_input"
                        ? handleSampleInputSubmit
                        : undefined
                    }
                    changesAccepted={acceptedMessageIds.has(message.id)}
                    actionDisabled={sending}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        {shouldShowChatInput() && (
          <ChatInput
            onSend={handleSendMessage}
            disabled={sending}
            placeholder={getPlaceholder()}
          />
        )}
      </Card>

      {/* Settings preview - 1/3 width */}
      <div className="lg:col-span-1">
        <SettingsPreview settings={settings} voiceType={voiceType} />
      </div>
    </div>
  );
}
