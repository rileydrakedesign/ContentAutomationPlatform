"use client";

import { useState, useEffect, useRef } from "react";
import { UserVoiceSettings, VoiceType, ChatMessage as ChatMessageType } from "@/types/voice";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { SettingsPreview } from "./SettingsPreview";
import { Card, CardContent } from "@/components/ui/Card";
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
  const [acceptedMessageIds, setAcceptedMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleAcceptChanges = async (changes: Partial<UserVoiceSettings>, messageId: string) => {
    await onSettingsUpdate(changes);
    setAcceptedMessageIds((prev) => new Set(prev).add(messageId));
  };

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
                Describe your voice style in natural language
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
                Describe how you want your content to sound. The AI will suggest changes to your voice settings.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "Make it more casual",
                  "Sound more confident",
                  "Be less formal",
                  "Add more energy",
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
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onAcceptChanges={
                    message.suggestedChanges
                      ? (changes) => handleAcceptChanges(changes, message.id)
                      : undefined
                  }
                  changesAccepted={acceptedMessageIds.has(message.id)}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <ChatInput
          onSend={handleSendMessage}
          disabled={sending}
          placeholder={
            sending
              ? "Thinking..."
              : `Describe how you want your ${voiceType === "reply" ? "replies" : "posts"} to sound...`
          }
        />
      </Card>

      {/* Settings preview - 1/3 width */}
      <div className="lg:col-span-1">
        <SettingsPreview settings={settings} voiceType={voiceType} />
      </div>
    </div>
  );
}
