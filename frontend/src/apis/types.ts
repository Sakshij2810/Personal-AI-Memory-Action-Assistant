export interface DeleteImageResponse {
  success: boolean;
  fileDeleted?: boolean;
  message?: string;
}

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
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

export interface FaceGroupsResponse {
  success: boolean;
  threshold: number;
  totalFaces: number;
  groupedFaces: number;
  ungroupedFaces: number;
  groupCount: number;
  groups: FaceCandidateGroup[];
}

export interface PersonSummary {
  id: string;
  name: string;
  faceCount: number;
  photoCount: number;
  representativeFaceId: string | null;
  createdAt: string;
}

export interface PeopleResponse {
  success: boolean;
  count: number;
  people: PersonSummary[];
}

export interface PersonGalleryFace {
  faceId: string;
  mediaFileId: string;
  filename: string;
  faceNumber: number;
  cropUrl: string;
  uploadedAt: string;
}

export interface PersonGalleryResponse {
  success: boolean;
  person: {
    id: string;
    name: string;
    faceCount: number;
    photoCount: number;
    createdAt: string;
  };
  faces: PersonGalleryFace[];
}

export interface ConfirmPersonInput {
  name: string;
  faceIds: string[];
}

export interface ConfirmPersonResponse {
  success: boolean;
  message: string;
  person: {
    id: string;
    name: string;
    createdAt: string;
    faceCount: number;
  };
}

export interface SplitPersonInput {
  name: string;
  faceIds: string[];
}

export interface SplitPersonResponse {
  success: boolean;
  message: string;
  person: {
    id: string;
    name: string;
    createdAt: string;
    faceCount: number;
  };
}

export interface AssignFaceResponse {
  success: boolean;
  message: string;
}
export interface RemoveFaceResponse {
  success: boolean;
  message: string;
}

export interface MergePersonInput {
  sourcePersonId: string;
}

export interface MergePersonResponse {
  success: boolean;
  message: string;
  id: string;
  mergedPersonId: string;
  movedFaceCount: number;
}
