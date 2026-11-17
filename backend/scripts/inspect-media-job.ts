import mediaProcessingQueue from "../queues/media.queue.js";

const inspectMediaJob = async () => {
  try {
    // Get Job ID from the terminal argument.
    const jobId = process.argv[2];

    if (!jobId) {
      console.log("Please provide a Job ID!");
      console.log("Usage: npx tsx scripts/inspect-media-job.ts <jobId>");
      return;
    }

    // Fetch the job from Redis.
    const savedJob = await mediaProcessingQueue.getJob(jobId);

    if (!savedJob) {
      console.log(`Job ${jobId} not found!`);
      return;
    }

    // Get the current state.
    const state = await savedJob.getState();

    console.log("\n-------- JOB DETAILS --------");

    console.log("Job ID:", savedJob.id);
    console.log("Job Name:", savedJob.name);
    console.log("Job Data:", savedJob.data);
    console.log("Job State:", state);

    console.log("\n-------- EXECUTION DETAILS --------");

    console.log("Attempts made:", savedJob.attemptsMade);
    console.log("Maximum attempts:", savedJob.opts.attempts ?? 1);
    console.log("Failure reason:", savedJob.failedReason);
    console.log("Return value:", savedJob.returnvalue);

    console.log("\n-------- QUEUE COUNTS --------");

    console.log("Waiting:", await mediaProcessingQueue.getWaitingCount());
    console.log("Active:", await mediaProcessingQueue.getActiveCount());
    console.log("Delayed:", await mediaProcessingQueue.getDelayedCount());
    console.log("Completed:", await mediaProcessingQueue.getCompletedCount());
    console.log("Failed:", await mediaProcessingQueue.getFailedCount());
  } catch (error) {
    console.error("Job inspection failed:", error);
  } finally {
    await mediaProcessingQueue.close();
  }
};

inspectMediaJob();
