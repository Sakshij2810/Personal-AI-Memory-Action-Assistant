// backend/services/faces/types.ts

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedFaceInput {
  faceNumber: number;
  boundingBox: FaceBoundingBox;
  detectionConfidence: number;
  embedding: number[];
  cropKey: string;
}

export interface SimilarFace {
  faceId: string;
  mediaFileId: string;
  filename: string;
  thumbnailKey: string | null;
  faceNumber: number;
  boundingBox: FaceBoundingBox;
  detectionConfidence: number;
  similarity: number;
}

export interface FaceSimilaritySearchResult {
  anchorFaceId: string;
  matches: SimilarFace[];
}

export interface FaceGroupMember {
  faceId: string;
  mediaFileId: string;
  filename: string;
  thumbnailKey: string | null;
  cropUrl: string;
  faceNumber: number;
  boundingBox: FaceBoundingBox;
  detectionConfidence: number;
  maxSimilarityToGroup: number;
}

export interface FaceCandidateGroup {
  groupId: string;
  faceCount: number;
  photoCount: number;
  members: FaceGroupMember[];
}

export interface FaceGroupingResult {
  threshold: number;
  totalFaces: number;
  groupedFaces: number;
  ungroupedFaces: number;
  groupCount: number;
  groups: FaceCandidateGroup[];
}

export interface FaceRecord {
  faceId: string;
  mediaFileId: string;
  filename: string;
  thumbnailKey: string | null;
  faceNumber: number;
  boundingBox: FaceBoundingBox;
  detectionConfidence: number;
}

export interface FacePair {
  faceId1: string;
  faceId2: string;
  similarity: number;
}

//

export interface ConfirmPersonInput {
  userId: string;
  name: string;
  faceIds: string[];
}

export interface ConfirmedPerson {
  id: string;
  name: string;
  createdAt: Date;
  faceCount: number;
}

export interface PersonSummary {
  id: string;
  name: string;
  faceCount: number;
  photoCount: number;
  representativeFaceId: string | null;
  createdAt: Date;
}

export interface PersonGalleryFace {
  faceId: string;
  mediaFileId: string;
  filename: string;
  faceNumber: number;
  cropUrl: string;
  uploadedAt: Date;
}

export interface PersonGallery {
  person: {
    id: string;
    name: string;
    faceCount: number;
    photoCount: number;
    createdAt: Date;
  };
  faces: PersonGalleryFace[];
}

// people repository

export interface SplitPersonInput {
  userId: string;
  sourcePersonId: string;
  newPersonName: string;
  faceIds: string[];
}
