import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { assertTestDatabase, testPool } from "../setup/test-db.js";
import {
  createTestUser,
  createTestMedia,
  createTestFace,
  type TestUser,
} from "../setup/test-helpers.js";
import { cleanupTestUsers } from "../setup/test-cleanup.js";

import { findFaceGroups } from "../../services/faces/face.repository.js";
import { confirmPersonIdentity } from "../../services/faces/people.repository.js";

describe("Face grouping integration tests", () => {
  let user!: TestUser;
  let otherUser!: TestUser;

  beforeAll(async () => {
    await assertTestDatabase();
  });

  beforeEach(async () => {
    user = await createTestUser();
    otherUser = await createTestUser();
  });

  afterEach(async () => {
    await cleanupTestUsers([user.id, otherUser.id]);
  });

  // ---------------------------------
  // TEST FIXTURES
  // ---------------------------------

  const createCompletedMedia = async (userId: string) => {
    const media = await createTestMedia(userId);

    await testPool.query(
      `
      UPDATE media_files
      SET face_processing_status = 'completed'
      WHERE id = $1
      `,
      [media.id],
    );

    return media;
  };

  // Creates a 128-dimensional unit vector at the given angle.
  // This lets tests control cosine similarity between faces.
  const createEmbedding = (angleDegrees: number): number[] => {
    const radians = (angleDegrees * Math.PI) / 180;
    const embedding = Array(128).fill(0);

    embedding[0] = Math.cos(radians);
    embedding[1] = Math.sin(radians);

    return embedding;
  };

  const createFaceInMedia = async (
    mediaId: string,
    faceNumber: number,
    angleDegrees = 0,
  ) => {
    const face = await createTestFace(mediaId, faceNumber);
    const embedding = createEmbedding(angleDegrees);

    await testPool.query(
      `
      UPDATE detected_faces
      SET embedding = $1::vector
      WHERE id = $2
      `,
      [`[${embedding.join(",")}]`, face.id],
    );

    return face;
  };

  const createCompletedFace = async (
    userId: string,
    faceNumber = 1,
    angleDegrees = 0,
  ) => {
    const media = await createCompletedMedia(userId);

    const face = await createFaceInMedia(media.id, faceNumber, angleDegrees);

    return { ...face, mediaId: media.id };
  };

  // ---------------------------------
  // 1. EMPTY COLLECTION
  // ---------------------------------

  it("returns an empty result when the user has no faces", async () => {
    const result = await findFaceGroups(user.id);

    expect(result).toEqual({
      threshold: 0.45,
      totalFaces: 0,
      groupedFaces: 0,
      ungroupedFaces: 0,
      groupCount: 0,
      groups: [],
    });
  });

  // ---------------------------------
  // 2. SINGLE FACE
  // ---------------------------------

  it("returns one ungrouped face when only one face exists", async () => {
    await createCompletedFace(user.id);

    const result = await findFaceGroups(user.id);

    expect(result.totalFaces).toBe(1);
    expect(result.groupedFaces).toBe(0);
    expect(result.ungroupedFaces).toBe(1);
    expect(result.groupCount).toBe(0);
    expect(result.groups).toHaveLength(0);
  });

  // ---------------------------------
  // 3. SIMILAR FACES
  // ---------------------------------

  it("groups highly similar faces from different photos", async () => {
    await createCompletedFace(user.id, 1, 0);
    await createCompletedFace(user.id, 1, 0);

    const result = await findFaceGroups(user.id);

    expect(result.totalFaces).toBe(2);
    expect(result.groupedFaces).toBe(2);
    expect(result.ungroupedFaces).toBe(0);
    expect(result.groupCount).toBe(1);

    expect(result.groups[0].faceCount).toBe(2);
    expect(result.groups[0].photoCount).toBe(2);
    expect(result.groups[0].groupId).toBe("candidate-1");
  });

  // ---------------------------------
  // 4. UNRELATED FACES
  // ---------------------------------

  it("does not group faces below the similarity threshold", async () => {
    await createCompletedFace(user.id, 1, 0);
    await createCompletedFace(user.id, 1, 90);

    const result = await findFaceGroups(user.id, 0.45);

    expect(result.totalFaces).toBe(2);
    expect(result.groupedFaces).toBe(0);
    expect(result.ungroupedFaces).toBe(2);
    expect(result.groupCount).toBe(0);
    expect(result.groups).toHaveLength(0);
  });

  // ---------------------------------
  // 5. SAME PHOTO PROTECTION
  // ---------------------------------

  it("never puts two faces from the same photo in one group", async () => {
    const media = await createCompletedMedia(user.id);

    await createFaceInMedia(media.id, 1, 0);
    await createFaceInMedia(media.id, 2, 0);

    await createCompletedFace(user.id, 1, 0);

    const result = await findFaceGroups(user.id);

    expect(result.totalFaces).toBe(3);
    expect(result.groupedFaces).toBe(2);
    expect(result.ungroupedFaces).toBe(1);
    expect(result.groupCount).toBe(1);

    const group = result.groups[0];

    expect(group.faceCount).toBe(2);
    expect(group.photoCount).toBe(2);

    const mediaIds = group.members.map((member) => member.mediaFileId);

    expect(new Set(mediaIds).size).toBe(mediaIds.length);
  });

  // ---------------------------------
  // 6. COMPLETE-LINK SAFEGUARD
  // ---------------------------------

  it("does not merge groups when every cross-group pair does not meet the threshold", async () => {
    // A-B similarity: approximately 0.94
    // B-C similarity: approximately 0.94
    // A-C similarity: approximately 0.77
    //
    // With threshold 0.80, all three must not become one group.

    await createCompletedFace(user.id, 1, 0);
    await createCompletedFace(user.id, 1, 20);
    await createCompletedFace(user.id, 1, 40);

    const result = await findFaceGroups(user.id, 0.8);

    expect(result.totalFaces).toBe(3);
    expect(result.groupedFaces).toBe(2);
    expect(result.ungroupedFaces).toBe(1);
    expect(result.groupCount).toBe(1);

    expect(result.groups[0].faceCount).toBe(2);
  });

  // ---------------------------------
  // 7. USER DATA ISOLATION
  // ---------------------------------

  it("does not include another user's faces", async () => {
    await createCompletedFace(user.id, 1, 0);

    await createCompletedFace(otherUser.id, 1, 0);
    await createCompletedFace(otherUser.id, 1, 0);

    const result = await findFaceGroups(user.id);

    expect(result.totalFaces).toBe(1);
    expect(result.groupedFaces).toBe(0);
    expect(result.ungroupedFaces).toBe(1);
    expect(result.groupCount).toBe(0);
  });

  // ---------------------------------
  // 8. ONLY COMPLETED FACE PROCESSING
  // ---------------------------------

  it("ignores faces whose media face processing is not completed", async () => {
    await createCompletedFace(user.id);

    const pendingMedia = await createTestMedia(user.id);
    await createTestFace(pendingMedia.id);

    const result = await findFaceGroups(user.id);

    expect(result.totalFaces).toBe(1);
    expect(result.ungroupedFaces).toBe(1);
    expect(result.groupCount).toBe(0);
  });

  // ---------------------------------
  // 9. CONFIRMED FACES EXCLUDED
  // ---------------------------------

  it("does not include faces already assigned to a confirmed person", async () => {
    const confirmedFace = await createCompletedFace(user.id);
    await createCompletedFace(user.id);

    await confirmPersonIdentity({
      userId: user.id,
      name: "Alice",
      faceIds: [confirmedFace.id],
    });

    const result = await findFaceGroups(user.id);

    expect(result.totalFaces).toBe(1);
    expect(result.groupedFaces).toBe(0);
    expect(result.ungroupedFaces).toBe(1);
    expect(result.groupCount).toBe(0);
  });

  // ---------------------------------
  // 10. GROUP MEMBER DETAILS
  // ---------------------------------

  it("returns the expected metadata for grouped faces", async () => {
    await createCompletedFace(user.id, 1, 0);
    await createCompletedFace(user.id, 1, 0);

    const result = await findFaceGroups(user.id);

    const group = result.groups[0];

    expect(group).toBeDefined();
    expect(group.groupId).toBe("candidate-1");

    for (const member of group.members) {
      expect(member.faceId).toBeDefined();
      expect(member.mediaFileId).toBeDefined();
      expect(member.filename).toBeDefined();
      expect(member.cropUrl).toContain("/api/v1/faces/");
      expect(member.faceNumber).toBe(1);
      expect(member.detectionConfidence).toBe(0.95);
      expect(member.maxSimilarityToGroup).toBeCloseTo(1, 5);
    }
  });

  // ---------------------------------
  // 11. CUSTOM THRESHOLD
  // ---------------------------------

  it("returns the requested similarity threshold", async () => {
    await createCompletedFace(user.id, 1, 0);
    await createCompletedFace(user.id, 1, 20);

    const result = await findFaceGroups(user.id, 0.9);

    expect(result.threshold).toBe(0.9);
    expect(result.totalFaces).toBe(2);
    expect(result.groupCount).toBe(1);
  });

  // ---------------------------------
  // 12. GROUPING DOES NOT CONFIRM IDENTITIES
  // ---------------------------------

  it("does not persist candidate groups as confirmed people", async () => {
    await createCompletedFace(user.id, 1, 0);
    await createCompletedFace(user.id, 1, 0);

    const result = await findFaceGroups(user.id);

    expect(result.groupCount).toBe(1);

    const peopleResult = await testPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM people
      WHERE user_id = $1
      `,
      [user.id],
    );

    const assignmentsResult = await testPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM person_faces pf
      INNER JOIN people p ON p.id = pf.person_id
      WHERE p.user_id = $1
      `,
      [user.id],
    );

    expect(peopleResult.rows[0].count).toBe(0);
    expect(assignmentsResult.rows[0].count).toBe(0);
  });
});
