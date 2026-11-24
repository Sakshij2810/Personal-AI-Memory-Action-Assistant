import { useState } from "react";
import {
  FiUsers,
  FiRefreshCw,
  FiAlertCircle,
  FiImage,
  FiGitMerge,
  FiX,
} from "react-icons/fi";

import { usePeople } from "../../hooks/usePeople";
import { useMergePeople } from "../../hooks/useMergePeople";

interface PeopleDirectoryProps {
  onSelectPerson: (personId: string) => void;
}

const PeopleDirectory = ({ onSelectPerson }: PeopleDirectoryProps) => {
  const { data, isPending, isError, isFetching, refetch } = usePeople();
  const mergeMutation = useMergePeople();

  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [targetPersonId, setTargetPersonId] = useState("");
  const [sourcePersonId, setSourcePersonId] = useState("");

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const people = data?.people ?? [];

  const targetPerson = people.find((person) => person.id === targetPersonId);

  const sourcePerson = people.find((person) => person.id === sourcePersonId);

  const openMergeModal = (personId: string) => {
    setTargetPersonId(personId);
    setSourcePersonId("");
    setIsMergeOpen(true);
  };

  const closeMergeModal = () => {
    if (mergeMutation.isPending) return;

    setIsMergeOpen(false);
    setTargetPersonId("");
    setSourcePersonId("");
    mergeMutation.reset();
  };

  const handleMerge = async () => {
    if (!targetPersonId || !sourcePersonId) return;

    try {
      const result = await mergeMutation.mutateAsync({
        targetPersonId,
        sourcePersonId,
      });

      setIsMergeOpen(false);
      setTargetPersonId("");
      setSourcePersonId("");

      await refetch();

      window.alert(`${result.message} ${result.movedFaceCount} faces moved.`);
    } catch (error) {
      console.error("Failed to merge people:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FiUsers size={22} className="text-gray-700" />
              <h1 className="text-2xl font-bold text-gray-900">Your People</h1>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              People whose identities you have confirmed.
            </p>
          </div>

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

        {data && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Confirmed people</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {data.count}
            </p>
          </div>
        )}

        {isPending && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="mx-auto h-32 w-32 rounded-xl bg-gray-200" />
                <div className="mx-auto mt-4 h-5 w-28 rounded bg-gray-200" />
                <div className="mx-auto mt-2 h-4 w-36 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-100 bg-white p-10 text-center">
            <FiAlertCircle className="mx-auto mb-3 text-3xl text-red-500" />
            <p className="font-semibold text-gray-800">Unable to load people</p>
            <p className="mt-2 text-sm text-gray-500">
              Please check your connection and try again.
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

        {!isPending && !isError && people.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-20 text-center">
            <FiImage className="mx-auto mb-4 text-4xl text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-800">
              No confirmed people yet
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Confirm identities from the People Recognition page to see them
              here.
            </p>
          </div>
        )}

        {!isPending && !isError && people.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {people.map((person) => (
              <div
                key={person.id}
                className="rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => onSelectPerson(person.id)}
                  className="w-full"
                >
                  <div className="mx-auto h-32 w-32 overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                    {person.representativeFaceId ? (
                      <img
                        src={`${backendUrl}/api/v1/faces/${person.representativeFaceId}/image`}
                        alt={person.name}
                        crossOrigin="use-credentials"
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <FiUsers className="text-4xl text-gray-300" />
                      </div>
                    )}
                  </div>

                  <h2 className="mt-4 truncate text-lg font-semibold text-gray-900">
                    {person.name}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {person.faceCount} faces · {person.photoCount} photos
                  </p>

                  <p className="mt-4 text-xs font-medium text-gray-500">
                    View gallery →
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => openMergeModal(person.id)}
                  disabled={people.length < 2 || mergeMutation.isPending}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FiGitMerge />
                  Merge person
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isMergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Merge people</h2>

              <button
                type="button"
                onClick={closeMergeModal}
                disabled={mergeMutation.isPending}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <FiX size={20} />
              </button>
            </div>

            <p className="mb-5 text-sm text-gray-600">
              Select the person whose identity you want to keep. The other
              person's faces will be moved into that person.
            </p>

            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Person to keep
            </label>

            <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="font-medium text-gray-900">
                {targetPerson?.name ?? "Selected person"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {targetPerson?.faceCount ?? 0} faces · This identity will remain
              </p>
            </div>

            <label
              htmlFor="source-person"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Person to merge into {targetPerson?.name ?? "this person"}
            </label>

            <select
              id="source-person"
              value={sourcePersonId}
              onChange={(event) => {
                setSourcePersonId(event.target.value);
                mergeMutation.reset();
              }}
              disabled={mergeMutation.isPending}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-black"
            >
              <option value="">Select a person</option>
              {people
                .filter((person) => person.id !== targetPersonId)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} ({person.faceCount} faces)
                  </option>
                ))}
            </select>

            {sourcePerson && (
              <div className="mt-3 rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-900">
                  {sourcePerson.name}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {sourcePerson.faceCount} faces · This identity will be removed
                  after merging
                </p>
              </div>
            )}

            {mergeMutation.isError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Merge failed. Please try again.
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeMergeModal}
                disabled={mergeMutation.isPending}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!sourcePerson) return;

                  const confirmed = window.confirm(
                    `Merge "${sourcePerson.name}" into "${targetPerson?.name}"? The source person will be removed, but all its faces will be preserved under the target person.`,
                  );

                  if (confirmed) void handleMerge();
                }}
                disabled={!sourcePersonId || mergeMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiGitMerge />
                {mergeMutation.isPending ? "Merging..." : "Merge people"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeopleDirectory;
