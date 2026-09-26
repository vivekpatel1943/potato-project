import { useState, useEffect } from "react";
import api from "../../../shared/lib/api";

interface Category {
  id: string;
  name: string;
  description: string | null;
  subcategories: { id: string; name: string; description: string | null }[];
}

interface Props {
  selectedIds: string[];
  onNext: (ids: string[]) => void;
  onBack: () => void;
}

export default function StepServices({ selectedIds, onNext, onBack }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await api.get("/categories/");
        setCategories(data);
        // Auto-expand first category
        if (data.length > 0) setExpandedCat(data[0].id);
      } catch {
        setError("Failed to load services. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const toggleSubcategory = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (catId: string) => {
    setExpandedCat((prev) => (prev === catId ? null : catId));
  };

  const handleContinue = () => {
    if (selected.size === 0) {
      setError("Please select at least one service");
      return;
    }
    onNext(Array.from(selected));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-bold text-text mb-1">Choose Your Services</h3>
        <p className="text-sm text-text-secondary">
          Select the services you want to offer. You can always update these later.
        </p>
      </div>

      {/* Selected count badge */}
      {selected.size > 0 && (
        <div className="flex items-center justify-center">
          <span className="px-3 py-1 bg-primary-ghost text-primary text-sm font-semibold rounded-full">
            {selected.size} service{selected.size !== 1 ? "s" : ""} selected
          </span>
        </div>
      )}

      {/* Category Accordion */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const isExpanded = expandedCat === cat.id;
          const selectedInCat = cat.subcategories.filter((s) => selected.has(s.id)).length;

          return (
            <div
              key={cat.id}
              className="bg-surface border border-border rounded-xl overflow-hidden transition-all duration-200"
            >
              {/* Category Header */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left cursor-pointer
                  hover:bg-bg/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text">{cat.name}</span>
                  {selectedInCat > 0 && (
                    <span className="px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
                      {selectedInCat}
                    </span>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-text-secondary transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Subcategory Chips */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1">
                  {cat.description && (
                    <p className="text-xs text-text-secondary mb-3">{cat.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {cat.subcategories.map((sub) => {
                      const isSelected = selected.has(sub.id);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => toggleSubcategory(sub.id)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer
                            ${
                              isSelected
                                ? "bg-primary text-white shadow-sm"
                                : "bg-bg border border-border text-text-secondary hover:border-primary hover:text-primary"
                            }`}
                        >
                          {isSelected && (
                            <svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {sub.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
          onClick={handleContinue}
          className="px-8 py-3 bg-primary text-white font-semibold rounded-lg
            hover:bg-primary-dark active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
