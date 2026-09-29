import { useState, useRef, useEffect } from "react";
import type { ProofData } from "../schemas/workerOnboarding";
import api from "../../../shared/lib/api";

interface Props {
  subcategoryIds: string[];
  proofs: ProofData[];
  onNext: (proofs: ProofData[]) => void;
  onBack: () => void;
}

interface Category {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
}

export default function StepProofs({ subcategoryIds, proofs, onNext, onBack }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [localProofs, setLocalProofs] = useState<ProofData[]>(proofs);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await api.get("/categories/");
        setCategories(data);
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    };
    fetchCategories();
  }, []);

  const selectedServices = subcategoryIds.map(id => {
    for (const cat of categories) {
      const sub = cat.subcategories.find(s => s.id === id);
      if (sub) return { id: sub.id, name: sub.name, catName: cat.name };
    }
    return { id, name: "Loading...", catName: "" };
  }).filter(s => s.name !== "Loading..." || categories.length === 0);

  // Auto-expand first on load
  useEffect(() => {
    if (!expandedId && selectedServices.length > 0 && selectedServices[0].id) {
      setExpandedId(selectedServices[0].id);
    }
  }, [selectedServices, expandedId]);

  const handleAddVideoLink = (subId: string) => {
    const url = videoUrls[subId];
    if (!url || !url.trim()) return;
    try {
      new URL(url); // basic validation
      setLocalProofs(prev => [...prev, { subcategory_id: subId, proof_type: "video", url: url.trim() }]);
      setVideoUrls(prev => ({ ...prev, [subId]: "" }));
    } catch {
      alert("Please enter a valid URL");
    }
  };

  const removeProof = (index: number) => {
    setLocalProofs(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = async (subId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      alert("Please select an image or PDF file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File must be less than 10MB");
      return;
    }

    setIsUploading(prev => ({ ...prev, [subId]: true }));
    try {
      const { data } = await api.post("/workers/upload-url", {
        file_name: file.name,
        content_type: file.type,
        bucket_type: "public",
      });

      await fetch(data.upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      setLocalProofs(prev => [
        ...prev, 
        { subcategory_id: subId, proof_type: isImage ? "image" : "doc", url: data.file_url }
      ]);
    } catch {
      alert("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(prev => ({ ...prev, [subId]: false }));
      if (fileInputRefs.current[subId]) {
        fileInputRefs.current[subId]!.value = "";
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-bold text-text mb-1">Proof of Work</h3>
        <p className="text-sm text-text-secondary">
          Upload photos, PDFs, or video links showing your past work for each service.
        </p>
      </div>

      <div className="bg-primary-ghost border border-primary-light rounded-xl p-4 text-center">
        <p className="text-sm text-text-secondary">
          <span className="font-semibold text-text">This step is optional</span> but highly recommended.
        </p>
      </div>

      <div className="space-y-4">
        {selectedServices.map(service => (
          <div key={service.id} className="border border-border rounded-xl bg-surface overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === service.id ? null : service.id)}
              className="w-full px-4 py-4 flex justify-between items-center bg-bg font-semibold text-sm transition-colors hover:bg-bg/70"
            >
              <span>{service.name}</span>
              <span className="text-text-secondary">{expandedId === service.id ? '▲' : '▼'}</span>
            </button>
            
            {expandedId === service.id && (
              <div className="p-4 space-y-4">
                {/* Drag and Drop Zone equivalent */}
                <div 
                  onClick={() => fileInputRefs.current[service.id]?.click()}
                  className={`border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer transition-colors hover:bg-bg/50 ${isUploading[service.id] ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <p className="text-sm font-medium text-text">
                    {isUploading[service.id] ? 'Uploading...' : 'Click to upload images or PDFs'}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">Max 10MB per file</p>
                </div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  ref={el => fileInputRefs.current[service.id] = el}
                  onChange={e => handleFileSelect(service.id, e)}
                />

                {/* Video URL Input */}
                <div className="flex gap-2">
                  <input 
                    type="url" 
                    placeholder="YouTube/Vimeo URL" 
                    value={videoUrls[service.id] || ''}
                    onChange={e => setVideoUrls(prev => ({ ...prev, [service.id]: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-bg outline-none focus:border-primary" 
                  />
                  <button 
                    onClick={() => handleAddVideoLink(service.id)}
                    className="px-4 py-2 bg-text text-white rounded-lg text-sm font-medium hover:bg-text/90 transition-colors"
                  >
                    Add Link
                  </button>
                </div>

                {/* Proofs List */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  {localProofs.map((proof, i) => {
                    if (proof.subcategory_id !== service.id) return null;
                    return (
                      <div key={i} className="relative aspect-square border border-border rounded-lg overflow-hidden group bg-bg flex items-center justify-center">
                        {proof.proof_type === 'image' && <img src={proof.url} className="w-full h-full object-cover" alt="proof" />}
                        {proof.proof_type === 'video' && <div className="text-center text-xs font-medium"><span className="text-2xl block mb-1">🎥</span>Video</div>}
                        {proof.proof_type === 'doc' && <div className="text-center text-xs font-medium"><span className="text-2xl block mb-1">📄</span>PDF</div>}
                        
                        <button 
                          onClick={() => removeProof(localProofs.indexOf(proof))}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border mt-6">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => onNext(localProofs)}
          className="px-8 py-3 bg-primary text-white font-semibold rounded-lg
            hover:bg-primary-dark active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
