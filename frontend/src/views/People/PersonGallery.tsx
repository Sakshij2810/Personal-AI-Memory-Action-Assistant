import { useState } from "react";

import {
  FiArrowLeft,
  FiImage,
  FiAlertCircle,
  FiRefreshCw,
  FiUsers,
  FiCheck,
  FiX,
  FiScissors,
  FiArrowRight,
  FiTrash2,
} from "react-icons/fi";

import { usePersonGallery } from "../../hooks/usePersonGallery";
import { useSplitPerson } from "../../hooks/useSplitPerson";
import { usePeople } from "../../hooks/usePeople";
import { useMoveFace } from "../../hooks/useMoveFace";
import { useRemoveFace } from "../../hooks/useRemoveFace";

interface PersonGalleryProps {
  personId: string;
  onBack: () => void;
}

const PersonGallery = ({ personId, onBack }: PersonGalleryProps) => {
  const { data, isPending, isError, isFetching, refetch } =
    usePersonGallery(personId);

  const { data: peopleData } = usePeople();

  const splitMutation = useSplitPerson(personId);
  const moveMutation = useMoveFace();
  const removeMutation = useRemoveFace();

  const [faceToRemove, setFaceToRemove] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFaceIds, setSelectedFaceIds] = useState<string[]>([]);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [faceToMove, setFaceToMove] = useState<string | null>(null);
  const [targetPersonId, setTargetPersonId] = useState("");
  const [moveError, setMoveError] = useState("");

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const availablePeople =
    peopleData?.people.filter((person) => person.id !== personId) ?? [];

  const getThumbnailUrl = (mediaFileId: string) =>
    `${backendUrl}/api/v1/media/${mediaFileId}/thumbnail`;

  const getFaceCropUrl = (cropUrl: string) => `${backendUrl}${cropUrl}`;

  const toggleFaceSelection = (faceId: string) => {
    setSelectedFaceIds((previous) =>
      previous.includes(faceId)
        ? previous.filter((id) => id !== faceId)
        : [...previous, faceId],
    );
  };

  const selectAllFaces = () => {
    if (!data) return;
    setSelectedFaceIds(data.faces.map((face) => face.faceId));
  };

  const clearSelection = () => {
    setSelectedFaceIds([]);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedFaceIds([]);
    setShowSplitDialog(false);
    setNewPersonName("");
    setErrorMessage("");
  };

  const handleSplitPerson = async () => {
    const name = newPersonName.trim();

    if (!name || name.length > 100) {
      setErrorMessage("Name must contain between 1 and 100 characters.");
      return;
    }

    if (selectedFaceIds.length === 0) {
      setErrorMessage("Select at least one face to split.");
      return;
    }

    setErrorMessage("");

    // Moving every face deletes the source person.
    const sourceWillBeEmpty = selectedFaceIds.length === data?.faces.length;

    try {
      await splitMutation.mutateAsync({
        name,
        faceIds: selectedFaceIds,
      });

      if (sourceWillBeEmpty) {
        onBack();
        return;
      }

      exitSelectionMode();
      await refetch();
    } catch (error: unknown) {
      console.error("Split person error:", error);
      setErrorMessage(
        "Unable to split this person. Please check your selection and try again.",
      );
    }
  };

  const openMoveDialog = (faceId: string) => {
    setFaceToMove(faceId);
    setTargetPersonId("");
    setMoveError("");
  };

  const closeMoveDialog = () => {
    if (moveMutation.isPending) return;

    setFaceToMove(null);
    setTargetPersonId("");
    setMoveError("");
  };

  const handleMoveFace = async () => {
    if (!faceToMove || !targetPersonId || !data) {
      setMoveError("Please select a destination person.");
      return;
    }

    setMoveError("");

    try {
      await moveMutation.mutateAsync({
        sourcePersonId: personId,
        targetPersonId,
        faceId: faceToMove,
        sourceFaceCount: data.faces.length,
      });

      setFaceToMove(null);
      setTargetPersonId("");

      // Moving the last face deletes the source person.
      if (data.faces.length === 1) {
        onBack();
      }
    } catch (error: unknown) {
      console.error("Move face error:", error);
      setMoveError("Unable to move this face. Please try again.");
    }
  };

  const openRemoveDialog = (faceId: string) => {
    setFaceToRemove(faceId);
    setRemoveError("");
  };

  const closeRemoveDialog = () => {
    if (removeMutation.isPending) return;

    setFaceToRemove(null);
    setRemoveError("");
  };

  const handleRemoveFace = async () => {
    if (!faceToRemove || !data) return;

    setRemoveError("");

    try {
      await removeMutation.mutateAsync({
        personId,
        faceId: faceToRemove,
        sourceFaceCount: data.faces.length,
      });

      setFaceToRemove(null);

      // The database trigger deletes the person when its last face is removed.
      if (data.faces.length === 1) {
        onBack();
      }
    } catch (error: unknown) {
      console.error("Remove face error:", error);
      setRemoveError("Unable to remove this face. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header actions */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <FiArrowLeft />
            Back to people
          </button>

          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <FiRefreshCw className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Loading */}
        {isPending && (
          <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-8">
            <div className="h-7 w-40 rounded bg-gray-200" />
            <div className="mt-3 h-4 w-56 rounded bg-gray-200" />
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-64 rounded-xl bg-gray-200" />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="rounded-xl border border-red-100 bg-white p-10 text-center">
            <FiAlertCircle className="mx-auto mb-3 text-3xl text-red-500" />

            <p className="font-semibold text-gray-800">
              Unable to load this person's gallery
            </p>

            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-5 rounded-lg bg-black px-4 py-2 text-sm text-white"
            >
              Try again
            </button>
          </div>
        )}

        {/* Gallery */}
        {!isPending && !isError && data && (
          <>
            {/* Person information */}
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {data.person.name}
                  </h1>

                  <p className="mt-2 text-sm text-gray-500">
                    {data.person.faceCount} detected faces across{" "}
                    {data.person.photoCount} photographs
                  </p>
                </div>

                {!selectionMode && data.faces.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectionMode(true)}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <FiScissors />
                    Split person
                  </button>
                )}
              </div>

              {/* Selection toolbar */}
              {selectionMode && (
                <div className="mt-6 border-t border-gray-100 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-800">
                        Select faces to move
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Selected faces will become a new person.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllFaces}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        Select all
                      </button>

                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-700">
                      {selectedFaceIds.length} faces selected
                    </p>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={exitSelectionMode}
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        disabled={
                          selectedFaceIds.length === 0 ||
                          splitMutation.isPending
                        }
                        onClick={() => {
                          setErrorMessage("");
                          setShowSplitDialog(true);
                        }}
                        className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FiScissors />
                        Split selected
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Empty state */}
            {data.faces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-20 text-center">
                <FiImage className="mx-auto mb-4 text-4xl text-gray-300" />

                <h2 className="text-lg font-semibold text-gray-800">
                  No photographs found
                </h2>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.faces.map((face) => {
                  const isSelected = selectedFaceIds.includes(face.faceId);

                  return (
                    <article
                      key={face.faceId}
                      onClick={() => {
                        if (selectionMode) {
                          toggleFaceSelection(face.faceId);
                        }
                      }}
                      className={`overflow-hidden rounded-xl border bg-white transition ${
                        selectionMode ? "cursor-pointer" : ""
                      } ${
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-100"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                        <img
                          src={getThumbnailUrl(face.mediaFileId)}
                          alt={face.filename}
                          crossOrigin="use-credentials"
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />

                        {selectionMode && (
                          <div className="absolute right-3 top-3">
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                                isSelected
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-white bg-white/90 text-transparent"
                              }`}
                            >
                              {isSelected && <FiCheck size={16} />}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 p-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                          <img
                            src={getFaceCropUrl(face.cropUrl)}
                            alt={`Face ${face.faceNumber}`}
                            crossOrigin="use-credentials"
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-800">
                            {face.filename}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Face #{face.faceNumber}
                          </p>

                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(face.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {!selectionMode && (
                        <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openMoveDialog(face.faceId);
                            }}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <FiArrowRight />
                            Move
                          </button>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openRemoveDialog(face.faceId);
                            }}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            <FiTrash2 />
                            Remove
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Split dialog */}
      {showSplitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="split-person-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2
                  id="split-person-title"
                  className="text-xl font-bold text-gray-900"
                >
                  Create new person
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Move {selectedFaceIds.length} selected faces into a new
                  person.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowSplitDialog(false);
                  setErrorMessage("");
                }}
                disabled={splitMutation.isPending}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <FiX size={20} />
              </button>
            </div>

            <label
              htmlFor="new-person-name"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              New person's name
            </label>

            <input
              id="new-person-name"
              type="text"
              value={newPersonName}
              onChange={(event) => {
                setNewPersonName(event.target.value);
                setErrorMessage("");
              }}
              maxLength={100}
              placeholder="Enter person's name"
              disabled={splitMutation.isPending}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black focus:ring-2 focus:ring-gray-100 disabled:bg-gray-100"
            />

            {errorMessage && (
              <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
                <FiAlertCircle />
                {errorMessage}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowSplitDialog(false);
                  setErrorMessage("");
                }}
                disabled={splitMutation.isPending}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleSplitPerson()}
                disabled={
                  splitMutation.isPending ||
                  !newPersonName.trim() ||
                  selectedFaceIds.length === 0
                }
                className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {splitMutation.isPending ? (
                  <>
                    <FiRefreshCw className="animate-spin" />
                    Splitting...
                  </>
                ) : (
                  <>
                    <FiUsers />
                    Create person
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move face dialog */}
      {faceToMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-face-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2
                  id="move-face-title"
                  className="text-xl font-bold text-gray-900"
                >
                  Move individual face
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Move this face from {data?.person.name} to another confirmed
                  person.
                </p>
              </div>

              <button
                type="button"
                onClick={closeMoveDialog}
                disabled={moveMutation.isPending}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <FiX size={20} />
              </button>
            </div>

            {availablePeople.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center">
                <FiUsers className="mx-auto mb-2 text-2xl text-gray-400" />
                <p className="text-sm font-medium text-gray-700">
                  No other confirmed people
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Confirm another person before moving this face.
                </p>
              </div>
            ) : (
              <>
                <label
                  htmlFor="target-person"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Destination person
                </label>

                <select
                  id="target-person"
                  value={targetPersonId}
                  onChange={(event) => {
                    setTargetPersonId(event.target.value);
                    setMoveError("");
                  }}
                  disabled={moveMutation.isPending}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-black focus:ring-2 focus:ring-gray-100 disabled:bg-gray-100"
                >
                  <option value="">Select a person</option>

                  {availablePeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} ({person.faceCount} faces)
                    </option>
                  ))}
                </select>

                <p className="mt-3 text-xs text-gray-500">
                  The face will be removed from the current person and added to
                  the selected person.
                </p>
              </>
            )}

            {moveError && (
              <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
                <FiAlertCircle />
                {moveError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeMoveDialog}
                disabled={moveMutation.isPending}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleMoveFace()}
                disabled={
                  moveMutation.isPending ||
                  !targetPersonId ||
                  availablePeople.length === 0
                }
                className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {moveMutation.isPending ? (
                  <>
                    <FiRefreshCw className="animate-spin" />
                    Moving...
                  </>
                ) : (
                  <>
                    <FiArrowRight />
                    Move face
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove face dialog */}
      {faceToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-face-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2
                  id="remove-face-title"
                  className="text-xl font-bold text-gray-900"
                >
                  Remove face?
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  This will remove the face from {data?.person.name}.
                </p>
              </div>

              <button
                type="button"
                onClick={closeRemoveDialog}
                disabled={removeMutation.isPending}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                The original photograph and detected face will remain in your
                media library. Only the association with this person will be
                removed.
              </p>
            </div>

            {data?.faces.length === 1 && (
              <p className="mt-3 text-sm text-red-600">
                This is the person's last face. Removing it will also remove
                this person from your People Directory.
              </p>
            )}

            {removeError && (
              <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
                <FiAlertCircle />
                {removeError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeRemoveDialog}
                disabled={removeMutation.isPending}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleRemoveFace()}
                disabled={removeMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {removeMutation.isPending ? (
                  <>
                    <FiRefreshCw className="animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <FiTrash2 />
                    Remove face
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonGallery;
