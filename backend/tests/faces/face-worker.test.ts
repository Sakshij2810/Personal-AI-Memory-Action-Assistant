import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class FakeWorker {
    static instance: FakeWorker;

    processor: (job: any) => Promise<any>;
    options: any;
    handlers = new Map<string, (...args: any[]) => any>();

    constructor(
      _queueName: string,
      processor: (job: any) => Promise<any>,
      options: any,
    ) {
      this.processor = processor;
      this.options = options;
      FakeWorker.instance = this;
    }

    on(event: string, handler: (...args: any[]) => any) {
      this.handlers.set(event, handler);
      return this;
    }

    emit(event: string, ...args: any[]) {
      return this.handlers.get(event)?.(...args);
    }

    close = vi.fn(async () => undefined);
  }

  class FakeQueue {
    add = vi.fn().mockResolvedValue({ id: "mock-job-id" });
    getJob = vi.fn().mockResolvedValue(null);
    close = vi.fn().mockResolvedValue(undefined);
  }

  return {
    FakeWorker,
    FakeQueue,
    readFile: vi.fn(),
    poolQuery: vi.fn(),
    markFaceProcessingStarted: vi.fn(),
    markFaceProcessingFailed: vi.fn(),
    saveDetectedFaces: vi.fn(),
    recoverStuckFaceProcessingJobs: vi.fn(),
    recoverUnqueuedFaceProcessingJobs: vi.fn(),
    generateFaceCrops: vi.fn(),
  };
});

vi.mock("bullmq", () => ({
  Worker: mocks.FakeWorker,
  Queue: mocks.FakeQueue,
}));

vi.mock("node:fs/promises", () => ({
  readFile: mocks.readFile,
}));

vi.mock("../../config/db.js", () => ({
  default: {
    query: mocks.poolQuery,
  },
}));

vi.mock("../../shared/redis/bullmq-connection.js", () => ({
  default: {},
}));

vi.mock("../../config/media-storage.js", () => ({
  mediaStorageDir: "/tmp/memora-test-media",
}));

vi.mock("../../lib/env.js", () => ({
  env: {
    FACE_SERVICE_URL: "http://127.0.0.1:8000/",
  },
}));

vi.mock("../../services/faces/face.repository.js", () => ({
  markFaceProcessingStarted: mocks.markFaceProcessingStarted,
  markFaceProcessingFailed: mocks.markFaceProcessingFailed,
  saveDetectedFaces: mocks.saveDetectedFaces,
}));

vi.mock("../../helpers/face.helper.js", () => ({
  recoverStuckFaceProcessingJobs: mocks.recoverStuckFaceProcessingJobs,
  recoverUnqueuedFaceProcessingJobs: mocks.recoverUnqueuedFaceProcessingJobs,
}));

vi.mock("../../services/faces/face-crop.service.js", () => ({
  generateFaceCrops: mocks.generateFaceCrops,
}));

import { faceWorker, closeFaceWorker } from "../../workers/face.worker.js";

const MEDIA_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const IMAGE_BUFFER = Buffer.from("fake-image-content");

const createPythonFace = (overrides: Record<string, any> = {}) => ({
  face_number: 1,
  bounding_box: {
    x: 10,
    y: 20,
    width: 100,
    height: 120,
  },
  detection_confidence: 0.95,
  embedding: Array.from({ length: 128 }, (_, index) => (index + 1) / 128),
  ...overrides,
});

const createPythonResponse = (faces = [createPythonFace()]) => ({
  success: true,
  total_faces: faces.length,
  faces,
});

const createJob = () => ({
  id: `face-${MEDIA_ID}`,
  data: {
    mediaId: MEDIA_ID,
    userId: USER_ID,
  },
  opts: {
    attempts: 3,
  },
  attemptsMade: 1,
});

