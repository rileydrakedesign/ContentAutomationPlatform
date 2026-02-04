import { Queue } from "bullmq";
import { getConnection } from "./connection";

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

let _transcriptionQueue: Queue | null = null;
let _generationQueue: Queue | null = null;
let _voiceRefreshQueue: Queue | null = null;

export function getTranscriptionQueue(): Queue {
  if (!_transcriptionQueue) {
    _transcriptionQueue = new Queue("transcription", { connection: getConnection(), defaultJobOptions });
  }
  return _transcriptionQueue;
}

export function getGenerationQueue(): Queue {
  if (!_generationQueue) {
    _generationQueue = new Queue("generation", { connection: getConnection(), defaultJobOptions });
  }
  return _generationQueue;
}

export function getVoiceRefreshQueue(): Queue {
  if (!_voiceRefreshQueue) {
    _voiceRefreshQueue = new Queue("voice-refresh", { connection: getConnection(), defaultJobOptions });
  }
  return _voiceRefreshQueue;
}

// Job data types
export interface TranscriptionJobData {
  sourceId: string;
  audioPath: string;
}

export interface GenerationJobData {
  sourceIds: string[];
  draftType: "X_POST" | "X_THREAD" | "REEL_SCRIPT";
}

export interface VoiceRefreshJobData {
  userId: string;
  isManual: boolean;
}
