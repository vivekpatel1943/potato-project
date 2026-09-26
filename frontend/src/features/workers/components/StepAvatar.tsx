import { useState, useRef, useEffect } from "react";
import api from "../../../shared/lib/api";

interface Props {
  avatarUrl: string;
  onNext: (url: string) => void;
  onBack: () => void;
}

export default function StepAvatar({ avatarUrl, onNext, onBack }: Props) {
  // localPreview = browser blob URL for instant display
  // uploadedUrl  = the R2 URL that gets persisted to the database
  const [localPreview, setLocalPreview] = useState<string>("");
  const [uploadedUrl, setUploadedUrl] = useState<string>(avatarUrl || "");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPEG, PNG, etc.)");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setError(null);
    setIsUploading(true);

    // Delete old file from R2 if replacing
    if (uploadedUrl) {
      api.delete("/workers/upload", {
        data: { file_url: uploadedUrl, bucket_type: "public" },
      }).catch(() => {});
    }

    // Set local preview immediately for instant visual feedback
    if (localPreview) URL.revokeObjectURL(localPreview);
    const blobUrl = URL.createObjectURL(file);
    setLocalPreview(blobUrl);

    try {
      // 1. Get presigned URL from backend
      const { data } = await api.post("/workers/upload-url", {
        file_name: file.name,
        content_type: file.type,
        bucket_type: "public",
      });

      // 2. Upload directly to R2
      await fetch(data.upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // 3. Store the R2 URL for form submission
      setUploadedUrl(data.file_url);
    } catch {
      setLocalPreview("");
      setError("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const displaySrc = localPreview || uploadedUrl;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-bold text-text mb-1">Profile Picture</h3>
        <p className="text-sm text-text-secondary">
          Upload a clear photo of yourself. This will be visible to customers.
        </p>
      </div>

      {/* Avatar Preview */}
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-32 h-32 rounded-full border-2 border-dashed border-border
            hover:border-primary transition-all duration-200 overflow-hidden
            flex items-center justify-center bg-bg cursor-pointer group"
        >
          {displaySrc ? (
            <img
              src={displaySrc}
              alt="Profile preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center">
              <svg className="w-8 h-8 text-text-secondary mx-auto mb-1 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-xs text-text-secondary">Upload</span>
            </div>
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {displaySrc && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-sm text-primary font-medium hover:text-primary-dark transition-colors cursor-pointer"
          >
            Change photo
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-error text-sm font-medium text-center">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => {
            if (!uploadedUrl) {
              setError("Please upload a profile picture");
              return;
            }
            onNext(uploadedUrl);
          }}
          disabled={isUploading}
          className="px-8 py-3 bg-primary text-white font-semibold rounded-lg
            hover:bg-primary-dark active:scale-[0.98] transition-all duration-200 cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
