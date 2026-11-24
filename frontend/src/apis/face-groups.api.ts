// frontend/src/apis/face-groups.api.ts
import api from "../utils/axios";
import type {
  AssignFaceResponse,
  ConfirmPersonInput,
  ConfirmPersonResponse,
  FaceGroupsResponse,
  MergePersonInput,
  MergePersonResponse,
  PeopleResponse,
  PersonGalleryResponse,
  RemoveFaceResponse,
  SplitPersonInput,
  SplitPersonResponse,
} from "./types";

export const fetchFaceGroups = async (
  minSimilarity = 0.45,
): Promise<FaceGroupsResponse> => {
  const { data } = await api.get<FaceGroupsResponse>("/api/v1/faces/groups", {
    params: { minSimilarity },
  });

  return data;
};

export const confirmPerson = async (
  payload: ConfirmPersonInput,
): Promise<ConfirmPersonResponse> => {
  const { data } = await api.post<ConfirmPersonResponse>(
    "/api/v1/faces/people/confirm",
    payload,
  );

  return data;
};

export const fetchPeople = async (): Promise<PeopleResponse> => {
  const { data } = await api.get<PeopleResponse>("/api/v1/faces/people");

  return data;
};

export const fetchPersonGallery = async (
  personId: string,
): Promise<PersonGalleryResponse> => {
  const { data } = await api.get<PersonGalleryResponse>(
    `/api/v1/faces/people/${personId}/gallery`,
  );

  return data;
};

export const splitPerson = async (
  personId: string,
  payload: SplitPersonInput,
): Promise<SplitPersonResponse> => {
  const { data } = await api.post<SplitPersonResponse>(
    `/api/v1/faces/people/${personId}/split`,
    payload,
  );

  return data;
};

export const assignFaceToPerson = async (
  targetPersonId: string,
  faceId: string,
): Promise<AssignFaceResponse> => {
  const { data } = await api.patch<AssignFaceResponse>(
    `/api/v1/faces/people/${targetPersonId}/faces/${faceId}`,
  );

  return data;
};

export const removeFaceFromPerson = async (
  personId: string,
  faceId: string,
): Promise<RemoveFaceResponse> => {
  const { data } = await api.delete<RemoveFaceResponse>(
    `/api/v1/faces/people/${personId}/faces/${faceId}`,
  );

  return data;
};

export const mergePeople = async (
  targetPersonId: string,
  payload: MergePersonInput,
): Promise<MergePersonResponse> => {
  const { data } = await api.post<MergePersonResponse>(
    `/api/v1/faces/people/${targetPersonId}/merge`,
    payload,
  );

  return data;
};
