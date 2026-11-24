import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import crypto from "node:crypto";

import { assertTestDatabase, testPool } from "../setup/test-db.js";

import {
  createTestUser,
  createTestMedia,
  createTestFace,
  type TestUser,
} from "../setup/test-helpers.js";

import { cleanupTestUsers } from "../setup/test-cleanup.js";

import {
  confirmPersonIdentity,
  getPeopleForUser,
  getPersonGalleryForUser,
  assignFaceToPersonForUser,
  removeFaceFromPersonForUser,
  mergePeopleForUser,
  splitPersonForUser,
} from "../../services/faces/people.repository.js";

describe("People repository integration tests", () => {
  let user!: TestUser;
  let otherUser!: TestUser;

  // ---------------------------------
  // DATABASE SAFETY
  // ---------------------------------

  beforeAll(async () => {
    await assertTestDatabase();
  });

  // ---------------------------------
  // FRESH USERS FOR EVERY TEST
  // ---------------------------------

  beforeEach(async () => {
    user = await createTestUser();
    otherUser = await createTestUser();
  });

  // ---------------------------------
  // TEST FIXTURES
  // ---------------------------------

  const createCompletedFace = async (userId: string, faceNumber = 1) => {
    const media = await createTestMedia(userId);

    await testPool.query(
      `
      UPDATE media_files
      SET face_processing_status = 'completed'
      WHERE id = $1
      `,
      [media.id],
    );

    return createTestFace(media.id, faceNumber);
  };

  const createPerson = async (
    userId: string,
    name: string,
    faceIds: string[],
  ) => {
    return confirmPersonIdentity({
      userId,
      name,
      faceIds,
    });
  };

  // ---------------------------------
  // CLEANUP AFTER EVERY TEST
  // ---------------------------------

  afterEach(async () => {
    await cleanupTestUsers([user.id, otherUser.id]);
  });

  // KEEP ALL YOUR EXISTING 30 TEST CASES BELOW THIS LINE

  // ---------------------------------
  // 1. CONFIRM PERSON IDENTITY
  // ---------------------------------

  it("creates a person and assigns selected faces", async () => {
    const face1 = await createCompletedFace(user.id);
    const face2 = await createCompletedFace(user.id);

    const person = await createPerson(user.id, "Alice", [face1.id, face2.id]);

    expect(person.id).toBeDefined();
    expect(person.name).toBe("Alice");
    expect(person.faceCount).toBe(2);

    const result = await testPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM person_faces
      WHERE person_id = $1
      `,
      [person.id],
    );

    expect(result.rows[0].count).toBe(2);
  });

  // ---------------------------------
  // 2. NORMALIZE PERSON NAME
  // ---------------------------------

  it("trims whitespace from person names", async () => {
    const face = await createCompletedFace(user.id);

    const person = await createPerson(user.id, "  Alice  ", [face.id]);

    expect(person.name).toBe("Alice");
  });

  // ---------------------------------
  // 3. EMPTY PERSON NAME
  // ---------------------------------

  it("rejects an empty person name", async () => {
    const face = await createCompletedFace(user.id);

    await expect(createPerson(user.id, "   ", [face.id])).rejects.toMatchObject(
      {
        code: "INVALID_PERSON_NAME",
      },
    );
  });

  // ---------------------------------
  // 4. NO FACES SELECTED
  // ---------------------------------

  it("rejects confirmation without selected faces", async () => {
    await expect(createPerson(user.id, "Alice", [])).rejects.toMatchObject({
      code: "NO_FACES_SELECTED",
    });
  });

  // ---------------------------------
  // 5. DUPLICATE FACE IDS
  // ---------------------------------

  it("rejects duplicate face IDs during confirmation", async () => {
    const face = await createCompletedFace(user.id);

    await expect(
      createPerson(user.id, "Alice", [face.id, face.id]),
    ).rejects.toMatchObject({
      code: "DUPLICATE_FACE_IDS",
    });
  });

  // ---------------------------------
  // 6. FACE OWNERSHIP
  // ---------------------------------

  it("does not allow confirming another user's face", async () => {
    const foreignFace = await createCompletedFace(otherUser.id);

    await expect(
      createPerson(user.id, "Alice", [foreignFace.id]),
    ).rejects.toMatchObject({
      code: "FACES_NOT_FOUND",
    });
  });

  // ---------------------------------
  // 7. ALREADY ASSIGNED FACE
  // ---------------------------------

  it("does not allow assigning an already confirmed face again", async () => {
    const face = await createCompletedFace(user.id);

    await createPerson(user.id, "Alice", [face.id]);

    await expect(createPerson(user.id, "Bob", [face.id])).rejects.toMatchObject(
      {
        code: "FACES_ALREADY_ASSIGNED",
      },
    );
  });

  // ---------------------------------
  // 8. DUPLICATE PERSON NAME
  // ---------------------------------

  it("rejects duplicate person names for the same user", async () => {
    const face1 = await createCompletedFace(user.id);
    const face2 = await createCompletedFace(user.id);

    await createPerson(user.id, "Alice", [face1.id]);

    await expect(
      createPerson(user.id, " alice ", [face2.id]),
    ).rejects.toMatchObject({
      code: "PERSON_NAME_ALREADY_EXISTS",
    });
  });

  // ---------------------------------
  // 9. SAME NAME FOR DIFFERENT USERS
  // ---------------------------------

  it("allows different users to have people with the same name", async () => {
    const face1 = await createCompletedFace(user.id);
    const face2 = await createCompletedFace(otherUser.id);

    const person1 = await createPerson(user.id, "Alice", [face1.id]);

    const person2 = await createPerson(otherUser.id, "Alice", [face2.id]);

    expect(person1.id).not.toBe(person2.id);
  });

  // ---------------------------------
  // 10. GET PEOPLE
  // ---------------------------------

  it("returns only the authenticated user's people", async () => {
    const face1 = await createCompletedFace(user.id);
    const face2 = await createCompletedFace(otherUser.id);

    await createPerson(user.id, "Alice", [face1.id]);
    await createPerson(otherUser.id, "Bob", [face2.id]);

    const result = await getPeopleForUser(user.id);

    expect(result.count).toBe(1);
    expect(result.people).toHaveLength(1);
    expect(result.people[0].name).toBe("Alice");
    expect(result.people[0].faceCount).toBe(1);
  });

  // ---------------------------------
  // 11. PEOPLE FACE AND PHOTO COUNTS
  // ---------------------------------

  it("returns correct face and photo counts", async () => {
    const face1 = await createCompletedFace(user.id, 1);
    const face2 = await createCompletedFace(user.id, 1);
    const face3 = await createCompletedFace(user.id, 2);

    const person = await createPerson(user.id, "Alice", [
      face1.id,
      face2.id,
      face3.id,
    ]);

    const result = await getPeopleForUser(user.id);

    const found = result.people.find((item) => item.id === person.id);

    expect(found).toBeDefined();
    expect(found?.faceCount).toBe(3);
    expect(found?.photoCount).toBe(3);
    expect(found?.representativeFaceId).toBeDefined();
  });

  // ---------------------------------
  // 12. PERSON GALLERY
  // ---------------------------------

  it("returns a person's assigned faces and gallery details", async () => {
    const face1 = await createCompletedFace(user.id);
    const face2 = await createCompletedFace(user.id);

    const person = await createPerson(user.id, "Alice", [face1.id, face2.id]);

    const gallery = await getPersonGalleryForUser(person.id, user.id);

    expect(gallery).not.toBeNull();
    expect(gallery?.person.name).toBe("Alice");
    expect(gallery?.person.faceCount).toBe(2);
    expect(gallery?.faces).toHaveLength(2);

    expect(gallery?.faces[0].cropUrl).toContain("/api/v1/faces/");
  });

  // ---------------------------------
  // 13. GALLERY OWNERSHIP
  // ---------------------------------

  it("does not expose another user's person gallery", async () => {
    const face = await createCompletedFace(otherUser.id);

    const person = await createPerson(otherUser.id, "Alice", [face.id]);

    const gallery = await getPersonGalleryForUser(person.id, user.id);

    expect(gallery).toBeNull();
  });

  // ---------------------------------
  // 14. NON-EXISTENT PERSON GALLERY
  // ---------------------------------

  it("returns null for a non-existent person gallery", async () => {
    const gallery = await getPersonGalleryForUser(crypto.randomUUID(), user.id);

    expect(gallery).toBeNull();
  });

  // ---------------------------------
  // 15. MOVE FACE
  // ---------------------------------

  it("moves a face from one person to another", async () => {
    const face1 = await createCompletedFace(user.id);
    const face2 = await createCompletedFace(user.id);

    const source = await createPerson(user.id, "Alice", [face1.id]);

    const target = await createPerson(user.id, "Bob", [face2.id]);

    const result = await assignFaceToPersonForUser(
      target.id,
      face1.id,
      user.id,
    );

    expect(result).toBe("assigned");

    const assignment = await testPool.query(
      `
      SELECT person_id
      FROM person_faces
      WHERE face_id = $1
      `,
      [face1.id],
    );

    expect(assignment.rows[0].person_id).toBe(target.id);

    const sourceExists = await testPool.query(
      `
      SELECT id FROM people WHERE id = $1
      `,
      [source.id],
    );

    expect(sourceExists.rowCount).toBe(0);
  });

  // ---------------------------------
  // 16. ALREADY ASSIGNED TO TARGET
  // ---------------------------------

  it("returns already_assigned when face belongs to target person", async () => {
    const face = await createCompletedFace(user.id);

    const person = await createPerson(user.id, "Alice", [face.id]);

    const result = await assignFaceToPersonForUser(person.id, face.id, user.id);

    expect(result).toBe("already_assigned");
  });

  // ---------------------------------
  // 17. INVALID MOVE TARGET
  // ---------------------------------

  it("returns null when moving a face to a non-existent person", async () => {
    const face = await createCompletedFace(user.id);

    const result = await assignFaceToPersonForUser(
      crypto.randomUUID(),
      face.id,
      user.id,
    );

    expect(result).toBeNull();
  });

  // ---------------------------------
  // 18. FOREIGN FACE MOVE
  // ---------------------------------

  it("does not allow moving another user's face", async () => {
    const foreignFace = await createCompletedFace(otherUser.id);
    const ownFace = await createCompletedFace(user.id);

    const person = await createPerson(user.id, "Alice", [ownFace.id]);

    const result = await assignFaceToPersonForUser(
      person.id,
      foreignFace.id,
      user.id,
    );

    expect(result).toBeNull();
  });

  // ---------------------------------
  // 19. REMOVE FACE
  // ---------------------------------

  it("removes a face assignment without deleting other assignments", async () => {
    const face1 = await createCompletedFace(user.id);
    const face2 = await createCompletedFace(user.id);

    const person = await createPerson(user.id, "Alice", [face1.id, face2.id]);

    const result = await removeFaceFromPersonForUser(
      person.id,
      face1.id,
      user.id,
    );

    expect(result).toBe(true);

    const remaining = await testPool.query(
      `
      SELECT face_id
      FROM person_faces
      WHERE person_id = $1
      `,
      [person.id],
    );

    expect(remaining.rowCount).toBe(1);
    expect(remaining.rows[0].face_id).toBe(face2.id);
  });

  // ---------------------------------
  // 20. REMOVE LAST FACE
  // ---------------------------------

  it("deletes a person automatically after removing their last face", async () => {
    const face = await createCompletedFace(user.id);

    const person = await createPerson(user.id, "Alice", [face.id]);

    const result = await removeFaceFromPersonForUser(
      person.id,
      face.id,
      user.id,
    );

    expect(result).toBe(true);

    const personResult = await testPool.query(
      `
      SELECT id FROM people WHERE id = $1
      `,
      [person.id],
    );

    expect(personResult.rowCount).toBe(0);
  });

  // ---------------------------------
  // 21. REMOVE NON-ASSIGNED FACE
  // ---------------------------------

  it("returns false when the face is not assigned to the person", async () => {
    const face1 = await createCompletedFace(user.id);
    const face2 = await createCompletedFace(user.id);

    const person = await createPerson(user.id, "Alice", [face1.id]);

    const result = await removeFaceFromPersonForUser(
      person.id,
      face2.id,
      user.id,
    );

    expect(result).toBe(false);
  });

  // ---------------------------------
  // 22. MERGE PEOPLE
  // ---------------------------------

  it("merges source faces into target and deletes the source person", async () => {
    const face1 = await createCompletedFace(user.id);
    const face2 = await createCompletedFace(user.id);

    const target = await createPerson(user.id, "Alice", [face1.id]);

    const source = await createPerson(user.id, "Bob", [face2.id]);

    const result = await mergePeopleForUser(target.id, source.id, user.id);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(target.id);
    expect(result?.mergedPersonId).toBe(source.id);
    expect(result?.movedFaceCount).toBe(1);

    const assignments = await testPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM person_faces
      WHERE person_id = $1
      `,
      [target.id],
    );

    expect(assignments.rows[0].count).toBe(2);

    const sourceResult = await testPool.query(
      `
      SELECT id FROM people WHERE id = $1
      `,
      [source.id],
    );

    expect(sourceResult.rowCount).toBe(0);
  });

  // ---------------------------------
  // 23. MERGE PERSON INTO ITSELF
  // ---------------------------------

  it("rejects merging a person into itself", async () => {
    const face = await createCompletedFace(user.id);

    const person = await createPerson(user.id, "Alice", [face.id]);

    await expect(
      mergePeopleForUser(person.id, person.id, user.id),
    ).rejects.toMatchObject({
      code: "SAME_PERSON",
    });
  });

  // ---------------------------------
  // 24. MERGE FOREIGN PERSON
  // ---------------------------------

  it("does not allow merging another user's person", async () => {
    const ownFace = await createCompletedFace(user.id);
    const foreignFace = await createCompletedFace(otherUser.id);

    const target = await createPerson(user.id, "Alice", [ownFace.id]);

    const source = await createPerson(otherUser.id, "Bob", [foreignFace.id]);

    const result = await mergePeopleForUser(target.id, source.id, user.id);

    expect(result).toBeNull();
  });

  // ---------------------------------
  // 25. SPLIT PERSON
  // ---------------------------------

  it("splits selected faces into a new person", async () => {
    const face1 = await createCompletedFace(user.id);
    const face2 = await createCompletedFace(user.id);
    const face3 = await createCompletedFace(user.id);

    const source = await createPerson(user.id, "Alice", [
      face1.id,
      face2.id,
      face3.id,
    ]);

    const newPerson = await splitPersonForUser({
      userId: user.id,
      sourcePersonId: source.id,
      newPersonName: "Bob",
      faceIds: [face1.id],
    });

    expect(newPerson).not.toBeNull();
    expect(newPerson?.name).toBe("Bob");
    expect(newPerson?.faceCount).toBe(1);

    const sourceGallery = await getPersonGalleryForUser(source.id, user.id);

    const newGallery = await getPersonGalleryForUser(newPerson!.id, user.id);

    expect(sourceGallery?.faces).toHaveLength(2);
    expect(newGallery?.faces).toHaveLength(1);
    expect(newGallery?.faces[0].faceId).toBe(face1.id);
  });

  // ---------------------------------
  // 26. SPLIT ALL FACES
  // ---------------------------------

  it("deletes the source person when all faces are split", async () => {
    const face1 = await createCompletedFace(user.id);
    const face2 = await createCompletedFace(user.id);

    const source = await createPerson(user.id, "Alice", [face1.id, face2.id]);

    const newPerson = await splitPersonForUser({
      userId: user.id,
      sourcePersonId: source.id,
      newPersonName: "Bob",
      faceIds: [face1.id, face2.id],
    });

    expect(newPerson?.faceCount).toBe(2);

    const sourceResult = await testPool.query(
      `
      SELECT id FROM people WHERE id = $1
      `,
      [source.id],
    );

    expect(sourceResult.rowCount).toBe(0);
  });

  // ---------------------------------
  // 27. SPLIT EMPTY FACE SELECTION
  // ---------------------------------

  it("rejects splitting without selected faces", async () => {
    const face = await createCompletedFace(user.id);

    const source = await createPerson(user.id, "Alice", [face.id]);

    await expect(
      splitPersonForUser({
        userId: user.id,
        sourcePersonId: source.id,
        newPersonName: "Bob",
        faceIds: [],
      }),
    ).rejects.toMatchObject({
      code: "NO_FACES_SELECTED",
    });
  });

  // ---------------------------------
  // 28. SPLIT DUPLICATE FACE IDS
  // ---------------------------------

  it("rejects duplicate face IDs during split", async () => {
    const face = await createCompletedFace(user.id);

    const source = await createPerson(user.id, "Alice", [face.id]);

    await expect(
      splitPersonForUser({
        userId: user.id,
        sourcePersonId: source.id,
        newPersonName: "Bob",
        faceIds: [face.id, face.id],
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_FACE_IDS",
    });
  });

  // ---------------------------------
  // 29. SPLIT FACE NOT BELONGING TO SOURCE
  // ---------------------------------

  it("rejects splitting a face belonging to another person", async () => {
    const face1 = await createCompletedFace(user.id);
    const face2 = await createCompletedFace(user.id);

    const source = await createPerson(user.id, "Alice", [face1.id]);

    await createPerson(user.id, "Bob", [face2.id]);

    await expect(
      splitPersonForUser({
        userId: user.id,
        sourcePersonId: source.id,
        newPersonName: "Charlie",
        faceIds: [face2.id],
      }),
    ).rejects.toMatchObject({
      code: "SPLIT_FACES_NOT_FOUND",
    });
  });

  // ---------------------------------
  // 30. SPLIT FOREIGN PERSON
  // ---------------------------------

  it("does not allow splitting another user's person", async () => {
    const face = await createCompletedFace(otherUser.id);

    const source = await createPerson(otherUser.id, "Alice", [face.id]);

    const result = await splitPersonForUser({
      userId: user.id,
      sourcePersonId: source.id,
      newPersonName: "Bob",
      faceIds: [face.id],
    });

    expect(result).toBeNull();
  });
});
