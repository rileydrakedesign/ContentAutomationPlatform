import { Queue } from "bullmq";
import { getConnection } from "./connection";

// NOTE: this file is intentionally small; queues live in src/lib/queue/queues.ts
// but publishing uses a dedicated queue name.

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 200,
};

let _publishQueue: Queue | null = null;

export function getPublishQueue(): Queue {
  if (!_publishQueue) {
    _publishQueue = new Queue("publish", {
      connection: getConnection(),
      defaultJobOptions,
    });
  }
  return _publishQueue;
}

export interface PublishJobData {
  scheduledPostId: string;
  userId: string;
}
