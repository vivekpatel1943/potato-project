import { useState, useEffect } from "react";
import type { DocumentData, ProofData } from "../schemas/workerOnboarding";
import api from "../../../shared/lib/api";

interface Props {
  avatarUrl: string;
  documents: DocumentData[];
  subcategoryIds: string[];
  proofs: ProofData[];
  isSubmitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  driving_license: "Driving License",
  passport: "Passport",
  other: "Other",
};

interface Category {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
}

export default function StepReview({
  avatarUrl,
  documents,
  subcategoryIds,
  proofs,
  isSubmitting,
  onSubmit,
  onBack,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-bold text-text mb-1">Review Your Profile</h3>
        <p className="text-sm text-text-secondary">
          Make sure everything looks good before submitting.
        </p>
      </div>

      {/* Profile Picture */}
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Profile Picture
        </h4>
        <div className="flex items-center gap-3">
          <img
            src={avatarUrl}
            alt="Profile"
            className="w-14 h-14 rounded-full object-cover border-2 border-border cursor-pointer hover:border-primary transition-colors"
            onClick={() => setViewImageUrl(avatarUrl)}
          />
          <span className="text-sm text-success font-medium">✓ Uploaded</span>
        </div>
      </div>

      {/* Documents */}
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Verification Documents
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {documents.map((doc, i) => (
             <div 
               key={i} 
               onClick={() => {
                 if (doc.document_url.endsWith('.pdf')) {
                   window.open(doc.document_url, '_blank');
                 } else {
                   setViewImageUrl(doc.document_url);
                 }
               }} 
               className="cursor-pointer border border-border rounded-lg p-2 text-center hover:border-primary transition-colors bg-bg"
             >
               {doc.document_url.endsWith('.pdf') ? (
                 <div className="w-full h-20 bg-blue-50 text-blue-500 rounded mb-2 flex flex-col items-center justify-center">
                   <span className="text-2xl block mb-1">📄</span>
                   <span className="text-[10px] font-bold uppercase">PDF</span>
                 </div>
               ) : (
                 <img src={doc.document_url} alt="doc" className="w-full h-20 object-cover rounded mb-2 bg-gray-100" />
               )}
               <p className="text-[11px] font-medium leading-tight text-text truncate">{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</p>
               {doc.document_number && <p className="text-[10px] text-text-secondary mt-1 truncate">{doc.document_number}</p>}
             </div>
          ))}
        </div>
      </div>

      {/* Selected Services & Proofs */}
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">
          Selected Services & Proofs
        </h4>
        <div className="space-y-4">
          {selectedServices.map(service => (
            <div key={service.id} className="border-b border-border/50 last:border-0 pb-4 last:pb-0">
              <h5 className="font-semibold text-sm text-text mb-3 flex items-center gap-2">
                <span className="text-primary text-lg leading-none">✓</span> {service.name}
              </h5>
              
              <div className="flex flex-wrap gap-3">
                {proofs.filter(p => p.subcategory_id === service.id).map((proof, i) => (
                   <div 
                     key={i}
                     onClick={() => proof.proof_type === 'image' ? setViewImageUrl(proof.url) : window.open(proof.url, '_blank')}
                     className="w-16 h-16 rounded-lg border border-border cursor-pointer overflow-hidden hover:opacity-80 transition-opacity bg-bg flex flex-col items-center justify-center"
                     title={proof.proof_type === 'image' ? 'View Image' : `Open ${proof.proof_type}`}
                   >
                     {proof.proof_type === 'image' && <img src={proof.url} className="w-full h-full object-cover" />}
                     {proof.proof_type === 'video' && <><span className="text-xl">🎥</span><span className="text-[10px] mt-1">Video</span></>}
                     {proof.proof_type === 'doc' && <><span className="text-xl text-blue-500">📄</span><span className="text-[10px] mt-1 text-blue-500 font-medium">PDF</span></>}
                   </div>
                ))}
                {proofs.filter(p => p.subcategory_id === service.id).length === 0 && (
                  <span className="text-xs text-text-secondary italic">No proofs added</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-primary-ghost border border-primary-light rounded-xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm text-text">
            After submitting, your profile will be <span className="font-semibold">under review</span>.
          </p>
          <p className="text-xs text-text-secondary mt-1">
            This usually takes 1–2 business days. You'll be notified once approved.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="px-8 py-3 bg-primary text-white font-semibold rounded-lg
            hover:bg-primary-dark active:scale-[0.98] transition-all duration-200 cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting…
            </span>
          ) : (
            "Submit Profile"
          )}
        </button>
      </div>

      {/* Image View Modal */}
      {viewImageUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm transition-opacity" 
          onClick={() => setViewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col">
            <button className="absolute -top-10 right-0 text-white text-xl font-medium opacity-70 hover:opacity-100 transition-opacity cursor-pointer">✕ Close</button>
            <img src={viewImageUrl} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
}
