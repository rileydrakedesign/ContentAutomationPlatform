import { Queue } from "bullmq";
import { connection } from "./connection";

// Queue for transcribing voice memos
export const transcriptionQueue = new Queue("transcription", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Queue for generating content drafts
export const generationQueue = new Queue("generation", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Job data types
export interface TranscriptionJobData {
  sourceId: string;
  audioPath: string;
}

export interface GenerationJobData {
  sourceIds: string[];
  draftType: "X_POST" | "X_THREAD" | "REEL_SCRIPT";
}
