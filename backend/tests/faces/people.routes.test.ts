import express from "express";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { AddressInfo } from "node:net";

const controllerMocks = vi.hoisted(() => {
  const createHandler = (name: string) =>
    vi.fn((req: any, res: any) =>
      res.status(200).json({
        handler: name,
        params: req.params,
        query: req.query,
        body: req.body,
      }),
    );

  return {
    confirmPerson: createHandler("confirmPerson"),
    getFaceGroups: createHandler("getFaceGroups"),
    getFaceImage: createHandler("getFaceImage"),
    getSimilarFaces: createHandler("getSimilarFaces"),
    getPeople: createHandler("getPeople"),
    getPersonGallery: createHandler("getPersonGallery"),
    assignPersonFace: createHandler("assignPersonFace"),
    removePersonFace: createHandler("removePersonFace"),
    mergePeople: createHandler("mergePeople"),
    splitPerson: createHandler("splitPerson"),
  };
});

vi.mock("../../controllers/face.controller.js", () => controllerMocks);

import {
  confirmPerson,
  getFaceGroups,
  getFaceImage,
  getSimilarFaces,
  getPeople,
  getPersonGallery,
  assignPersonFace,
  removePersonFace,
  mergePeople,
  splitPerson,
} from "../../controllers/face.controller.js";

import faceRouter from "../../routes/face.routes.js";

const app = express();

app.use(express.json());
app.use("/api/v1/faces", faceRouter);

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

const USER_API = "/api/v1/faces";

const request = async (
  method: string,
  route: string,
  body?: Record<string, unknown>,
) => {
  return fetch(`${baseUrl}${route}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
};

beforeAll(async () => {
  server = app.listen(0);

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Face routes", () => {
  // ---------------------------------
  // FACE GROUPS
  // ---------------------------------

  it("GET /groups calls getFaceGroups", async () => {
    const response = await request("GET", `${USER_API}/groups`);

    expect(response.status).toBe(200);
    expect(getFaceGroups).toHaveBeenCalledOnce();

    expect(await response.json()).toMatchObject({
      handler: "getFaceGroups",
    });
  });

  // ---------------------------------
  // PEOPLE
  // ---------------------------------

  it("GET /people calls getPeople", async () => {
    const response = await request("GET", `${USER_API}/people`);

    expect(response.status).toBe(200);
    expect(getPeople).toHaveBeenCalledOnce();

    expect(await response.json()).toMatchObject({
      handler: "getPeople",
    });
  });

  it("GET /people/:personId/gallery forwards personId", async () => {
    const personId = "22222222-2222-4222-8222-222222222222";

    const response = await request(
      "GET",
      `${USER_API}/people/${personId}/gallery`,
    );

    expect(response.status).toBe(200);
    expect(getPersonGallery).toHaveBeenCalledOnce();

    expect(await response.json()).toMatchObject({
      handler: "getPersonGallery",
      params: { personId },
    });
  });

  it("POST /people/confirm calls confirmPerson and forwards body", async () => {
    const body = {
      name: "Alice",
      faceIds: [
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
      ],
    };

    const response = await request("POST", `${USER_API}/people/confirm`, body);

    expect(response.status).toBe(200);
    expect(confirmPerson).toHaveBeenCalledOnce();

    expect(await response.json()).toMatchObject({
      handler: "confirmPerson",
      body,
    });
  });

  // ---------------------------------
  // ASSIGN / REMOVE FACE
  // ---------------------------------

  it("PATCH /people/:personId/faces/:faceId calls assignPersonFace", async () => {
    const personId = "22222222-2222-4222-8222-222222222222";
    const faceId = "44444444-4444-4444-8444-444444444444";

    const response = await request(
      "PATCH",
      `${USER_API}/people/${personId}/faces/${faceId}`,
    );

    expect(response.status).toBe(200);
    expect(assignPersonFace).toHaveBeenCalledOnce();

    expect(await response.json()).toMatchObject({
      handler: "assignPersonFace",
      params: { personId, faceId },
    });
  });

  it("DELETE /people/:personId/faces/:faceId calls removePersonFace", async () => {
    const personId = "22222222-2222-4222-8222-222222222222";
    const faceId = "44444444-4444-4444-8444-444444444444";

    const response = await request(
      "DELETE",
      `${USER_API}/people/${personId}/faces/${faceId}`,
    );

    expect(response.status).toBe(200);
    expect(removePersonFace).toHaveBeenCalledOnce();

    expect(await response.json()).toMatchObject({
      handler: "removePersonFace",
      params: { personId, faceId },
    });
  });

  // ---------------------------------
  // MERGE / SPLIT
  // ---------------------------------

  it("POST /people/:personId/merge calls mergePeople", async () => {
    const personId = "22222222-2222-4222-8222-222222222222";
    const body = {
      sourcePersonId: "33333333-3333-4333-8333-333333333333",
    };

    const response = await request(
      "POST",
      `${USER_API}/people/${personId}/merge`,
      body,
    );

    expect(response.status).toBe(200);
    expect(mergePeople).toHaveBeenCalledOnce();

    expect(await response.json()).toMatchObject({
      handler: "mergePeople",
      params: { personId },
      body,
    });
  });

  it("POST /people/:personId/split calls splitPerson", async () => {
    const personId = "22222222-2222-4222-8222-222222222222";
    const body = {
      name: "Bob",
      faceIds: ["44444444-4444-4444-8444-444444444444"],
    };

    const response = await request(
      "POST",
      `${USER_API}/people/${personId}/split`,
      body,
    );

    expect(response.status).toBe(200);
    expect(splitPerson).toHaveBeenCalledOnce();

    expect(await response.json()).toMatchObject({
      handler: "splitPerson",
      params: { personId },
      body,
    });
  });

  // ---------------------------------
  // FACE IMAGE / SIMILARITY
  // ---------------------------------

  it("GET /:faceId/image calls getFaceImage", async () => {
    const faceId = "44444444-4444-4444-8444-444444444444";

    const response = await request("GET", `${USER_API}/${faceId}/image`);

    expect(response.status).toBe(200);
    expect(getFaceImage).toHaveBeenCalledOnce();

    expect(await response.json()).toMatchObject({
      handler: "getFaceImage",
      params: { faceId },
    });
  });

  it("GET /:faceId/similar calls getSimilarFaces and forwards query", async () => {
    const faceId = "44444444-4444-4444-8444-444444444444";

    const response = await request(
      "GET",
      `${USER_API}/${faceId}/similar?limit=5&minSimilarity=0.6`,
    );

    expect(response.status).toBe(200);
    expect(getSimilarFaces).toHaveBeenCalledOnce();

    expect(await response.json()).toMatchObject({
      handler: "getSimilarFaces",
      params: { faceId },
      query: {
        limit: "5",
        minSimilarity: "0.6",
      },
    });
  });

  // ---------------------------------
  // INVALID ROUTES
  // ---------------------------------

  it("returns 404 for an unknown route", async () => {
    const response = await request("GET", `${USER_API}/unknown-route`);

    expect(response.status).toBe(404);
  });

  it("does not call controllers for unsupported HTTP methods", async () => {
    const response = await request("PUT", `${USER_API}/people`);

    expect(response.status).toBe(404);
    expect(getPeople).not.toHaveBeenCalled();
  });
});
