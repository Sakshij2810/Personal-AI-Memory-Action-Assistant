import { useState } from "react";
import {
  FiUsers,
  FiRefreshCw,
  FiImage,
  FiAlertCircle,
  FiChevronDown,
} from "react-icons/fi";

import { useFaceGroups } from "../../hooks/useFaceGroups";
import { useConfirmPerson } from "../../hooks/useConfirmPerson";

import type { FaceCandidateGroup, FaceGroupMember } from "../../apis/types";

const getRepresentativeMember = (
  group: FaceCandidateGroup,
): FaceGroupMember | undefined => {
  if (group.members.length === 0) return undefined;

  const seed = group.members.reduce((hash, member) => {
    for (let i = 0; i < member.faceId.length; i++) {
      hash = (hash * 31 + member.faceId.charCodeAt(i)) >>> 0;
    }
    return hash;
  }, 0);

  return group.members[seed % group.members.length];
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "response" in error) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string;
          };
        };
      }
    ).response;

    if (response?.data?.message) {
      return response.data.message;
    }
  }

  if (error instanceof Error) return error.message;

  return "Something went wrong. Please try again.";
};

const PeopleRecognition = () => {
  const [threshold, setThreshold] = useState(0.45);
  const [selectedGroup, setSelectedGroup] = useState<FaceCandidateGroup | null>(
    null,
  );
  const [personName, setPersonName] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const { data, isPending, isError, isFetching, refetch } =
    useFaceGroups(threshold);

  const confirmPersonMutation = useConfirmPerson();

  const isSubmitting = confirmPersonMutation.isPending;

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const getFaceImageUrl = (member: FaceGroupMember) =>
    `${backendUrl}${member.cropUrl}`;

  const getOriginalImageUrl = (mediaFileId: string) =>
    `${backendUrl}/api/v1/media/${mediaFileId}/thumbnail`;

  const closeModal = () => {
    if (isSubmitting) return;

    setSelectedGroup(null);
    setPersonName("");
    setSubmitError("");
  };

  const handleConfirmPerson = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!selectedGroup || isSubmitting) return;

    const name = personName.trim();

    if (name.length < 1 || name.length > 100) {
      setSubmitError("Name must contain between 1 and 100 characters.");
      return;
    }

    const faceIds = selectedGroup.members.map((member) => member.faceId);

    if (faceIds.length < 2 || faceIds.length > 200) {
      setSubmitError("This group contains an invalid number of faces.");
      return;
    }

    if (new Set(faceIds).size !== faceIds.length) {
      setSubmitError("This group contains duplicate faces.");
      return;
    }

    setSubmitError("");
    setSubmitSuccess("");

    try {
      const result = await confirmPersonMutation.mutateAsync({
        name,
        faceIds,
      });

      setSubmitSuccess(result.message || `${name} was successfully confirmed.`);

      setSelectedGroup(null);
      setPersonName("");
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  };

  const renderGroupPhoto = (member: FaceGroupMember) => (
    <div
      key={member.faceId}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <div className="aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={getOriginalImageUrl(member.mediaFileId)}
          alt={`Photo containing face ${member.faceNumber}`}
          crossOrigin="use-credentials"
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="p-3">
        <p className="truncate text-xs font-medium text-gray-800">
          {member.filename}
        </p>

        <p className="mt-1 text-xs text-gray-400">Face #{member.faceNumber}</p>

        <p className="mt-1 text-xs text-gray-500">
          Similarity: {(member.maxSimilarityToGroup * 100).toFixed(1)}%
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FiUsers className="text-gray-700" size={22} />
              <h1 className="text-2xl font-bold text-gray-900">
                People Recognition
              </h1>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Review faces that may belong to the same person. You decide who
              they are.
            </p>
          </div>

          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            <FiRefreshCw className={isFetching ? "animate-spin" : ""} />
            Refresh groups
          </button>
        </div>

        {submitSuccess && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {submitSuccess}
          </div>
        )}

        {data && (
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Detected faces", value: data.totalFaces },
              { label: "Candidate groups", value: data.groupCount },
              { label: "Grouped faces", value: data.groupedFaces },
              { label: "Ungrouped faces", value: data.ungroupedFaces },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-gray-200 bg-white p-5"
              >
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              Similarity threshold
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Higher values produce stricter candidate groups.
            </p>
          </div>

          <div className="relative">
            <select
              value={threshold}
              onChange={(event) => {
                setThreshold(Number(event.target.value));
                setSelectedGroup(null);
                setPersonName("");
                setSubmitError("");
                setSubmitSuccess("");
              }}
              className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-9 text-sm text-gray-800 outline-none focus:border-gray-500"
            >
              <option value={0.3}>30% — More matches</option>
              <option value={0.45}>45% — Balanced</option>
              <option value={0.6}>60% — Strict</option>
            </select>

            <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {isPending && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="mb-4 h-5 w-32 rounded bg-gray-200" />
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, imageIndex) => (
                    <div
                      key={imageIndex}
                      className="aspect-square rounded-lg bg-gray-200"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-100 bg-white p-10 text-center">
            <FiAlertCircle className="mx-auto mb-3 text-3xl text-red-500" />
            <p className="font-semibold text-gray-800">
              Unable to load face groups
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Please check your backend and try again.
            </p>
            <button
              onClick={() => void refetch()}
              className="mt-5 rounded-lg bg-black px-4 py-2 text-sm text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!isPending && !isError && data && data.groups.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-20 text-center">
            <FiImage className="mx-auto mb-4 text-4xl text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-800">
              No candidate groups found
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Upload more photographs containing faces to discover potential
              matches.
            </p>
          </div>
        )}

        {!isPending && !isError && data && data.groups.length > 0 && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Unknown people
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {data.groupCount} candidate groups found. These groups have not
                been assigned identities.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.groups.map((group, index) => {
                const representative = getRepresentativeMember(group);

                return (
                  <button
                    key={group.groupId}
                    type="button"
                    onClick={() => {
                      setSelectedGroup(group);
                      setPersonName("");
                      setSubmitError("");
                      setSubmitSuccess("");
                    }}
                    className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          Unknown Person {index + 1}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {group.faceCount} faces · {group.photoCount} photos
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        Needs review
                      </span>
                    </div>

                    <div className="flex justify-center">
                      <div className="h-32 w-32 overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                        {representative && (
                          <img
                            src={getFaceImageUrl(representative)}
                            alt={`Representative face for candidate group ${index + 1}`}
                            crossOrigin="use-credentials"
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                    </div>

                    <p className="mt-4 text-xs font-medium text-gray-500">
                      Review group →
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Review candidate face group"
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 md:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Review candidate group
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedGroup.faceCount} faces across{" "}
                  {selectedGroup.photoCount} photographs
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={isSubmitting}
                aria-label="Close review"
                className="rounded-lg px-3 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              These faces are AI-generated suggestions. Review them before
              confirming that they belong to the same person.
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {selectedGroup.members.map(renderGroupPhoto)}
            </div>

            <form
              onSubmit={handleConfirmPerson}
              className="border-t border-gray-200 pt-5"
            >
              <label
                htmlFor="person-name"
                className="mb-2 block text-sm font-semibold text-gray-800"
              >
                Who is this person?
              </label>

              <input
                id="person-name"
                type="text"
                value={personName}
                onChange={(event) => {
                  setPersonName(event.target.value);
                  setSubmitError("");
                }}
                placeholder="Enter a name (e.g. Mother, Father)"
                maxLength={100}
                required
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-gray-700 disabled:bg-gray-100"
              />

              {submitError && (
                <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {submitError}
                </p>
              )}

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !personName.trim()}
                  className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Confirming..." : "Confirm Person"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeopleRecognition;
