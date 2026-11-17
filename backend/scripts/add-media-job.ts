import mediaProcessingQueue from "../queues/media.queue.js";

// producer
const addMediaJob = async () => {
  try {
    const job = await mediaProcessingQueue.add("process-image", {
      mediaId: "2185a5b6-ece1-477f-b5e1-d61d20829e8e",
      userId: "aacf2bdb-74e9-4232-bf99-2dc1ece18500",
      storageKey: "28274948-65b1-45d5-9d41-47f03ceeab42.png",
    });

    console.log("Job added successfully!");
    console.log("Job ID:", job.id);
    console.log("Job Name:", job.name);
    console.log("Job Data:", job.data);
  } catch (error) {
    console.error("Failed to add job:", error);
  } finally {
    const job = await mediaProcessingQueue.getJob("10");

    if (job) {
      console.log("Job state:", await job.getState());
      console.log("Attempts made:", job.attemptsMade);
      console.log("Failed reason:", job.failedReason);
      console.log("Job data:", job.data);
    } else {
      console.log("Job 10 not found");
    }

    await mediaProcessingQueue.close();
  }
};

addMediaJob();

/* Terminal output of Job
 * 
 sakshikalyanjadhav@Sakshis-MacBook-Air backend % npx tsx scripts/add-media-job.ts 
BullMQ Redis connected
BullMQ Redis is ready to accept commands
Job added successfully!
Job ID: 1
Job Name: process-image
Job Data: { mediaId: 'image-123', userId: 'user-456', storageKey: 'abc123.webp' }
sakshikalyanjadhav@Sakshis-MacBook-Air backend % npx tsx scripts/add-media-job.ts
BullMQ Redis connected
BullMQ Redis is ready to accept commands
Job added successfully!
Job ID: 2
Job Name: process-image
Job Data: { mediaId: 'image-123', userId: 'user-456', storageKey: 'abc123.webp' }
{ waitingCount: 2, activeCount: 0, completedCount: 0, failedCount: 0 }






 */
/* Terminal output of worker
 
BullMQ Redis connected
BullMQ Redis is ready to accept commands
Media worker is ready and waiting for jobs...
Job 1 is now ACTIVE

----------------------------
Processing job....
Job ID: 1
Job name: process-image
Job data: { mediaId: 'image-123', userId: 'user-456', storageKey: 'abc123.webp' }
Job 1 is now COMPLETED
Result: {
  success: true,
  mediaId: 'image-123',
  message: 'Image Processed Successfully'
}
Job 2 is now ACTIVE

----------------------------
Processing job....
Job ID: 2
Job name: process-image
Job data: { mediaId: 'image-123', userId: 'user-456', storageKey: 'abc123.webp' }
Job 2 is now COMPLETED
Result: {
  success: true,
  mediaId: 'image-123',
  message: 'Image Processed Successfully'
}

 */
