import React, { useState, useEffect } from 'react';
import { Item, Category, ActiveTab } from './types';
import SchedulePanel from './components/SchedulePanel';
import HojeTab from './components/HojeTab';
import SemanaTab from './components/SemanaTab';
import MesTab from './components/MesTab';
import CategorySettings from './components/CategorySettings';
import QuickAddModal from './components/QuickAddModal';
import { Sun, Moon, Search, Sparkles, Plus, AlertTriangle, Trash2, CalendarDays, Check, RefreshCw, Settings, Dumbbell, Flag, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Trabalho', color: '#5B5FEF' },
  { id: '2', name: 'Pessoal', color: '#0EA5B7' },
  { id: '3', name: 'Saúde', color: '#12A66B' },
  { id: '4', name: 'Estudos', color: '#E8A33D' }
];

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('hoje');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Date states
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // New states for Settings dropdown and Sleep (Soninho) alert
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [simulatedTime, setSimulatedTime] = useState<string | null>(null);
  const [ignoredSoninhoAlerts, setIgnoredSoninhoAlerts] = useState<string[]>([]);

  // Clock Ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // Update clock every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Initialize and load from LocalStorage
  useEffect(() => {
    // 1. Categories Loading
    const storedCategories = localStorage.getItem('agenda_pessoal_categories_v1');
    let loadedCategories: Category[] = [];
    if (storedCategories) {
      try {
        loadedCategories = JSON.parse(storedCategories);
        loadedCategories = loadedCategories.map(cat => {
          if (cat.id === '1' || cat.name === 'Trabalho') return { ...cat, color: '#5B5FEF' };
          if (cat.id === '2' || cat.name === 'Pessoal') return { ...cat, color: '#0EA5B7' };
          if (cat.id === '3' || cat.name === 'Saúde') return { ...cat, color: '#12A66B' };
          if (cat.id === '4' || cat.name === 'Estudos') return { ...cat, color: '#E8A33D' };
          return cat;
        });
      } catch (e) {
        loadedCategories = DEFAULT_CATEGORIES;
      }
    } else {
      loadedCategories = DEFAULT_CATEGORIES;
      localStorage.setItem('agenda_pessoal_categories_v1', JSON.stringify(DEFAULT_CATEGORIES));
    }
    setCategories(loadedCategories);

    // 2. Items Loading
    const storedItems = localStorage.getItem('agenda_pessoal_items_v1');
    let loadedItems: Item[] = [];
    if (storedItems) {
      try {
        loadedItems = JSON.parse(storedItems);
      } catch (e) {
        loadedItems = [];
      }
    } else {
      // Seed default items mapped to today's real dynamic date
      const todayStr = new Date().toISOString().split('T')[0];
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      loadedItems = [
        {
          id: 'sample-1',
          title: 'Revisão do painel de embarque',
          date: todayStr,
          time: '09:30',
          category: '1',
          priority: 'alta',
          note: 'Analisar e depurar a distribuição de ponteiros no arco horário.',
          completed: false
        },
        {
          id: 'sample-2',
          title: 'Caminhada esportiva matinal',
          date: todayStr,
          time: '07:15',
          category: '3',
          priority: 'baixa',
          completed: false,
          recurring: 'diario'
        },
        {
          id: 'sample-3',
          title: 'Organizar comprovantes fiscais',
          date: todayStr,
          category: '2',
          priority: 'média',
          note: 'Guardar na pasta azul do escritório.',
          completed: false
        },
        {
          id: 'sample-4',
          title: 'Consulta médica periódica',
          date: tomorrowStr,
          time: '14:30',
          category: '3',
          priority: 'alta',
          note: 'Clínica central - Sala 402.',
          completed: false
        },
        {
          id: 'sample-5',
          title: 'Sincronizar progresso de estudos',
          date: yesterdayStr,
          category: '4',
          priority: 'média',
          note: 'Revisar anotações da aula de terça-feira.',
          completed: false // This triggers the Overdue warning naturally!
        },
        {
          id: 'sample-6',
          title: 'Hora do Soninho 💤',
          date: todayStr,
          time: '22:30',
          category: '3', // Saúde
          priority: 'média',
          note: 'Desligar as telas, preparar o chá e ler um livro para relaxar.',
          completed: false,
          recurring: 'diario'
        }
      ];
      localStorage.setItem('agenda_pessoal_items_v1', JSON.stringify(loadedItems));
    }
    setItems(loadedItems);

    // 3. Theme Loading (Forced to Light Theme for clean white background)
    setTheme('light');
    localStorage.setItem('agenda_pessoal_theme_v1', 'light');
    document.documentElement.classList.remove('dark');
  }, []);

  // Keyboard shortcut Listener: 'n' to open Quick Add Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }
      
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setPrefilledDate(undefined);
        setEditingItem(null);
        setIsQuickAddOpen(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Toggle dark/light theme (Forced to Light Theme for clean white background)
  const toggleTheme = () => {
    setTheme('light');
    localStorage.setItem('agenda_pessoal_theme_v1', 'light');
    document.documentElement.classList.remove('dark');
  };

  // Safe item persistency operations
  const saveItemsList = (updatedItems: Item[]) => {
    setItems(updatedItems);
    localStorage.setItem('agenda_pessoal_items_v1', JSON.stringify(updatedItems));
  };

  // Add or update an item
  const handleSaveItem = (itemData: Omit<Item, 'id'> & { id?: string }) => {
    if (itemData.id) {
      // Editing existing item
      const updated = items.map(it => {
        if (it.id === itemData.id) {
          return { ...it, ...itemData } as Item;
        }
        return it;
      });
      saveItemsList(updated);
    } else {
      // Adding new item
      const newItem: Item = {
        ...itemData,
        id: 'item_' + Date.now() + Math.random().toString(36).substring(2, 6)
      };
      saveItemsList([...items, newItem]);
    }
  };

  // Toggle complete state on a specific date (handles both regular & recurring items)
  const handleToggleComplete = (itemId: string, dateStr: string) => {
    const updated = items.map(item => {
      if (item.id !== itemId) return item;
      
      if (item.recurring) {
        const customItem = { ...item } as any;
        const completedDates = customItem.completedDates ? [...customItem.completedDates] : [];
        if (completedDates.includes(dateStr)) {
          customItem.completedDates = completedDates.filter((d: string) => d !== dateStr);
        } else {
          customItem.completedDates = [...completedDates, dateStr];
        }
        return customItem;
      } else {
        return { ...item, completed: !item.completed };
      }
    });
    saveItemsList(updated);
  };

  // Delete an item safely
  const handleDeleteItem = (itemId: string) => {
    const filtered = items.filter(it => it.id !== itemId);
    saveItemsList(filtered);
  };

  // Inline Quick Add on Hoje Tab
  const handleInlineQuickAdd = (title: string, time?: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newItem: Item = {
      id: 'item_' + Date.now() + Math.random().toString(36).substring(2, 6),
      title,
      date: todayStr,
      time,
      completed: false,
      priority: 'média'
    };
    saveItemsList([...items, newItem]);
  };

  // Category management functions
  const handleAddCategory = (newCat: Omit<Category, 'id'>) => {
    const updated = [
      ...categories,
      {
        ...newCat,
        id: 'cat_' + Date.now() + Math.random().toString(36).substring(2, 6)
      }
    ];
    setCategories(updated);
    localStorage.setItem('agenda_pessoal_categories_v1', JSON.stringify(updated));
  };

  const handleDeleteCategory = (catId: string) => {
    const updated = categories.filter(c => c.id !== catId);
    setCategories(updated);
    localStorage.setItem('agenda_pessoal_categories_v1', JSON.stringify(updated));
    
    // Dissociate items from this category
    const adjustedItems = items.map(it => {
      if (it.category === catId) {
        const { category, ...rest } = it;
        return rest as Item;
      }
      return it;
    });
    saveItemsList(adjustedItems);
  };

  // Trigger modal for creating on date
  const triggerAddTaskOnDate = (dateStr: string) => {
    setPrefilledDate(dateStr);
    setEditingItem(null);
    setIsQuickAddOpen(true);
  };

  // Trigger modal for editing an item
  const triggerEditItem = (item: Item) => {
    setEditingItem(item);
    setPrefilledDate(item.date);
    setIsQuickAddOpen(true);
  };

  // Reset all data to defaults safely (with confirmation)
  const handleResetData = () => {
    if (confirm('ATENÇÃO: Isso removerá todos os seus compromissos e categorias criadas, redefinindo o aplicativo para as configurações originais de fábrica. Deseja prosseguir com a redefinição?')) {
      localStorage.removeItem('agenda_pessoal_items_v1');
      localStorage.removeItem('agenda_pessoal_categories_v1');
      window.location.reload();
    }
  };

  // Helper to check if a recurring item falls on a date
  const isItemRecurringOnDate = (item: Item, dateStr: string): boolean => {
    if (!item.recurring) return item.date === dateStr;
    if (item.date > dateStr) return false; // Starts in the future
    
    const itemDate = new Date(item.date + 'T00:00:00');
    const targetDate = new Date(dateStr + 'T00:00:00');
    
    if (item.recurring === 'diario') {
      return true;
    }
    if (item.recurring === 'semanal') {
      return itemDate.getDay() === targetDate.getDay();
    }
    if (item.recurring === 'mensal') {
      return itemDate.getDate() === targetDate.getDate();
    }
    return false;
  };

  // Get active, uncompleted sleep item that is currently approaching its time
  const getApproachingSoninho = (itemsList: Item[]) => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Find sleep-related items for today
    const sleepItems = itemsList.filter(item => {
      if (item.completed || ignoredSoninhoAlerts.includes(item.id)) return false;
      
      const titleLower = item.title.toLowerCase();
      const isSleep = titleLower.includes('sono') || titleLower.includes('dormir') || titleLower.includes('sleep');
      if (!isSleep) return false;
      
      return item.date === todayStr || (item.recurring && isItemRecurringOnDate(item, todayStr));
    });

    if (sleepItems.length === 0) return null;

    // Get current hours and minutes (simulated or real)
    let currentHours: number;
    let currentMinutes: number;
    if (simulatedTime) {
      const [sh, sm] = simulatedTime.split(':').map(Number);
      currentHours = sh;
      currentMinutes = sm;
    } else {
      currentHours = currentTime.getHours();
      currentMinutes = currentTime.getMinutes();
    }
    
    const currentTotalMin = currentHours * 60 + currentMinutes;

    for (const item of sleepItems) {
      if (!item.time) continue;
      const [ih, im] = item.time.split(':').map(Number);
      const itemTotalMin = ih * 60 + im;

      const diff = itemTotalMin - currentTotalMin;
      
      // Trigger if current time is within 60 mins before, or up to 30 mins after
      if (diff >= -30 && diff <= 60) {
        return { item, minutesRemaining: diff };
      }
    }

    return null;
  };

  // Set simulation to test the sleep alert
  const handleTestSoninhoAlert = () => {
    // 1. Check if there's a sleep-related item
    let sleepItem = items.find(item => {
      const titleLower = item.title.toLowerCase();
      return titleLower.includes('sono') || titleLower.includes('dormir') || titleLower.includes('sleep');
    });

    const todayStr = new Date().toISOString().split('T')[0];

    if (!sleepItem) {
      // 2. Create one if none exists!
      const newSleepItem: Item = {
        id: 'simulated-sleep-' + Date.now(),
        title: 'Hora do Soninho 💤',
        date: todayStr,
        time: '22:30',
        category: '3', // Saúde
        priority: 'média',
        note: 'Desligar as telas, preparar o chá e ler um livro para relaxar.',
        completed: false,
        recurring: 'diario'
      };
      
      const updated = [newSleepItem, ...items];
      setItems(updated);
      localStorage.setItem('agenda_pessoal_items_v1', JSON.stringify(updated));
      sleepItem = newSleepItem;
    } else {
      // If found but completed, make it active
      if (sleepItem.completed) {
        const updated = items.map(it => {
          if (it.id === sleepItem!.id) {
            return { ...it, completed: false };
          }
          return it;
        });
        setItems(updated);
        localStorage.setItem('agenda_pessoal_items_v1', JSON.stringify(updated));
        sleepItem = { ...sleepItem, completed: false };
      }
    }

    // 3. Set the simulated time to exactly 15 minutes before the task!
    if (sleepItem.time) {
      const [h, m] = sleepItem.time.split(':').map(Number);
      let targetMin = h * 60 + m - 15;
      if (targetMin < 0) targetMin += 24 * 60;
      
      const simH = Math.floor(targetMin / 60).toString().padStart(2, '0');
      const simM = (targetMin % 60).toString().padStart(2, '0');
      
      // Remove from ignored so it pops up
      setIgnoredSoninhoAlerts(prev => prev.filter(id => id !== sleepItem!.id));
      setSimulatedTime(`${simH}:${simM}`);
    }
  };

  // Control functions for sleep alert
  const handleSnoozeSleepAlert = (itemId: string) => {
    const updated = items.map(it => {
      if (it.id === itemId && it.time) {
        const [h, m] = it.time.split(':').map(Number);
        let newMin = h * 60 + m + 15;
        if (newMin >= 24 * 60) newMin -= 24 * 60;
        const newH = Math.floor(newMin / 60).toString().padStart(2, '0');
        const newM = (newMin % 60).toString().padStart(2, '0');
        return { ...it, time: `${newH}:${newM}` };
      }
      return it;
    });
    setItems(updated);
    localStorage.setItem('agenda_pessoal_items_v1', JSON.stringify(updated));
    setSimulatedTime(null);
  };

  const handleCompleteSleepAlert = (itemId: string) => {
    const updated = items.map(it => {
      if (it.id === itemId) {
        return { ...it, completed: true };
      }
      return it;
    });
    setItems(updated);
    localStorage.setItem('agenda_pessoal_items_v1', JSON.stringify(updated));
    setSimulatedTime(null);
  };

  // Global search filtering
  const todayStr = new Date().toISOString().split('T')[0];
  const searchResults = searchQuery.trim() 
    ? items.filter(it => 
        it.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (it.note && it.note.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  // Helper to determine if an item is completed on a date for search display
  const isItemCompletedOnDate = (item: Item, targetStr: string): boolean => {
    if (!item.recurring) return item.completed;
    const customItem = item as any;
    if (customItem.completedDates && Array.isArray(customItem.completedDates)) {
      return customItem.completedDates.includes(targetStr);
    }
    return item.completed;
  };

  return (
    <div className="h-[100dvh] w-screen bg-white text-[#1A1F2B] dark:bg-white dark:text-[#1A1F2B] transition-colors duration-200 font-sans flex flex-col overflow-hidden">
      
      {/* GLOBAL HEADER BAR - Styled exactly like the screenshot with profile avatar, personalized title, notification bell & settings toggles */}
      <header className="shrink-0 z-40 bg-white dark:bg-white px-4 pt-6 pb-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          {/* Left Side: Avatar Profile + Greetings Group */}
          <div className="flex items-center gap-3.5">
            {/* HE Profile Avatar (Royal Blue circle with bold white text) */}
            <div className="w-12 h-12 rounded-full bg-brand-accent flex items-center justify-center text-white font-sans font-bold text-sm tracking-wide shadow-md shadow-brand-accent/15 shrink-0">
              HE
            </div>
            
            {/* Header Text Labels */}
            <div className="flex flex-col">
              <span className="text-[11px] font-mono font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase leading-none">
                OLÁ, HENRIQUE 👋
              </span>
              <h1 className="font-sans font-extrabold text-gray-950 dark:text-white text-lg sm:text-xl lg:text-2xl tracking-tight leading-none mt-1">
                Pronto para evoluir hoje?
              </h1>
              <span className="text-[11px] text-gray-400 dark:text-[#525E72] font-normal leading-normal mt-0.5 block">
                Disciplina hoje, resultado sempre.
              </span>
            </div>
          </div>

          {/* Right Side: Search & Compact Round Controls (Bell + Settings) */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            {/* Real-time search with elegant rounded-full input */}
            <div className="relative w-full sm:w-48">
              <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#525E72]" />
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#E2E5EC] rounded-full pl-9 pr-3.5 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-accent transition-colors shadow-[0_2px_8px_rgba(16,24,40,0.06)]"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Notification Bell (Circular button with status indicator like in the screenshot) */}
              <button
                className="relative p-2.5 bg-white border border-[#E2E5EC] rounded-full hover:text-brand-accent transition-all text-gray-500 shadow-[0_2px_8px_rgba(16,24,40,0.06)] cursor-pointer"
                title="Notificações"
              >
                <Bell size={14} className="stroke-2" />
                {/* Small indicator badge */}
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-brand-accent rounded-full border border-white" />
              </button>

              {/* Settings Dropdown Container */}
              <div className="relative">
                <button
                  onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
                  className={`p-2.5 border rounded-full transition-all cursor-pointer shadow-[0_2px_8px_rgba(16,24,40,0.06)] ${
                    isSettingsDropdownOpen
                      ? 'bg-brand-accent text-white border-brand-accent shadow-md'
                      : 'bg-white border-[#E2E5EC] hover:text-brand-accent text-gray-500'
                  }`}
                  title="Configurações"
                >
                  <Settings size={14} className="stroke-2" />
                </button>
                
                {isSettingsDropdownOpen && (
                  <>
                    {/* Backdrop to dismiss on click outside */}
                    <div 
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setIsSettingsDropdownOpen(false)}
                    />
                    
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E2E5EC] rounded-2xl shadow-[0_10px_30px_rgba(16,24,40,0.12)] py-2 z-50 animate-in fade-in slide-in-from-top-3 duration-150">
                      <div className="px-4 py-2 border-b border-gray-100 pb-1.5 mb-1.5">
                        <span className="block text-[10px] font-mono font-bold tracking-wider text-gray-400 uppercase">Configurações</span>
                      </div>
                      
                      {/* Option 1: Toggle stats panel */}
                      <button
                        onClick={() => {
                          setActiveTab(activeTab === 'painel' ? 'hoje' : 'painel');
                          setIsSettingsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-xs font-semibold text-gray-700 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Sparkles size={14} className="text-brand-gold shrink-0" />
                        <span>{activeTab === 'painel' ? 'Ver Agenda' : 'Abrir Painel de Estatísticas'}</span>
                      </button>

                      {/* Option 2: Test soninho alert */}
                      <button
                        onClick={() => {
                          handleTestSoninhoAlert();
                          setIsSettingsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-xs font-semibold text-gray-700 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Moon size={14} className="text-indigo-500 shrink-0" />
                        <span>💤 Testar Alerta do Soninho</span>
                      </button>

                      {/* Option 3: Reset data */}
                      <button
                        onClick={() => {
                          handleResetData();
                          setIsSettingsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-xs font-semibold text-[#C21E1E] flex items-center gap-2 transition-colors cursor-pointer border-t border-gray-100 mt-1.5 pt-2"
                      >
                        <Trash2 size={14} className="shrink-0" />
                        <span>Redefinir Todos os Dados</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* SEARCH RESULTS BOARD OVERLAY (shown only when searching) */}
      {searchQuery.trim() !== '' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6">
          <div className="bg-white border border-[#E2E5EC] rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,24,40,0.06)]">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-dark-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-brand-gold" />
                <h2 className="font-display font-semibold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                  Resultados da Busca para "{searchQuery}" ({searchResults.length})
                </h2>
              </div>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-mono text-brand-gold hover:underline cursor-pointer font-bold"
              >
                LIMPAR BUSCA
              </button>
            </div>

            {searchResults.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-[#8A94A6] py-4 text-center">Nenhum compromisso correspondente aos termos digitados.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.map(item => {
                  const cat = categories.find(c => c.id === item.category);
                  const isCompleted = isItemCompletedOnDate(item, item.date);
                  const formattedDate = new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                  
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                        isCompleted 
                          ? 'bg-gray-50 dark:bg-black/20 border-gray-100 dark:border-gray-900 opacity-60' 
                          : 'bg-gray-50/50 dark:bg-dark-inner border-gray-200/60 dark:border-dark-border shadow-xs'
                      }`}
                    >
                      <button
                        onClick={() => handleToggleComplete(item.id, item.date)}
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isCompleted
                            ? 'bg-emerald-500 border-emerald-600 text-white shadow-inner shadow-emerald-700/20'
                            : 'border-gray-300 dark:border-gray-700 text-transparent hover:border-brand-gold'
                        }`}
                      >
                        <Check size={11} strokeWidth={3.5} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-gray-400 uppercase">{formattedDate}</span>
                          {item.time && <span className="font-mono text-[10px] text-brand-gold font-bold">{item.time}</span>}
                          
                          <h4 
                            onClick={() => triggerEditItem(item)}
                            className={`text-xs font-semibold text-gray-900 dark:text-white truncate cursor-pointer hover:underline ${
                              isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : ''
                            }`}
                          >
                            {item.title}
                          </h4>
                        </div>
                        
                        {item.note && <p className="text-[11px] text-gray-400 mt-1 truncate">{item.note}</p>}
                        
                        <div className="flex items-center gap-2 mt-2">
                          {cat && (
                            <span 
                              className="text-[9px] px-1.5 py-0.2 rounded font-medium"
                              style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                            >
                              {cat.name}
                            </span>
                          )}
                          {item.recurring && (
                            <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1 rounded">
                              ↺ {item.recurring}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SONINHO ALERT BAR - Sliding in beautifully if a sleep-related task is approaching */}
      <AnimatePresence>
        {(() => {
          const alertInfo = getApproachingSoninho(items);
          if (!alertInfo) return null;
          const { item, minutesRemaining } = alertInfo;
          return (
            <motion.div
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              className="max-w-7xl w-full mx-auto px-4 sm:px-8 mt-2 overflow-hidden shrink-0"
            >
              <div 
                className="rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-amber-500/20 text-white relative shadow-[0_10px_25px_-5px_rgba(15,23,42,0.3),0_0_15px_rgba(245,158,11,0.15)] overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0B0F19 0%, #172554 100%)' }}
              >
                {/* Micro stars particles for cozy look */}
                <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
                
                <div className="flex items-start gap-3.5 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-400/20 flex items-center justify-center text-amber-300 shrink-0 animate-pulse">
                    <Moon size={20} className="stroke-[1.5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-amber-300 tracking-wider uppercase bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        ✨ Hora do Descanso
                      </span>
                      {simulatedTime && (
                        <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 rounded-full">
                          Modo de Teste
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1">
                      O seu soninho está se aproximando!
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      Seu compromisso <strong className="text-white">"{item.title}"</strong> está agendado para as <span className="text-amber-300 font-mono font-bold">{item.time}</span> ({minutesRemaining > 0 ? `faltam ${minutesRemaining} minutos` : 'está no horário!'}). Comece a desacelerar, desligue as telas e relaxe.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 relative z-10 self-end md:self-center shrink-0">
                  <button
                    onClick={() => handleCompleteSleepAlert(item.id)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Check size={14} strokeWidth={2.5} />
                    <span>Concluir</span>
                  </button>
                  <button
                    onClick={() => handleSnoozeSleepAlert(item.id)}
                    className="bg-white/10 hover:bg-white/15 text-white border border-white/10 font-sans font-semibold text-xs px-3.5 py-2 rounded-xl transition-colors active:scale-95 cursor-pointer"
                  >
                    Adiar 15 min
                  </button>
                  <button
                    onClick={() => setIgnoredSoninhoAlerts(prev => [...prev, item.id])}
                    className="text-[11px] text-slate-400 hover:text-white px-2 py-2 transition-colors cursor-pointer"
                    title="Ignorar alerta"
                  >
                    Dispensar
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* CORE ZOOM LEVEL NAVIGATION TABS - Blended layout */}
      <nav className="shrink-0 bg-white dark:bg-white px-4 sm:px-8 pb-1">
        <div className="flex max-w-7xl mx-auto border-b border-gray-200 dark:border-dark-border justify-between md:justify-start">
          {[
            { id: 'hoje', label: 'HOJE' },
            { id: 'semana', label: 'SEMANAL' },
            { id: 'mes', label: 'MENSAL' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`py-2.5 px-4 text-xs font-mono font-bold tracking-wider relative cursor-pointer transition-all ${
                  isActive
                    ? 'text-brand-accent dark:text-brand-accent-dark font-extrabold'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-brand-accent dark:bg-brand-accent-dark animate-fade-in" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* MAIN TWO-COLUMN DASHBOARD GRID - Scrollable viewport on mobile, grid on desktop */}
      <main className="flex-1 overflow-y-auto max-w-7xl w-full mx-auto px-4 sm:px-8 py-4 lg:grid lg:grid-cols-3 lg:gap-6 items-start">
        
        {/* Left Column (Main Focus Zone): Dynamic zoom views */}
        <div className={`lg:col-span-2 space-y-4 ${activeTab === 'painel' ? 'hidden lg:block' : 'block'}`}>
          {(activeTab === 'hoje' || activeTab === 'painel') && (
            <HojeTab
              items={items}
              categories={categories}
              onToggleComplete={handleToggleComplete}
              onEditItem={triggerEditItem}
              onQuickAdd={handleInlineQuickAdd}
              selectedDateStr={todayStr}
            />
          )}

          {activeTab === 'semana' && (
            <SemanaTab
              items={items}
              categories={categories}
              referenceDate={referenceDate}
              onSetReferenceDate={setReferenceDate}
              onToggleComplete={handleToggleComplete}
              onAddTaskOnDate={triggerAddTaskOnDate}
              onEditItem={triggerEditItem}
            />
          )}

          {activeTab === 'mes' && (
            <MesTab
              items={items}
              categories={categories}
              referenceDate={referenceDate}
              onSetReferenceDate={setReferenceDate}
              onToggleComplete={handleToggleComplete}
              onAddTaskOnDate={triggerAddTaskOnDate}
              onEditItem={triggerEditItem}
            />
          )}
        </div>

        {/* Right Column (Widget / Control Zone): Stations & Color Settings */}
        {/* On mobile, this column is shown only when the "PAINEL" tab is selected. On desktop it is always visible. */}
        <div className={`space-y-4 lg:block ${activeTab === 'painel' ? 'block' : 'hidden'}`}>
          
          {/* ASSIGNMENT TIMETABLE ARC WIDGET */}
          <SchedulePanel 
            items={items} 
            categories={categories}
            onTaskClick={(itemId) => {
              const matched = items.find(it => it.id === itemId);
              if (matched) triggerEditItem(matched);
            }}
          />

          {/* DYNAMIC CATEGORIES CONFIGURATION PANEL */}
          <CategorySettings
            categories={categories}
            items={items}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
          />

          {/* COMPACT GENERAL METRICS & FOOTER CONTROLS */}
          <div className="bg-white p-5 rounded-[20px] border border-[#E2E5EC] shadow-[0_2px_8px_rgba(16,24,40,0.06)] text-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-mono font-bold uppercase text-gray-400 tracking-wider flex items-center gap-2">
                <Sparkles size={14} className="text-brand-gold" />
                <span>Painel de Estatísticas</span>
              </h3>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="bg-gray-50 p-2.5 rounded-xl border border-[#E2E5EC]">
                <span className="block text-[9px] text-gray-400 uppercase">Total de Itens</span>
                <span className="text-sm font-bold text-brand-gold text-gold-glow tabular-nums">{items.length}</span>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-xl border border-[#E2E5EC]">
                <span className="block text-[9px] text-gray-400 uppercase">Concluídos</span>
                <span className="text-sm font-bold text-emerald-500 tabular-nums">
                  {items.filter(it => it.completed).length}
                </span>
              </div>
            </div>

            <div className="border-t border-[#E2E5EC] pt-4 flex flex-col gap-2">
              <button
                onClick={() => {
                  setPrefilledDate(undefined);
                  setEditingItem(null);
                  setIsQuickAddOpen(true);
                }}
                className="w-full bg-[#1B4F91] hover:bg-[#101B3D] text-white font-semibold font-sans text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus size={13} strokeWidth={2} />
                <span>NOVO COMPROMISSO</span>
              </button>

              <button
                onClick={handleResetData}
                className="w-full bg-red-50 hover:bg-red-100 text-[#C21E1E] border border-red-200 font-mono text-[10px] uppercase py-2 rounded-xl transition-colors cursor-pointer"
              >
                REDEFINIR TODOS OS DADOS
              </button>
            </div>
          </div>

        </div>

      </main>

      {/* COMPACT FLOATING BAR FOR QUICK ACCESSIBILITY */}
      <div className="fixed bottom-[88px] right-4 z-40 block sm:hidden">
        <button
          onClick={() => {
            setPrefilledDate(undefined);
            setEditingItem(null);
            setIsQuickAddOpen(true);
          }}
          className="w-12 h-12 rounded-full bg-brand-accent hover:bg-brand-accent-hover text-white flex items-center justify-center shadow-lg shadow-brand-accent/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Novo Compromisso"
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      </div>

      {/* GLOBAL BOTTOM NAVIGATION - Hub style */}
      <nav className="shrink-0 bg-white dark:bg-dark-card border-t border-gray-100 dark:border-dark-border py-2 px-6 flex items-center justify-around z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] dark:shadow-none">
        {/* Agenda */}
        <button
          onClick={() => {
            if (activeTab === 'painel') {
              setActiveTab('hoje');
            }
          }}
          className="flex flex-col items-center gap-0.5 cursor-pointer transition-all text-brand-accent dark:text-brand-accent-dark font-semibold"
          title="Agenda"
        >
          <CalendarDays size={20} className="stroke-2" />
          <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Agenda</span>
          <span className="w-1.5 h-1.5 rounded-full bg-brand-accent dark:bg-brand-accent-dark mt-0.5" />
        </button>

        {/* Academia */}
        <a
          href="https://horusfit.vercel.app/"
          className="flex flex-col items-center gap-0.5 cursor-pointer transition-all text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          title="Academia"
        >
          <Dumbbell size={20} className="stroke-2" />
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Academia</span>
          <span className="w-1.5 h-1.5 rounded-full bg-transparent mt-0.5" />
        </a>

        {/* Desafio */}
        <a
          href="https://desafio90d.vercel.app/"
          className="flex flex-col items-center gap-0.5 cursor-pointer transition-all text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          title="Desafio"
        >
          <Flag size={20} className="stroke-2" />
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Desafio</span>
          <span className="w-1.5 h-1.5 rounded-full bg-transparent mt-0.5" />
        </a>
      </nav>

      {/* DYNAMIC MULTI-FUNCTION MODAL DIALOG */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => {
          setIsQuickAddOpen(false);
          setEditingItem(null);
          setPrefilledDate(undefined);
        }}
        onSave={handleSaveItem}
        categories={categories}
        initialDate={prefilledDate}
        editingItem={editingItem}
        onDelete={handleDeleteItem}
      />

    </div>
  );
}
