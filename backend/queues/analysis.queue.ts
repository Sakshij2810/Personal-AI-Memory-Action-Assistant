import { Queue } from "bullmq";

import bullmqRedis from "../shared/redis/bullmq-connection.js";

// Data carried by each image-analysis job.
export interface AnalyzeImageJobData {
  mediaId: string;
  userId: string;
}

// Create an independent queue for image analysis.
const imageAnalysisQueue = new Queue<AnalyzeImageJobData>("image-analysis", {
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

export default imageAnalysisQueue;
