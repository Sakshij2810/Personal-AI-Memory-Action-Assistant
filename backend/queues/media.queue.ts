// backend/queues/media.queue.ts

import { Queue } from "bullmq";

import bullmqRedis from "../shared/redis/bullmq-connection.js";

// Data that each media-processing job will carry.
export interface ProcessMediaJobData {
  mediaId: string;
  userId: string;
  storageKey: string;
}

// Create the queue
const mediaProcessingQueue = new Queue<ProcessMediaJobData>(
  "media-processing",
  {
    connection: bullmqRedis,

    defaultJobOptions: {
      attempts: 3, // If processing fails, BullMQ can try the job again, up to three attempts in total.

      /*
      The retry delay increases exponentially:
- First retry: approximately 2 seconds.
- Second retry: approximately 4 seconds.
       */
      backoff: {
        type: "exponential",
        delay: 2000,
      },

      /*
      - Keep up to 1,000 completed jobs and 5,000 failed jobs in Redis before older records are removed.
      - This helps prevent the Redis job history from growing indefinitely.
      */
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  },
);

export default mediaProcessingQueue;
