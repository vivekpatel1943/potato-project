import { useState, useEffect, useCallback } from "react";
import api from "../../../../shared/lib/api";

interface SubcategoryAdmin {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface CategoryAdmin {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  subcategories: SubcategoryAdmin[];
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [subcategoryModalParentId, setSubcategoryModalParentId] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<{ type: 'category' | 'subcategory', id: string, parentId?: string } | null>(null);
  
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openEditModal = (type: 'category' | 'subcategory', id: string, currentName: string, currentDesc: string | null, parentId?: string) => {
    setFormName(currentName);
    setFormDesc(currentDesc || "");
    setEditingEntity({ type, id, parentId });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !editingEntity) return;
    setIsSubmitting(true);
    try {
      if (editingEntity.type === 'category') {
        const { data } = await api.patch(`/admin/categories/${editingEntity.id}`, {
          name: formName,
          description: formDesc || null
        });
        setCategories(prev => prev.map(c => c.id === editingEntity.id ? { ...c, name: data.name, description: data.description } : c));
      } else {
        const { data } = await api.patch(`/admin/subcategories/${editingEntity.id}`, {
          name: formName,
          description: formDesc || null
        });
        setCategories(prev => prev.map(c => {
          if (c.id === editingEntity.parentId) {
            return {
              ...c,
              subcategories: c.subcategories.map(s => s.id === editingEntity.id ? { ...s, name: data.name, description: data.description } : s)
            };
          }
          return c;
        }));
      }
      setEditingEntity(null);
      setFormName("");
      setFormDesc("");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/admin/categories");
      setCategories(data);
    } catch {
      alert("Failed to load categories.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const toggleCategory = async (id: string, currentStatus: boolean) => {
    try {
      // Optimistic update
      setCategories(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
      await api.patch(`/admin/categories/${id}`, { is_active: !currentStatus });
    } catch {
      alert("Failed to toggle category.");
      // Revert on failure
      setCategories(prev => prev.map(c => c.id === id ? { ...c, is_active: currentStatus } : c));
    }
  };

  const toggleSubcategory = async (parentId: string, subId: string, currentStatus: boolean) => {
    try {
      // Optimistic update
      setCategories(prev => prev.map(c => c.id === parentId ? {
        ...c,
        subcategories: c.subcategories.map(s => s.id === subId ? { ...s, is_active: !currentStatus } : s)
      } : c));
      await api.patch(`/admin/subcategories/${subId}`, { is_active: !currentStatus });
    } catch {
      alert("Failed to toggle subcategory.");
      // Revert on failure
      setCategories(prev => prev.map(c => c.id === parentId ? {
        ...c,
        subcategories: c.subcategories.map(s => s.id === subId ? { ...s, is_active: currentStatus } : s)
      } : c));
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setIsSubmitting(true);
    try {
      const { data } = await api.post("/admin/categories", {
        name: formName,
        description: formDesc || null
      });
      setCategories(prev => [...prev, data]);
      setIsCategoryModalOpen(false);
      setFormName("");
      setFormDesc("");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !subcategoryModalParentId) return;
    setIsSubmitting(true);
    try {
      const { data } = await api.post("/admin/subcategories", {
        category_id: subcategoryModalParentId,
        name: formName,
        description: formDesc || null
      });
      
      setCategories(prev => prev.map(c => {
        if (c.id === subcategoryModalParentId) {
          return { ...c, subcategories: [...c.subcategories, data] };
        }
        return c;
      }));
      
      setSubcategoryModalParentId(null);
      setFormName("");
      setFormDesc("");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create subcategory");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper component for toggle switch
  const ToggleSwitch = ({ active, onToggle }: { active: boolean, onToggle: () => void }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        active ? "bg-primary" : "bg-gray-300"
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        active ? "translate-x-6" : "translate-x-1"
      }`} />
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text">Category Management</h1>
          <p className="mt-1 text-text-secondary">
            Manage visibility of categories and create new ones.
          </p>
        </div>
        <button
          onClick={() => {
            setFormName("");
            setFormDesc("");
            setIsCategoryModalOpen(true);
          }}
          className="px-4 py-2 bg-text text-white rounded-lg font-medium hover:bg-text/90 transition-colors"
        >
          + New Category
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm transition-all duration-200 hover:border-border-dark">
              {/* Parent Row */}
              <div 
                className="px-6 py-4 flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
              >
                <div className="flex items-center space-x-4">
                  <span className="text-lg opacity-50">
                    {expandedId === cat.id ? "▼" : "▶"}
                  </span>
                  <div>
                    <h3 className={`font-semibold text-lg ${!cat.is_active && 'text-text-secondary line-through'}`}>{cat.name}</h3>
                    <p className="text-sm text-text-secondary">{cat.subcategories.length} subcategories</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-text-secondary hidden sm:inline-block">
                    {cat.is_active ? "Active" : "Hidden"}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); openEditModal('category', cat.id, cat.name, cat.description); }}
                    className="text-text-secondary hover:text-primary transition-colors text-lg"
                    title="Edit Category"
                  >
                    ✏️
                  </button>
                  <ToggleSwitch active={cat.is_active} onToggle={() => toggleCategory(cat.id, cat.is_active)} />
                </div>
              </div>

              {/* Subcategories (Expanded) */}
              {expandedId === cat.id && (
                <div className="bg-bg/50 px-6 py-5 border-t border-border">
                  {!cat.is_active && (
                    <div className="mb-4 px-4 py-2 bg-orange-50 text-orange-700 text-sm rounded border border-orange-200">
                      Note: Because this parent category is hidden, none of these subcategories will be visible to users, regardless of their individual status.
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    {cat.subcategories.map(sub => (
                      <div key={sub.id} className={`flex items-center justify-between p-3 bg-surface border rounded-lg ${!sub.is_active ? 'border-dashed border-gray-300 opacity-60' : 'border-border'}`}>
                        <span className={`text-sm font-medium ${!sub.is_active && 'line-through'}`}>{sub.name}</span>
                        <div className="flex items-center space-x-3">
                          <button 
                            onClick={(e) => { e.stopPropagation(); openEditModal('subcategory', sub.id, sub.name, sub.description, cat.id); }}
                            className="text-text-secondary hover:text-primary transition-colors text-lg"
                            title="Edit Subcategory"
                          >
                            ✏️
                          </button>
                          <ToggleSwitch active={sub.is_active} onToggle={() => toggleSubcategory(cat.id, sub.id, sub.is_active)} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setFormName("");
                      setFormDesc("");
                      setSubcategoryModalParentId(cat.id);
                    }}
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    + Add Subcategory
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal for Parent Category */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4">New Category</h2>
            <form onSubmit={handleCreateCategory}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
                  <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-4 py-2 bg-bg border border-border rounded-lg outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Description (Optional)</label>
                  <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full px-4 py-2 bg-bg border border-border rounded-lg outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <div className="flex space-x-3 justify-end">
                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 text-text-secondary hover:bg-bg rounded-lg transition-colors font-medium">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4">Edit {editingEntity.type === 'category' ? 'Category' : 'Subcategory'}</h2>
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
                  <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-4 py-2 bg-bg border border-border rounded-lg outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Description (Optional)</label>
                  <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full px-4 py-2 bg-bg border border-border rounded-lg outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <div className="flex space-x-3 justify-end">
                <button type="button" onClick={() => setEditingEntity(null)} className="px-4 py-2 text-text-secondary hover:bg-bg rounded-lg transition-colors font-medium">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Subcategory */}
      {subcategoryModalParentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4">New Subcategory</h2>
            <form onSubmit={handleCreateSubcategory}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
                  <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-4 py-2 bg-bg border border-border rounded-lg outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Description (Optional)</label>
                  <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full px-4 py-2 bg-bg border border-border rounded-lg outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <div className="flex space-x-3 justify-end">
                <button type="button" onClick={() => setSubcategoryModalParentId(null)} className="px-4 py-2 text-text-secondary hover:bg-bg rounded-lg transition-colors font-medium">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
