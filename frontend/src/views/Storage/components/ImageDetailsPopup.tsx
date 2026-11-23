import {
  FiCalendar,
  FiFile,
  FiHardDrive,
  FiMaximize2,
  FiRefreshCw,
  FiTag,
  FiCpu,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";
import axios from "axios";

import Popup from "../../../components/ui/Popup";
import {
  statusStyles,
  analysisStatusStyles,
  type GalleryImage,
} from "../types";
import { useMediaAnalysis } from "../../../hooks/useMediaAnalysis";

interface ImageDetailsPopupProps {
  image: GalleryImage;
  isOpen: boolean;
  onClose: () => void;
}

const ImageDetailsPopup = ({
  image,
  isOpen,
  onClose,
}: ImageDetailsPopupProps) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const imageUrl = `${backendUrl}/api/v1/media/${image.id}/file`;

  // Fetch and manage AI image analysis using TanStack Query.
  const {
    data: analysis,
    isLoading: analysisLoading, // initial loading state
    isError: hasAnalysisError,
    error: analysisQueryError,
    isPollingTimedOut: pollingTimedOut,
    refreshAnalysis,
    isFetching: analysisFetching, // any ongoing fetch
  } = useMediaAnalysis(image.id, isOpen);

  // Extract a user-friendly error message.
  const analysisError = hasAnalysisError
    ? axios.isAxiosError(analysisQueryError)
      ? analysisQueryError.response?.data?.message ||
        "Unable to fetch image analysis."
      : "Something went wrong while fetching analysis."
    : "";

  // ==================================================
  // MANUAL ANALYSIS REFRESH
  // ==================================================

  const handleRefreshAnalysis = () => {
    void refreshAnalysis();
  };

  // ==================================================
  // FORMAT FILE SIZE
  // ==================================================

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Bytes`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // ==================================================
  // FORMAT UPLOAD DATE
  // ==================================================

  const uploadedDate = new Date(image.uploaded_at).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ==================================================
  // FORMAT ANALYSIS DATE
  // ==================================================

  const analyzedDate = analysis?.analyzedAt
    ? new Date(analysis.analyzedAt).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      title={image.filename}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        {/* ================================================== */}
        {/* IMAGE PREVIEW */}
        {/* ================================================== */}

        <div className="flex items-center justify-center overflow-hidden rounded-xl bg-gray-950 p-2">
          <img
            src={imageUrl}
            alt={image.filename}
            crossOrigin="use-credentials"
            className="max-h-[55vh] w-full rounded-lg object-contain"
          />
        </div>

        {/* ================================================== */}
        {/* MEDIA PROCESSING STATUS */}
        {/* ================================================== */}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">
              Media Processing Status
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Thumbnail and media processing state
            </p>
          </div>

          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${
              statusStyles[image.processing_status]
            }`}
          >
            {image.processing_status === "processing" && (
              <span className="mr-2 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            )}

            {image.processing_status}
          </span>
        </div>

        {/* ================================================== */}
        {/* AI IMAGE ANALYSIS */}
        {/* ================================================== */}

        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          {/* Analysis Header */}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FiCpu className="text-purple-600" size={20} />

                <h3 className="text-base font-semibold text-gray-900">
                  AI Image Understanding
                </h3>
              </div>

              <p className="mt-1 text-xs text-gray-500">
                Description and visual labels generated by AI
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefreshAnalysis}
              disabled={analysisFetching}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiRefreshCw
                className={analysisFetching ? "animate-spin" : ""}
                size={14}
              />
              Refresh
            </button>
          </div>

          {/* Initial Loading */}

          {analysisLoading && !analysis && (
            <div className="space-y-3 py-5">
              <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-gray-100" />

              <p className="text-xs text-gray-500">Fetching AI analysis...</p>
            </div>
          )}

          {/* API Error */}

          {!analysisLoading && analysisError && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-4">
              <div className="flex items-start gap-2">
                <FiAlertCircle
                  className="mt-0.5 shrink-0 text-red-500"
                  size={18}
                />

                <div>
                  <p className="text-sm font-medium text-red-700">
                    Unable to load analysis
                  </p>

                  <p className="mt-1 text-xs text-red-600">{analysisError}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRefreshAnalysis}
                className="mt-3 text-xs font-semibold text-red-700 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Analysis Status */}

          {analysis && !analysisError && (
            <div className="space-y-4">
              {/* Status Badge */}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${
                    analysisStatusStyles[analysis.status]
                  }`}
                >
                  {analysis.status === "processing" && (
                    <span className="mr-2 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  )}

                  {analysis.status === "completed" && (
                    <FiCheckCircle className="mr-1.5" size={13} />
                  )}

                  {analysis.status === "failed" && (
                    <FiAlertCircle className="mr-1.5" size={13} />
                  )}

                  {analysis.status}
                </span>

                {analysis.attemptCount > 0 && (
                  <span className="text-xs text-gray-400">
                    Attempts: {analysis.attemptCount}
                  </span>
                )}
              </div>

              {/* Pending State */}

              {analysis.status === "pending" && (
                <div className="rounded-lg bg-blue-50 p-4">
                  <div className="flex items-center gap-2 text-blue-700">
                    <FiClock size={17} />

                    <p className="text-sm font-medium">
                      Waiting for AI analysis
                    </p>
                  </div>

                  <p className="mt-1 text-xs text-blue-600">
                    Your image is waiting to be analysed. This section will
                    update automatically.
                  </p>
                </div>
              )}

              {/* Processing State */}

              {analysis.status === "processing" && (
                <div className="rounded-lg bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-amber-700">
                    <FiCpu size={17} />

                    <p className="text-sm font-medium">
                      AI is analysing your image
                    </p>
                  </div>

                  <p className="mt-1 text-xs text-amber-600">
                    We're identifying the scene and extracting useful visual
                    information.
                  </p>
                </div>
              )}

              {/* Polling Timeout */}

              {pollingTimedOut &&
                (analysis.status === "pending" ||
                  analysis.status === "processing") && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-700">
                      Analysis is taking longer than expected. Automatic
                      checking has stopped. You can refresh to check again.
                    </p>
                  </div>
                )}

              {/* Failed State */}

              {analysis.status === "failed" && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-red-700">
                    <FiAlertCircle size={17} />

                    <p className="text-sm font-semibold">
                      Image analysis failed
                    </p>
                  </div>

                  <p className="mt-2 text-xs text-red-600">
                    {analysis.errorMessage ||
                      "An unexpected error occurred during image analysis."}
                  </p>
                </div>
              )}

              {/* Completed State */}

              {analysis.status === "completed" && (
                <div className="space-y-5">
                  {/* Description */}

                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-gray-900">
                      Image Description
                    </h4>

                    <p className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                      {analysis.description || "No description was generated."}
                    </p>
                  </div>

                  {/* Labels */}

                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <FiTag className="text-purple-600" size={17} />

                      <h4 className="text-sm font-semibold text-gray-900">
                        Detected Labels
                      </h4>

                      <span className="text-xs text-gray-400">
                        ({analysis.labels.length})
                      </span>
                    </div>

                    {analysis.labels.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {analysis.labels.map((label, index) => (
                          <div
                            key={`${label.name}-${index}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-purple-100 bg-purple-50 px-3 py-2"
                          >
                            <span className="text-xs font-medium capitalize text-purple-800">
                              {label.name}
                            </span>

                            {typeof label.confidence === "number" && (
                              <span className="text-[11px] font-medium text-purple-500">
                                {Math.round(label.confidence * 100)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">
                        No visual labels were detected.
                      </p>
                    )}
                  </div>

                  {/* Analysis Metadata */}

                  <div className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-gray-400">AI Provider</p>

                      <p className="mt-1 text-sm font-medium capitalize text-gray-700">
                        {analysis.provider || "Not available"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">AI Model</p>

                      <p className="mt-1 break-all text-sm font-medium text-gray-700">
                        {analysis.model || "Not available"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">Analysis Attempts</p>

                      <p className="mt-1 text-sm font-medium text-gray-700">
                        {analysis.attemptCount}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">Analysed On</p>

                      <p className="mt-1 text-sm font-medium text-gray-700">
                        {analyzedDate || "Not available"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ================================================== */}
        {/* IMAGE INFORMATION */}
        {/* ================================================== */}

        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Image Information
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* File Size */}

            <div className="flex items-start gap-3 rounded-xl border border-gray-100 p-4">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <FiHardDrive size={18} />
              </div>

              <div className="min-w-0">
                <p className="text-xs text-gray-500">File Size</p>

                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {formatFileSize(image.file_size)}
                </p>
              </div>
            </div>

            {/* Dimensions */}

            <div className="flex items-start gap-3 rounded-xl border border-gray-100 p-4">
              <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                <FiMaximize2 size={18} />
              </div>

              <div className="min-w-0">
                <p className="text-xs text-gray-500">Dimensions</p>

                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {image.width && image.height
                    ? `${image.width} × ${image.height} px`
                    : "Not available"}
                </p>
              </div>
            </div>

            {/* Format */}

            <div className="flex items-start gap-3 rounded-xl border border-gray-100 p-4">
              <div className="rounded-lg bg-orange-50 p-2 text-orange-600">
                <FiFile size={18} />
              </div>

              <div className="min-w-0">
                <p className="text-xs text-gray-500">Image Format</p>

                <p className="mt-1 text-sm font-semibold uppercase text-gray-900">
                  {image.format || "Not available"}
                </p>
              </div>
            </div>

            {/* Upload Date */}

            <div className="flex items-start gap-3 rounded-xl border border-gray-100 p-4">
              <div className="rounded-lg bg-green-50 p-2 text-green-600">
                <FiCalendar size={18} />
              </div>

              <div className="min-w-0">
                <p className="text-xs text-gray-500">Uploaded On</p>

                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {uploadedDate}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================== */}
        {/* ADDITIONAL INFORMATION */}
        {/* ================================================== */}

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-500">MIME Type</p>

          <p className="mt-1 text-sm font-medium text-gray-700">
            {image.mime_type}
          </p>
        </div>
      </div>
    </Popup>
  );
};

export default ImageDetailsPopup;
