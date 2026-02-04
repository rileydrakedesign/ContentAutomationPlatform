"use client";

import { UserVoiceSettings, AIModelProvider } from "@/types/voice";
import { useState } from "react";

interface AIModelToggleProps {
  settings: UserVoiceSettings;
  onSettingsUpdate: (updates: Partial<UserVoiceSettings>) => Promise<void>;
}

export function AIModelToggle({
  settings,
  onSettingsUpdate,
}: AIModelToggleProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async (model: AIModelProvider) => {
    if (model === settings.ai_model || isUpdating) return;

    setIsUpdating(true);
    try {
      await onSettingsUpdate({ ai_model: model });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-100">AI Model</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Choose which AI model powers your content generation
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleToggle("openai")}
          disabled={isUpdating}
          className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            (settings.ai_model || "openai") === "openai"
              ? "bg-emerald-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
          } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
            </svg>
            <span>OpenAI</span>
          </div>
        </button>

        <button
          onClick={() => handleToggle("claude")}
          disabled={isUpdating}
          className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            settings.ai_model === "claude"
              ? "bg-orange-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
          } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M4.709 15.955l4.72-2.647.08-.08 2.726-1.529-4.398-2.398-3.048 6.574-.08.08zm8.478-5.678l3.048 1.77 3.77-2.085-3.77-2.165-3.048 1.77v.71zm-1.368.79L7.341 8.59l3.77-2.085 4.557 2.557-3.85 2.006zm-.158 1.132v4.954l3.77-2.165V9.953l-3.77 2.247zm-1.052.553l-3.77 2.085v4.876l3.77-2.085v-4.876zm8.637-5.36L12.078 3 4.789 7.312v9.546L12 21l7.246-4.142V7.392z" />
            </svg>
            <span>Claude</span>
          </div>
        </button>

        <button
          onClick={() => handleToggle("grok")}
          disabled={isUpdating}
          className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            settings.ai_model === "grok"
              ? "bg-sky-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
          } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span>Grok</span>
          </div>
        </button>
      </div>

      <p className="text-xs text-zinc-600 mt-3">
        {(settings.ai_model || "openai") === "openai"
          ? "Using GPT-4o-mini for replies and GPT-4 Turbo for posts"
          : settings.ai_model === "claude"
          ? "Using Claude Sonnet 4 for all generation"
          : "Using Grok 3 for all generation"}
      </p>
    </div>
  );
}