const mockExistingMedia = (overrides: Record<string, any> = {}) => {
  mocks.poolQuery.mockResolvedValue({
    rowCount: 1,
    rows: [
      {
        id: MEDIA_ID,
        storage_key: "photo.jpg",
        mime_type: "image/jpeg",
        ...overrides,
      },
    ],
  });
};

const mockSuccessfulFaceService = (data = createPythonResponse()) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    ),
  );
};

const runProcessor = () => {
  return mocks.FakeWorker.instance.processor(createJob());
};

describe("Face worker tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.readFile.mockResolvedValue(IMAGE_BUFFER);

    mocks.markFaceProcessingStarted.mockResolvedValue(undefined);
    mocks.markFaceProcessingFailed.mockResolvedValue(undefined);
    mocks.saveDetectedFaces.mockResolvedValue(true);

    mocks.recoverStuckFaceProcessingJobs.mockResolvedValue(undefined);
    mocks.recoverUnqueuedFaceProcessingJobs.mockResolvedValue(undefined);

    mocks.generateFaceCrops.mockResolvedValue([
      {
        faceNumber: 1,
        cropKey: "face-1.webp",
      },
    ]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await closeFaceWorker();
  });

  describe("worker configuration", () => {
    it("uses concurrency 1", () => {
      expect(mocks.FakeWorker.instance).toBeDefined();

      expect(mocks.FakeWorker.instance.options).toMatchObject({
        concurrency: 1,
      });
    });
  });

  describe("face processing", () => {
    it("processes an image and saves detected faces", async () => {
      mockExistingMedia();
      mockSuccessfulFaceService();

      const result = await runProcessor();

      expect(result).toEqual({
        success: true,
        mediaId: MEDIA_ID,
        totalFaces: 1,
        totalCrops: 1,
      });

      expect(mocks.poolQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = $1 AND user_id = $2"),
        [MEDIA_ID, USER_ID],
      );

      expect(mocks.markFaceProcessingStarted).toHaveBeenCalledWith(MEDIA_ID);

      expect(mocks.readFile).toHaveBeenCalledWith(
        "/tmp/memora-test-media/photo.jpg",
      );

      expect(mocks.generateFaceCrops).toHaveBeenCalledWith(
        IMAGE_BUFFER,
        MEDIA_ID,
        [
          expect.objectContaining({
            faceNumber: 1,
            detectionConfidence: 0.95,
          }),
        ],
      );

      expect(mocks.saveDetectedFaces).toHaveBeenCalledWith(MEDIA_ID, USER_ID, [
        expect.objectContaining({
          faceNumber: 1,
          cropKey: "face-1.webp",
          embedding: expect.arrayContaining([1 / 128]),
        }),
      ]);
    });

    it("sends the original image to the Python face service", async () => {
      mockExistingMedia();

      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(createPythonResponse()), { status: 200 }),
        );

      vi.stubGlobal("fetch", fetchMock);

      await runProcessor();

      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:8000/face-embeddings",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
          signal: expect.any(AbortSignal),
        }),
      );

      const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
      const formData = requestInit.body as FormData;

      expect(formData.get("file")).toBeInstanceOf(Blob);
    });

    it("supports images with no detected faces", async () => {
      mockExistingMedia();
      mockSuccessfulFaceService(createPythonResponse([]));

      mocks.generateFaceCrops.mockResolvedValue([]);

      const result = await runProcessor();

      expect(result).toEqual({
        success: true,
        mediaId: MEDIA_ID,
        totalFaces: 0,
        totalCrops: 0,
      });

      expect(mocks.generateFaceCrops).toHaveBeenCalledWith(
        IMAGE_BUFFER,
        MEDIA_ID,
        [],
      );

      expect(mocks.saveDetectedFaces).toHaveBeenCalledWith(
        MEDIA_ID,
        USER_ID,
        [],
      );
    });
  });

  describe("deleted media handling", () => {
    it("skips processing when media no longer exists", async () => {
      mocks.poolQuery.mockResolvedValue({
        rowCount: 0,
        rows: [],
      });

      const result = await runProcessor();

      expect(result).toEqual({
        success: true,
        skipped: true,
        mediaId: MEDIA_ID,
      });

      expect(mocks.markFaceProcessingStarted).not.toHaveBeenCalled();
      expect(mocks.readFile).not.toHaveBeenCalled();
      expect(mocks.generateFaceCrops).not.toHaveBeenCalled();
      expect(mocks.saveDetectedFaces).not.toHaveBeenCalled();
    });

    it("skips saving when media is deleted before persistence", async () => {
      mockExistingMedia();
      mockSuccessfulFaceService();

      mocks.saveDetectedFaces.mockResolvedValue(false);

      const result = await runProcessor();

      expect(result).toEqual({
        success: true,
        skipped: true,
        mediaId: MEDIA_ID,
      });

      expect(mocks.saveDetectedFaces).toHaveBeenCalledOnce();
    });
  });

  describe("input validation", () => {
    it("rejects unsupported MIME types", async () => {
      mockExistingMedia({
        mime_type: "application/pdf",
      });

      await expect(runProcessor()).rejects.toThrow(
        "Unsupported image MIME type: application/pdf",
      );

      expect(mocks.markFaceProcessingStarted).not.toHaveBeenCalled();
      expect(mocks.readFile).not.toHaveBeenCalled();
    });

    it("rejects unsafe storage paths", async () => {
      mockExistingMedia({
        storage_key: "../../etc/passwd",
      });

      await expect(runProcessor()).rejects.toThrow(
        "Invalid image storage path.",
      );

      expect(mocks.markFaceProcessingStarted).not.toHaveBeenCalled();
      expect(mocks.readFile).not.toHaveBeenCalled();
    });

    it("rejects invalid Python response structure", async () => {
      mockExistingMedia();

      mockSuccessfulFaceService({
        success: true,
        total_faces: 2,
        faces: [createPythonFace()],
      });

      await expect(runProcessor()).rejects.toThrow(
        "Face service returned an invalid response.",
      );

      expect(mocks.generateFaceCrops).not.toHaveBeenCalled();
      expect(mocks.saveDetectedFaces).not.toHaveBeenCalled();
    });

    it("rejects embeddings that do not contain 128 values", async () => {
      mockExistingMedia();

      mockSuccessfulFaceService(
        createPythonResponse([
          createPythonFace({
            embedding: Array(127).fill(0.1),
          }),
        ]),
      );

      await expect(runProcessor()).rejects.toThrow(
        "Face service returned invalid data for face 1.",
      );

      expect(mocks.saveDetectedFaces).not.toHaveBeenCalled();
    });

    it("rejects embeddings containing non-finite values", async () => {
      mockExistingMedia();

      const embedding = Array(128).fill(0.1);
      embedding[5] = Number.NaN;

      mockSuccessfulFaceService(
        createPythonResponse([createPythonFace({ embedding })]),
      );

      await expect(runProcessor()).rejects.toThrow(
        "Face service returned invalid data for face 1.",
      );

      expect(mocks.saveDetectedFaces).not.toHaveBeenCalled();
    });

    it("rejects invalid bounding boxes", async () => {
      mockExistingMedia();

      mockSuccessfulFaceService(
        createPythonResponse([
          createPythonFace({
            bounding_box: {
              x: -1,
              y: 20,
              width: 100,
              height: 100,
            },
          }),
        ]),
      );

      await expect(runProcessor()).rejects.toThrow(
        "Face service returned invalid data for face 1.",
      );

      expect(mocks.saveDetectedFaces).not.toHaveBeenCalled();
    });

    it("rejects invalid detection confidence", async () => {
      mockExistingMedia();

      mockSuccessfulFaceService(
        createPythonResponse([
          createPythonFace({
            detection_confidence: 1.5,
          }),
        ]),
      );

      await expect(runProcessor()).rejects.toThrow(
        "Face service returned invalid data for face 1.",
      );

      expect(mocks.saveDetectedFaces).not.toHaveBeenCalled();
    });

    it("rejects missing face crops", async () => {
      mockExistingMedia();
      mockSuccessfulFaceService();

      mocks.generateFaceCrops.mockResolvedValue([]);

      await expect(runProcessor()).rejects.toThrow(
        "Face crop missing for face 1.",
      );

      expect(mocks.saveDetectedFaces).not.toHaveBeenCalled();
    });
  });

  describe("processing failures", () => {
    it("propagates filesystem read errors", async () => {
      mockExistingMedia();

      mocks.readFile.mockRejectedValue(new Error("File not found"));

      await expect(runProcessor()).rejects.toThrow("File not found");

      expect(mocks.markFaceProcessingStarted).toHaveBeenCalledWith(MEDIA_ID);

      expect(mocks.saveDetectedFaces).not.toHaveBeenCalled();
    });

    it("throws when Python service returns an HTTP error", async () => {
      mockExistingMedia();

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response("Internal server error", {
            status: 500,
          }),
        ),
      );

      await expect(runProcessor()).rejects.toThrow(
        "Face service returned HTTP 500",
      );

      expect(mocks.saveDetectedFaces).not.toHaveBeenCalled();
    });

    it("propagates Python service network errors", async () => {
      mockExistingMedia();

      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Connection refused")),
      );

      await expect(runProcessor()).rejects.toThrow("Connection refused");

      expect(mocks.saveDetectedFaces).not.toHaveBeenCalled();
    });
  });

  describe("worker failure events", () => {
    it("does not mark media failed before all attempts are exhausted", async () => {
      const job = {
        ...createJob(),
        attemptsMade: 2,
        opts: { attempts: 3 },
      };

      await mocks.FakeWorker.instance.emit(
        "failed",
        job,
        new Error("Temporary Python service error"),
      );

      expect(mocks.markFaceProcessingFailed).not.toHaveBeenCalled();
    });

    it("marks media failed after the final attempt", async () => {
      const job = {
        ...createJob(),
        attemptsMade: 3,
        opts: { attempts: 3 },
      };

      await mocks.FakeWorker.instance.emit(
        "failed",
        job,
        new Error("Face processing permanently failed"),
      );

      expect(mocks.markFaceProcessingFailed).toHaveBeenCalledWith(
        MEDIA_ID,
        "Face processing permanently failed",
      );
    });

    it("does not update media when failed event has no job", async () => {
      await mocks.FakeWorker.instance.emit(
        "failed",
        undefined,
        new Error("Worker error"),
      );

      expect(mocks.markFaceProcessingFailed).not.toHaveBeenCalled();
    });

    it("handles database errors while marking processing failed", async () => {
      mocks.markFaceProcessingFailed.mockRejectedValue(
        new Error("Database unavailable"),
      );

      const job = {
        ...createJob(),
        attemptsMade: 3,
        opts: { attempts: 3 },
      };

      await expect(
        mocks.FakeWorker.instance.emit(
          "failed",
          job,
          new Error("Processing failed"),
        ),
      ).resolves.toBeUndefined();

      expect(mocks.markFaceProcessingFailed).toHaveBeenCalledOnce();
    });
  });

  describe("recovery", () => {
    it("runs both recovery helpers when worker becomes ready", async () => {
      await mocks.FakeWorker.instance.emit("ready");

      await vi.waitFor(() => {
        expect(mocks.recoverUnqueuedFaceProcessingJobs).toHaveBeenCalledOnce();

        expect(mocks.recoverStuckFaceProcessingJobs).toHaveBeenCalledOnce();
      });
    });

    it("closes the worker successfully", async () => {
      await closeFaceWorker();

      expect(mocks.FakeWorker.instance.close).toHaveBeenCalledOnce();
    });
  });
});
