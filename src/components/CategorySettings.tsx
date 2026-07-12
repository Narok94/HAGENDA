import React, { useState } from 'react';
import { Category, Item } from '../types';
import { Tag, Plus, Trash2, Check, Sparkles } from 'lucide-react';

interface CategorySettingsProps {
  categories: Category[];
  items: Item[];
  onAddCategory: (category: Omit<Category, 'id'>) => void;
  onDeleteCategory: (categoryId: string) => void;
}

const PRESET_COLORS = [
  '#4F46E5', // Indigo
  '#10B981', // Emerald
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EC4899', // Pink
];

export default function CategorySettings({
  categories,
  items,
  onAddCategory,
  onDeleteCategory
}: CategorySettingsProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [customColor, setCustomColor] = useState('#8B5CF6');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddCategory({
      name: name.trim(),
      color: selectedColor
    });
    setName('');
  };

  // Helper to count how many items use a category
  const getUsageCount = (catId: string) => {
    return items.filter(item => item.category === catId).length;
  };

  return (
    <div className="bg-white p-5 rounded-[20px] border border-[#E2E5EC] shadow-[0_2px_8px_rgba(16,24,40,0.06)] space-y-6">
      <div>
        <h2 className="font-display font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
          <Tag size={16} className="text-brand-accent dark:text-brand-accent-dark" />
          <span className="font-display font-bold">Gerenciar Categorias</span>
        </h2>
        <p className="text-xs text-gray-400 dark:text-[#8A94A6] mt-1">
          Crie marcadores personalizados para categorizar e filtrar seus compromissos.
        </p>
      </div>

      {/* Categories List */}
      <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
        {categories.map((cat) => {
          const count = getUsageCount(cat.id);
          return (
            <div
              key={cat.id}
              className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-dark-inner border border-gray-100 dark:border-dark-border rounded-xl hover:border-gray-200 dark:hover:border-dark-hover transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-full block border border-black/10 shrink-0 shadow-xs"
                  style={{ backgroundColor: cat.color }}
                />
                <div className="truncate">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{cat.name}</span>
                  <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 block">
                    {count} {count === 1 ? 'item agendado' : 'itens agendados'}
                  </span>
                </div>
              </div>

              {categories.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const message = count > 0 
                      ? `Esta categoria possui ${count} compromissos associados. Deseja realmente excluí-la? Os itens não serão deletados, mas ficarão sem categoria.`
                      : 'Remover esta categoria?';
                    if (confirm(message)) {
                      onDeleteCategory(cat.id);
                    }
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
                  title="Excluir Categoria"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Addition Form */}
      <form onSubmit={handleSubmit} className="space-y-4 border-t border-gray-100 dark:border-dark-border pt-4">
        <div>
          <label className="block text-[10px] font-mono uppercase text-gray-400 dark:text-[#8A94A6] tracking-wider mb-1.5">
            Nova Categoria
          </label>
          <div className="relative">
            <input
              type="text"
              required
              placeholder="Ex: Trabalho, Faculdade, Saúde..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 dark:bg-dark-inner border border-gray-200/60 dark:border-dark-border rounded-xl px-3.5 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#4E5A6C] focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent-dark transition-all"
            />
          </div>
        </div>

        {/* Color presets selection & custom picker */}
        <div>
          <label className="block text-[10px] font-mono uppercase text-gray-400 dark:text-[#8A94A6] tracking-wider mb-2">
            Escolher Cor
          </label>
          
          <div className="flex flex-wrap gap-2 items-center">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className="w-6 h-6 rounded-full flex items-center justify-center border border-black/10 transition-transform hover:scale-110 cursor-pointer shadow-sm relative shrink-0"
                style={{ backgroundColor: color }}
              >
                {selectedColor === color && (
                  <Check size={11} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" strokeWidth={3} />
                )}
              </button>
            ))}

            {/* Custom color wrapper */}
            <div className="flex items-center gap-1.5 ml-1 border-l border-gray-100 dark:border-dark-border pl-3">
              <label 
                className="w-6 h-6 rounded-full flex items-center justify-center border border-black/10 transition-transform hover:scale-110 cursor-pointer shadow-sm relative shrink-0"
                style={{ backgroundColor: customColor }}
              >
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    setSelectedColor(e.target.value);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {selectedColor === customColor && (
                  <Check size={11} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" strokeWidth={3} />
                )}
              </label>
              <span className="text-[10px] text-gray-400 dark:text-[#8A94A6] font-mono uppercase">{customColor}</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-brand-accent hover:bg-brand-accent-hover dark:bg-brand-accent-dark dark:hover:bg-brand-accent text-white dark:text-dark-bg text-xs font-semibold font-mono uppercase tracking-wider py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
        >
          <Plus size={13} strokeWidth={2.5} />
          <span>Criar Categoria</span>
        </button>
      </form>
    </div>
  );
}
