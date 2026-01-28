"use client";

import { useState } from "react";

interface VoiceMemoInputProps {
  onTranscriptSubmit: (transcript: string) => void;
  onAudioSubmit: (file: File) => void;
  loading?: boolean;
}

export function VoiceMemoInput({ onTranscriptSubmit, onAudioSubmit, loading }: VoiceMemoInputProps) {
  const [mode, setMode] = useState<"transcript" | "audio">("transcript");
  const [transcript, setTranscript] = useState("");
  const [file, setFile] = useState<File | null>(null);

  function handleSubmit() {
    if (mode === "transcript" && transcript.trim()) {
      onTranscriptSubmit(transcript.trim());
    } else if (mode === "audio" && file) {
      onAudioSubmit(file);
    }
  }

  const isValid = mode === "transcript" ? transcript.trim().length > 0 : file !== null;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-slate-800 rounded-md w-fit">
        <button
          type="button"
          onClick={() => setMode("transcript")}
          className={`px-3 py-1.5 rounded text-sm transition ${
            mode === "transcript"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Paste Transcript
        </button>
        <button
          type="button"
          onClick={() => setMode("audio")}
          className={`px-3 py-1.5 rounded text-sm transition ${
            mode === "audio"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Upload Audio
        </button>
      </div>

      {mode === "transcript" ? (
        <div>
          <label className="block text-sm text-slate-400 mb-1">
            Transcript (paste from Voice Memos app)
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your voice memo transcript here..."
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-slate-600 min-h-[150px]"
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm text-slate-400 mb-1">Audio File</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-slate-600 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-slate-700 file:text-slate-300"
          />
          {file && (
            <p className="text-sm text-slate-400 mt-2">Selected: {file.name}</p>
          )}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !isValid}
        className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed px-4 py-2 rounded-md text-sm transition"
      >
        {loading ? "Processing..." : "Add Content"}
      </button>
    </div>
  );
}
