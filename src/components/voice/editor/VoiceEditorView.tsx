"use client";

import { useState, useEffect, useRef } from "react";
import { UserVoiceSettings, VoiceType, ChatMessage as ChatMessageType } from "@/types/voice";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { SettingsPreview } from "./SettingsPreview";
import { Trash2 } from "lucide-react";

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      {/* Chat area - 2/3 width */}
      <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg flex flex-col">
        {/* Chat header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-medium text-white">Voice Editor</h3>
            <p className="text-xs text-slate-500">
              Describe your voice style in natural language
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">
                Configure your {voiceType} voice
              </h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Try saying things like "make it more casual" or "I want to sound
                confident but not arrogant"
              </p>
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
      </div>

      {/* Settings preview - 1/3 width */}
      <div className="lg:col-span-1">
        <SettingsPreview settings={settings} voiceType={voiceType} />
      </div>
    </div>
  );
}
