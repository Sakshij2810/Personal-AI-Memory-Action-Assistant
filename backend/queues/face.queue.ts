import { Queue } from "bullmq";
import bullmqRedis from "../shared/redis/bullmq-connection.js";

export interface ProcessFaceJobData {
  mediaId: string;
  userId: string;
}

export const faceQueue = new Queue<ProcessFaceJobData>("face-processing", {
  connection: bullmqRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export const enqueueFaceProcessingJob = async (data: ProcessFaceJobData) => {
  return faceQueue.add("process-faces", data, {
    jobId: `face-${data.mediaId}`,
  });
};
