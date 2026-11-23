export interface GalleryImage {
  id: string;
  filename: string;
  storage_key: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  processing_status: "uploaded" | "processing" | "completed" | "failed";
  thumbnail_key: string | null;
  width: number | null;
  height: number | null;
  format: string | null;
}

export interface GalleryResponse {
  success: boolean;
  count: number;
  images: GalleryImage[];
}

// ==================================================
// IMAGE ANALYSIS TYPES
// ==================================================

export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export interface ImageLabel {
  name: string;
  confidence?: number;
}

export interface ImageAnalysis {
  status: AnalysisStatus;
  description: string | null;
  labels: ImageLabel[];
  provider: string | null;
  model: string | null;
  attemptCount: number;
  errorMessage: string | null;
  analysisStartedAt: string | null;
  analyzedAt: string | null;
}

export interface ImageAnalysisResponse {
  success: boolean;
  analysis: ImageAnalysis;
}

// ==================================================
// IMAGE PROCESSING STATUS STYLES
// ==================================================

export const statusStyles: Record<GalleryImage["processing_status"], string> = {
  uploaded: "bg-blue-50 text-blue-700 ring-blue-600/20",
  processing: "bg-amber-50 text-amber-700 ring-amber-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
};

// ==================================================
// AI ANALYSIS STATUS STYLES
// ==================================================

export const analysisStatusStyles: Record<AnalysisStatus, string> = {
  pending: "bg-blue-50 text-blue-700 ring-blue-600/20",
  processing: "bg-amber-50 text-amber-700 ring-amber-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
};
