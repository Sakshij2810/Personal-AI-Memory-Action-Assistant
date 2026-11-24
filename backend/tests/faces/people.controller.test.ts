import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Request, Response } from "express";

vi.mock("../../services/faces/face.repository.js", () => ({
  findFaceCropForUser: vi.fn(),
  findFaceGroups: vi.fn(),
  findSimilarFaces: vi.fn(),
}));

vi.mock("../../services/faces/people.repository.js", () => ({
  assignFaceToPersonForUser: vi.fn(),
  confirmPersonIdentity: vi.fn(),
  getPeopleForUser: vi.fn(),
  getPersonGalleryForUser: vi.fn(),
  mergePeopleForUser: vi.fn(),
  removeFaceFromPersonForUser: vi.fn(),
  splitPersonForUser: vi.fn(),
}));

import {
  confirmPerson,
  getPeople,
  getPersonGallery,
  assignPersonFace,
  removePersonFace,
  mergePeople,
  splitPerson,
} from "../../controllers/face.controller.js";

import {
  confirmPersonIdentity,
  getPeopleForUser,
  getPersonGalleryForUser,
  assignFaceToPersonForUser,
  removeFaceFromPersonForUser,
  mergePeopleForUser,
  splitPersonForUser,
} from "../../services/faces/people.repository.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PERSON_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_PERSON_ID = "33333333-3333-4333-8333-333333333333";
const FACE_ID = "44444444-4444-4444-8444-444444444444";
const FACE_ID_2 = "55555555-5555-4555-8555-555555555555";

const createMocks = (
  options: {
    userId?: string;
    params?: Record<string, string>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
  } = {},
) => {
  const req = {
    user: options.userId ? { id: options.userId } : undefined,
    params: options.params ?? {},
    query: options.query ?? {},
    body: options.body ?? {},
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as Response;

  return { req, res };
};

const expectStatus = (res: Response, status: number) => {
  expect(res.status).toHaveBeenCalledWith(status);
};

const expectMessage = (res: Response, message: string) => {
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: false,
      message,
    }),
  );
};

