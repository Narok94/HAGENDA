import React, { useState, useEffect, useRef } from 'react';
import { Item, Category } from '../types';
import { X, Calendar, Clock, Tag, AlertTriangle, FileText, RefreshCw } from 'lucide-react';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<Item, 'id'> & { id?: string }) => void;
  categories: Category[];
  initialDate?: string; // Pre-filled date format YYYY-MM-DD
  editingItem?: Item | null;
  onDelete?: (itemId: string) => void;
}

export default function QuickAddModal({
  isOpen,
  onClose,
  onSave,
  categories,
  initialDate,
  editingItem,
  onDelete
}: QuickAddModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<'baixa' | 'média' | 'alta'>('média');
  const [note, setNote] = useState('');
  const [recurring, setRecurring] = useState<'diario' | 'semanal' | 'mensal' | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Initialize fields on open or edit
  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setTitle(editingItem.title);
        setDate(editingItem.date);
        setTime(editingItem.time || '');
        setCategory(editingItem.category || '');
        setPriority(editingItem.priority || 'média');
        setNote(editingItem.note || '');
        setRecurring(editingItem.recurring || null);
      } else {
        setTitle('');
        setDate(initialDate || new Date().toISOString().split('T')[0]);
        setTime('');
        setCategory(categories[0]?.id || '');
        setPriority('média');
        setNote('');
        setRecurring(null);
      }
      
      // Auto-focus title input
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, editingItem, initialDate, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    onSave({
      id: editingItem?.id,
      title: title.trim(),
      date,
      time: time || undefined,
      category: category || undefined,
      priority,
      note: note.trim() || undefined,
      completed: editingItem ? editingItem.completed : false,
      recurring
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm dark:backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
      ></div>
 
      {/* Modal Dialog */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-900 dark:text-[#E8EAED] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-dark-border px-5 py-4 bg-gray-50 dark:bg-dark-inner">
          <h2 className="font-display font-semibold text-base tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-accent dark:bg-brand-accent-dark animate-pulse"></span>
            {editingItem ? 'EDITAR COMPROMISSO' : 'NOVO COMPROMISSO'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-dark-hover rounded text-[#8A94A6] hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
 
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Title */}
          <div>
            <label className="block text-xs font-mono uppercase text-gray-500 dark:text-[#8A94A6] tracking-wider mb-1">Título do Item</label>
            <input
              ref={titleInputRef}
              type="text"
              required
              placeholder="Ex: Alinhamento trimestral com a diretoria"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-50 dark:bg-dark-inner border border-gray-200 dark:border-dark-border rounded-lg px-3.5 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#4E5A6C] focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent-dark text-sm transition-colors"
            />
          </div>
 
          {/* Date & Time Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 dark:text-[#8A94A6] tracking-wider mb-1 flex items-center gap-1.5">
                <Calendar size={12} className="text-brand-accent dark:text-brand-accent-dark" />
                Data
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-50 dark:bg-dark-inner border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent-dark text-sm font-mono transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 dark:text-[#8A94A6] tracking-wider mb-1 flex items-center gap-1.5">
                <Clock size={12} className="text-brand-accent dark:text-brand-accent-dark" />
                Horário <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">(Opcional)</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-gray-50 dark:bg-dark-inner border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent-dark text-sm font-mono transition-colors"
              />
            </div>
          </div>
 
          {/* Category & Priority Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 dark:text-[#8A94A6] tracking-wider mb-1 flex items-center gap-1.5">
                <Tag size={12} className="text-brand-accent dark:text-brand-accent-dark" />
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-50 dark:bg-dark-inner border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent-dark text-sm transition-colors"
              >
                <option value="">Sem Categoria</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 dark:text-[#8A94A6] tracking-wider mb-1 flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-brand-accent dark:text-brand-accent-dark" />
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-gray-50 dark:bg-dark-inner border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent-dark text-sm transition-colors"
              >
                <option value="baixa">Baixa</option>
                <option value="média">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>
 
          {/* Recurrence Selection */}
          <div>
            <label className="text-xs font-mono uppercase text-gray-500 dark:text-[#8A94A6] tracking-wider mb-1 flex items-center gap-1.5">
              <RefreshCw size={12} className="text-brand-accent dark:text-brand-accent-dark" />
              Recorrência
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Nenhuma', value: null },
                { label: 'Diária', value: 'diario' },
                { label: 'Semanal', value: 'semanal' },
                { label: 'Mensal', value: 'mensal' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setRecurring(opt.value as any)}
                  className={`py-1.5 px-1 text-xs font-mono rounded-lg border transition-all cursor-pointer ${
                    recurring === opt.value
                      ? 'bg-brand-accent/15 border-brand-accent text-brand-accent dark:bg-brand-accent-dark/15 dark:border-brand-accent-dark dark:text-brand-accent-dark font-semibold'
                      : 'bg-gray-50 dark:bg-dark-inner border-gray-200 dark:border-dark-border text-gray-500 dark:text-[#8A94A6] hover:bg-gray-100 dark:hover:bg-dark-hover hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
 
          {/* Note */}
          <div>
            <label className="text-xs font-mono uppercase text-gray-500 dark:text-[#8A94A6] tracking-wider mb-1 flex items-center gap-1.5">
              <FileText size={12} className="text-brand-accent dark:text-brand-accent-dark" />
              Nota Curta
            </label>
            <input
              type="text"
              placeholder="Ex: Levar documento de identidade impresso"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-gray-50 dark:bg-dark-inner border border-gray-200 dark:border-dark-border rounded-lg px-3.5 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#4E5A6C] focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent-dark text-sm transition-colors"
            />
          </div>
 
          {/* Actions Footer */}
          <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-dark-border mt-6">
            <div>
              {editingItem && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Tem certeza de que deseja remover este compromisso?')) {
                      onDelete(editingItem.id);
                      onClose();
                    }
                  }}
                  className="px-4 py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-300 font-mono text-xs uppercase rounded-lg border border-red-200 dark:border-red-900/30 transition-colors cursor-pointer"
                >
                  Excluir
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-50 dark:bg-dark-inner hover:bg-gray-100 dark:hover:bg-dark-hover border border-gray-200 dark:border-dark-border text-gray-700 dark:text-white font-mono text-xs uppercase rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                type="submit"
                className="px-5 py-2 bg-brand-accent hover:bg-brand-accent-hover dark:bg-brand-accent-dark dark:hover:bg-brand-accent text-white dark:text-dark-bg font-semibold font-mono text-xs uppercase rounded-lg shadow-md transition-all cursor-pointer"
              >
                Salvar
              </button>
            </div>
          </div>
 
        </form>
      </div>
    </div>
  );
}
