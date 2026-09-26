import { useState, useRef, useEffect } from "react";
import api from "../../../shared/lib/api";
import type { DocumentData } from "../schemas/workerOnboarding";

interface Props {
  documents: DocumentData[];
  onNext: (docs: DocumentData[]) => void;
  onBack: () => void;
}

interface Preview {
  url: string;   // blob URL or signed URL
  type: string;  // MIME type
  name: string;  // original file name
  isSignedUrl?: boolean; // flag to prevent revoking signed URLs
}

const DOCUMENT_TYPES = [
  { value: "aadhaar", label: "Aadhaar Card" },
  { value: "pan", label: "PAN Card" },
  { value: "driving_license", label: "Driving License" },
  { value: "passport", label: "Passport" },
  { value: "other", label: "Other" },
] as const;

export default function StepDocuments({ documents, onNext, onBack }: Props) {
  const [docs, setDocs] = useState<DocumentData[]>(
    documents.length > 0 ? documents : [{ document_type: "aadhaar", document_url: "", document_number: "" }]
  );
  const [previews, setPreviews] = useState<Record<number, Preview>>({});
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Clean up all blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((p) => {
        if (!p.isSignedUrl) URL.revokeObjectURL(p.url);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch signed URLs for draft-restored documents
  useEffect(() => {
    let isMounted = true;

    const fetchPreviews = async () => {
      // Loop sequentially to avoid race conditions and easily track state
      for (let index = 0; index < docs.length; index++) {
        const doc = docs[index];
        // Only fetch if we have an r2 url and don't already have a signed preview
        if (doc.document_url && doc.document_url.startsWith("r2://")) {
          // Check current previews state using functional updater to avoid stale closures
          let hasPreview = false;
          setPreviews((current) => {
            if (current[index]?.isSignedUrl) hasPreview = true;
            return current;
          });

          if (hasPreview) continue;

          try {
            const { data } = await api.post("/workers/download-url", {
              file_url: doc.document_url,
            });

            if (!isMounted) return;

            const isPdf = doc.document_url.toLowerCase().endsWith(".pdf");
            const type = isPdf ? "application/pdf" : "image/jpeg";
            const name = doc.document_url.split("/").pop() || "Document";

            setPreviews((prev) => ({
              ...prev,
              [index]: { url: data.download_url, type, name, isSignedUrl: true },
            }));
          } catch (err) {
            console.error(`Failed to load document preview for index ${index}`, err);
          }
        }
      }
    };

    fetchPreviews();

    return () => {
      isMounted = false;
    };
  }, [docs]); // re-run if docs change

  const handleFileUpload = async (index: number, file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError("Please upload an image or PDF file");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File must be less than 20MB");
      return;
    }

    setError(null);
    setUploadingIdx(index);

    // Delete old file from R2 if replacing
    const existingUrl = docs[index]?.document_url;
    if (existingUrl) {
      api.delete("/workers/upload", {
        data: { file_url: existingUrl, bucket_type: "private" },
      }).catch(() => {});
    }

    // Revoke old local preview
    if (previews[index]) URL.revokeObjectURL(previews[index].url);

    // Create local preview immediately
    const blobUrl = URL.createObjectURL(file);
    setPreviews((prev) => ({
      ...prev,
      [index]: { url: blobUrl, type: file.type, name: file.name },
    }));

    try {
      const { data } = await api.post("/workers/upload-url", {
        file_name: file.name,
        content_type: file.type,
        bucket_type: "private",
      });

      await fetch(data.upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      setDocs((prev) =>
        prev.map((d, i) => (i === index ? { ...d, document_url: data.file_url } : d))
      );
    } catch {
      // Remove preview on failure
      setPreviews((prev) => {
        const next = { ...prev };
        if (next[index]) {
          URL.revokeObjectURL(next[index].url);
          delete next[index];
        }
        return next;
      });
      setError("Failed to upload document. Please try again.");
    } finally {
      setUploadingIdx(null);
    }
  };

  const addDocument = () => {
    setDocs((prev) => [...prev, { document_type: "aadhaar", document_url: "", document_number: "" }]);
  };

  const removeDocument = (index: number) => {
    if (docs.length <= 1) return;

    // Delete from R2
    const existingUrl = docs[index]?.document_url;
    if (existingUrl) {
      api.delete("/workers/upload", {
        data: { file_url: existingUrl, bucket_type: "private" },
      }).catch(() => {});
    }

    // Revoke local preview
    if (previews[index]) URL.revokeObjectURL(previews[index].url);

    // Remove doc and re-index previews
    setDocs((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const next: Record<number, Preview> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const k = Number(key);
        if (k < index) next[k] = value;
        else if (k > index) next[k - 1] = value;
        // k === index is dropped
      });
      return next;
    });
  };

  const updateDoc = (index: number, field: keyof DocumentData, value: string) => {
    setDocs((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  const handleContinue = () => {
    const incomplete = docs.some((d) => !d.document_url);
    if (incomplete) {
      setError("Please upload all documents before continuing");
      return;
    }
    onNext(docs);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-bold text-text mb-1">Identity Verification</h3>
        <p className="text-sm text-text-secondary">
          Upload your official identity documents. These are stored securely and used for verification only.
        </p>
      </div>

      {/* Document Cards */}
      <div className="space-y-4">
        {docs.map((doc, index) => (
          <div
            key={index}
            className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text">Document {index + 1}</span>
              {docs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDocument(index)}
                  className="text-xs text-error hover:text-red-700 transition-colors cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Document Type Dropdown */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Document Type
              </label>
              <select
                value={doc.document_type}
                onChange={(e) => updateDoc(index, "document_type", e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-surface text-text text-sm
                  focus:border-primary focus:ring-2 focus:ring-primary-light outline-none transition-all"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Document Number (optional) */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Document Number (optional)
              </label>
              <input
                type="text"
                value={doc.document_number || ""}
                onChange={(e) => updateDoc(index, "document_number", e.target.value)}
                placeholder="e.g., XXXX-XXXX-1234"
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-surface text-text text-sm
                  placeholder:text-text-secondary/50
                  focus:border-primary focus:ring-2 focus:ring-primary-light outline-none transition-all"
              />
            </div>

            {/* Upload Area */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Upload Document
              </label>

              {/* Preview or Upload Button */}
              {doc.document_url && previews[index] ? (
                // ── Show actual preview ──
                <div className="space-y-2">
                  {previews[index].type.startsWith("image/") ? (
                    <div className="relative rounded-lg overflow-hidden border border-border bg-bg">
                      <img
                        src={previews[index].url}
                        alt={`Document ${index + 1} preview`}
                        className="w-full max-h-48 object-contain"
                      />
                    </div>
                  ) : (
                    // PDF preview
                    <div className="flex items-center gap-3 px-3 py-3 bg-bg border border-border rounded-lg">
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text truncate">{previews[index].name}</p>
                        <p className="text-xs text-text-secondary">PDF Document</p>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileRefs.current[index]?.click()}
                    className="text-xs text-primary font-medium hover:text-primary-dark transition-colors cursor-pointer"
                  >
                    Replace file
                  </button>
                </div>
              ) : doc.document_url && !previews[index] ? (
                // ── Uploaded (from draft restore) but no local preview available ──
                <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                  <svg className="w-5 h-5 text-success flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-success font-medium truncate">Previously uploaded</span>
                  <button
                    type="button"
                    onClick={() => fileRefs.current[index]?.click()}
                    className="ml-auto text-xs text-primary font-medium hover:text-primary-dark transition-colors cursor-pointer"
                  >
                    Replace
                  </button>
                </div>
              ) : (
                // ── Upload button ──
                <button
                  type="button"
                  onClick={() => fileRefs.current[index]?.click()}
                  disabled={uploadingIdx === index}
                  className="w-full px-3 py-4 border-2 border-dashed border-border rounded-lg
                    hover:border-primary hover:bg-primary-ghost/30 transition-all duration-200
                    flex flex-col items-center gap-1 cursor-pointer
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingIdx === index ? (
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-6 h-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-xs text-text-secondary">
                        Tap to upload (Image or PDF)
                      </span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={(el) => { fileRefs.current[index] = el; }}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(index, file);
                }}
                className="hidden"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Add Document Button */}
      <button
        type="button"
        onClick={addDocument}
        className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm font-medium
          text-text-secondary hover:text-primary hover:border-primary transition-all duration-200 cursor-pointer"
      >
        + Add Another Document
      </button>

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
          onClick={handleContinue}
          disabled={uploadingIdx !== null}
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