describe("People controller tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------
  // 1. CONFIRM PERSON
  // ---------------------------------

  describe("confirmPerson", () => {
    it("returns 401 when user is unauthenticated", async () => {
      const { req, res } = createMocks({
        body: { name: "Alice", faceIds: [FACE_ID, FACE_ID_2] },
      });

      await confirmPerson(req, res);

      expectStatus(res, 401);
      expect(confirmPersonIdentity).not.toHaveBeenCalled();
    });

    it("rejects an empty name", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        body: { name: "   ", faceIds: [FACE_ID, FACE_ID_2] },
      });

      await confirmPerson(req, res);

      expectStatus(res, 400);
      expect(confirmPersonIdentity).not.toHaveBeenCalled();
    });

    it("rejects a name longer than 100 characters", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        body: { name: "A".repeat(101), faceIds: [FACE_ID, FACE_ID_2] },
      });

      await confirmPerson(req, res);

      expectStatus(res, 400);
      expect(confirmPersonIdentity).not.toHaveBeenCalled();
    });

    it("rejects fewer than two face IDs", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        body: { name: "Alice", faceIds: [FACE_ID] },
      });

      await confirmPerson(req, res);

      expectStatus(res, 400);
      expect(confirmPersonIdentity).not.toHaveBeenCalled();
    });

    it("rejects invalid face IDs", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        body: { name: "Alice", faceIds: ["invalid-id", FACE_ID] },
      });

      await confirmPerson(req, res);

      expectStatus(res, 400);
      expect(confirmPersonIdentity).not.toHaveBeenCalled();
    });

    it("rejects duplicate face IDs", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        body: { name: "Alice", faceIds: [FACE_ID, FACE_ID] },
      });

      await confirmPerson(req, res);

      expectStatus(res, 400);
      expect(confirmPersonIdentity).not.toHaveBeenCalled();
    });

    it("confirms a person successfully", async () => {
      const person = {
        id: PERSON_ID,
        name: "Alice",
        faceCount: 2,
      };

      vi.mocked(confirmPersonIdentity).mockResolvedValue(person as never);

      const { req, res } = createMocks({
        userId: USER_ID,
        body: {
          name: " Alice ",
          faceIds: [FACE_ID, FACE_ID_2],
        },
      });

      await confirmPerson(req, res);

      expectStatus(res, 201);

      expect(confirmPersonIdentity).toHaveBeenCalledWith({
        userId: USER_ID,
        name: "Alice",
        faceIds: [FACE_ID, FACE_ID_2],
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Person identity confirmed successfully.",
        person,
      });
    });

    it("returns 404 when selected faces do not exist", async () => {
      vi.mocked(confirmPersonIdentity).mockRejectedValue({
        code: "FACES_NOT_FOUND",
      });

      const { req, res } = createMocks({
        userId: USER_ID,
        body: { name: "Alice", faceIds: [FACE_ID, FACE_ID_2] },
      });

      await confirmPerson(req, res);

      expectStatus(res, 404);
    });

    it("returns 409 when faces are already assigned", async () => {
      vi.mocked(confirmPersonIdentity).mockRejectedValue({
        code: "FACES_ALREADY_ASSIGNED",
      });

      const { req, res } = createMocks({
        userId: USER_ID,
        body: { name: "Alice", faceIds: [FACE_ID, FACE_ID_2] },
      });

      await confirmPerson(req, res);

      expectStatus(res, 409);
    });
  });

  // ---------------------------------
  // 2. GET PEOPLE
  // ---------------------------------

  describe("getPeople", () => {
    it("returns 401 when unauthenticated", async () => {
      const { req, res } = createMocks();

      await getPeople(req, res);

      expectStatus(res, 401);
      expect(getPeopleForUser).not.toHaveBeenCalled();
    });

    it("returns the authenticated user's people", async () => {
      const result = {
        count: 1,
        people: [{ id: PERSON_ID, name: "Alice", faceCount: 2 }],
      };

      vi.mocked(getPeopleForUser).mockResolvedValue(result as never);

      const { req, res } = createMocks({ userId: USER_ID });

      await getPeople(req, res);

      expectStatus(res, 200);
      expect(getPeopleForUser).toHaveBeenCalledWith(USER_ID);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        ...result,
      });
    });

    it("returns 500 when repository fails", async () => {
      vi.mocked(getPeopleForUser).mockRejectedValue(new Error("DB error"));

      const { req, res } = createMocks({ userId: USER_ID });

      await getPeople(req, res);

      expectStatus(res, 500);
    });
  });

  // ---------------------------------
  // 3. PERSON GALLERY
  // ---------------------------------

  describe("getPersonGallery", () => {
    it("returns 401 when unauthenticated", async () => {
      const { req, res } = createMocks({
        params: { personId: PERSON_ID },
      });

      await getPersonGallery(req, res);

      expectStatus(res, 401);
    });

    it("rejects an invalid person ID", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        params: { personId: "invalid-id" },
      });

      await getPersonGallery(req, res);

      expectStatus(res, 400);
      expect(getPersonGalleryForUser).not.toHaveBeenCalled();
    });

    it("returns the person's gallery", async () => {
      const gallery = {
        person: { id: PERSON_ID, name: "Alice" },
        faces: [],
      };

      vi.mocked(getPersonGalleryForUser).mockResolvedValue(gallery as never);

      const { req, res } = createMocks({
        userId: USER_ID,
        params: { personId: PERSON_ID },
      });

      await getPersonGallery(req, res);

      expectStatus(res, 200);
      expect(getPersonGalleryForUser).toHaveBeenCalledWith(PERSON_ID, USER_ID);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        ...gallery,
      });
    });

    it("returns 404 when person does not exist", async () => {
      vi.mocked(getPersonGalleryForUser).mockResolvedValue(null);

      const { req, res } = createMocks({
        userId: USER_ID,
        params: { personId: PERSON_ID },
      });

      await getPersonGallery(req, res);

      expectStatus(res, 404);
    });
  });

  // ---------------------------------
  // 4. ASSIGN FACE
  // ---------------------------------

  describe("assignPersonFace", () => {
    const params = {
      personId: PERSON_ID,
      faceId: FACE_ID,
    };

    it("returns 401 when unauthenticated", async () => {
      const { req, res } = createMocks({ params });

      await assignPersonFace(req, res);

      expectStatus(res, 401);
    });

    it("rejects invalid person or face IDs", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        params: { personId: "bad-id", faceId: FACE_ID },
      });

      await assignPersonFace(req, res);

      expectStatus(res, 400);
      expect(assignFaceToPersonForUser).not.toHaveBeenCalled();
    });

    it("assigns a face successfully", async () => {
      vi.mocked(assignFaceToPersonForUser).mockResolvedValue("assigned");

      const { req, res } = createMocks({
        userId: USER_ID,
        params,
      });

      await assignPersonFace(req, res);

      expectStatus(res, 200);
      expect(assignFaceToPersonForUser).toHaveBeenCalledWith(
        PERSON_ID,
        FACE_ID,
        USER_ID,
      );
    });

    it("returns the already-assigned response", async () => {
      vi.mocked(assignFaceToPersonForUser).mockResolvedValue(
        "already_assigned",
      );

      const { req, res } = createMocks({
        userId: USER_ID,
        params,
      });

      await assignPersonFace(req, res);

      expectStatus(res, 200);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Face is already assigned to this person.",
      });
    });

    it("returns 404 when person or face does not exist", async () => {
      vi.mocked(assignFaceToPersonForUser).mockResolvedValue(null);

      const { req, res } = createMocks({
        userId: USER_ID,
        params,
      });

      await assignPersonFace(req, res);

      expectStatus(res, 404);
    });

    it("returns 409 for a duplicate face assignment", async () => {
      vi.mocked(assignFaceToPersonForUser).mockRejectedValue({
        code: "23505",
      });

      const { req, res } = createMocks({
        userId: USER_ID,
        params,
      });

      await assignPersonFace(req, res);

      expectStatus(res, 409);
    });
  });

  // ---------------------------------
  // 5. REMOVE FACE
  // ---------------------------------

  describe("removePersonFace", () => {
    const params = {
      personId: PERSON_ID,
      faceId: FACE_ID,
    };

    it("returns 401 when unauthenticated", async () => {
      const { req, res } = createMocks({ params });

      await removePersonFace(req, res);

      expectStatus(res, 401);
    });

    it("rejects invalid IDs", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        params: { personId: "invalid", faceId: FACE_ID },
      });

      await removePersonFace(req, res);

      expectStatus(res, 400);
    });

    it("removes a face successfully", async () => {
      vi.mocked(removeFaceFromPersonForUser).mockResolvedValue(true);

      const { req, res } = createMocks({
        userId: USER_ID,
        params,
      });

      await removePersonFace(req, res);

      expectStatus(res, 200);
      expect(removeFaceFromPersonForUser).toHaveBeenCalledWith(
        PERSON_ID,
        FACE_ID,
        USER_ID,
      );
    });

    it("returns 404 when assignment does not exist", async () => {
      vi.mocked(removeFaceFromPersonForUser).mockResolvedValue(false);

      const { req, res } = createMocks({
        userId: USER_ID,
        params,
      });

      await removePersonFace(req, res);

      expectStatus(res, 404);
    });
  });

  // ---------------------------------
  // 6. MERGE PEOPLE
  // ---------------------------------

  describe("mergePeople", () => {
    it("returns 401 when unauthenticated", async () => {
      const { req, res } = createMocks({
        params: { personId: PERSON_ID },
        body: { sourcePersonId: SOURCE_PERSON_ID },
      });

      await mergePeople(req, res);

      expectStatus(res, 401);
    });

    it("rejects invalid person IDs", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        params: { personId: "invalid" },
        body: { sourcePersonId: SOURCE_PERSON_ID },
      });

      await mergePeople(req, res);

      expectStatus(res, 400);
      expect(mergePeopleForUser).not.toHaveBeenCalled();
    });

    it("rejects merging a person into itself", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        params: { personId: PERSON_ID },
        body: { sourcePersonId: PERSON_ID },
      });

      await mergePeople(req, res);

      expectStatus(res, 400);
      expect(mergePeopleForUser).not.toHaveBeenCalled();
    });

    it("merges people successfully", async () => {
      const result = {
        id: PERSON_ID,
        mergedPersonId: SOURCE_PERSON_ID,
        movedFaceCount: 3,
      };

      vi.mocked(mergePeopleForUser).mockResolvedValue(result as never);

      const { req, res } = createMocks({
        userId: USER_ID,
        params: { personId: PERSON_ID },
        body: { sourcePersonId: SOURCE_PERSON_ID },
      });

      await mergePeople(req, res);

      expectStatus(res, 200);
      expect(mergePeopleForUser).toHaveBeenCalledWith(
        PERSON_ID,
        SOURCE_PERSON_ID,
        USER_ID,
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "People merged successfully.",
        ...result,
      });
    });

    it("returns 404 when either person does not exist", async () => {
      vi.mocked(mergePeopleForUser).mockResolvedValue(null);

      const { req, res } = createMocks({
        userId: USER_ID,
        params: { personId: PERSON_ID },
        body: { sourcePersonId: SOURCE_PERSON_ID },
      });

      await mergePeople(req, res);

      expectStatus(res, 404);
    });
  });

  // ---------------------------------
  // 7. SPLIT PERSON
  // ---------------------------------

  describe("splitPerson", () => {
    const params = { personId: PERSON_ID };

    it("returns 401 when unauthenticated", async () => {
      const { req, res } = createMocks({
        params,
        body: { name: "Bob", faceIds: [FACE_ID] },
      });

      await splitPerson(req, res);

      expectStatus(res, 401);
    });

    it("rejects an invalid source person ID", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        params: { personId: "invalid" },
        body: { name: "Bob", faceIds: [FACE_ID] },
      });

      await splitPerson(req, res);

      expectStatus(res, 400);
    });

    it("rejects an empty name", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        params,
        body: { name: " ", faceIds: [FACE_ID] },
      });

      await splitPerson(req, res);

      expectStatus(res, 400);
    });

    it("rejects an empty face selection", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        params,
        body: { name: "Bob", faceIds: [] },
      });

      await splitPerson(req, res);

      expectStatus(res, 400);
    });

    it("rejects duplicate face IDs", async () => {
      const { req, res } = createMocks({
        userId: USER_ID,
        params,
        body: { name: "Bob", faceIds: [FACE_ID, FACE_ID] },
      });

      await splitPerson(req, res);

      expectStatus(res, 400);
    });

    it("splits a person successfully", async () => {
      const person = {
        id: SOURCE_PERSON_ID,
        name: "Bob",
        faceCount: 1,
      };

      vi.mocked(splitPersonForUser).mockResolvedValue(person as never);

      const { req, res } = createMocks({
        userId: USER_ID,
        params,
        body: {
          name: " Bob ",
          faceIds: [FACE_ID],
        },
      });

      await splitPerson(req, res);

      expectStatus(res, 201);

      expect(splitPersonForUser).toHaveBeenCalledWith({
        userId: USER_ID,
        sourcePersonId: PERSON_ID,
        newPersonName: "Bob",
        faceIds: [FACE_ID],
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Person split successfully.",
        person,
      });
    });

    it("returns 404 when source person does not exist", async () => {
      vi.mocked(splitPersonForUser).mockResolvedValue(null);

      const { req, res } = createMocks({
        userId: USER_ID,
        params,
        body: { name: "Bob", faceIds: [FACE_ID] },
      });

      await splitPerson(req, res);

      expectStatus(res, 404);
    });

    it("returns 404 when selected faces do not belong to the source person", async () => {
      vi.mocked(splitPersonForUser).mockRejectedValue({
        code: "SPLIT_FACES_NOT_FOUND",
      });

      const { req, res } = createMocks({
        userId: USER_ID,
        params,
        body: { name: "Bob", faceIds: [FACE_ID] },
      });

      await splitPerson(req, res);

      expectStatus(res, 404);
    });
  });
});
