import React, { useState, useEffect } from 'react';
import { 
  Apple, CheckCircle2, Circle, Droplets, Info, Sparkles, Check, 
  RotateCw, ChevronDown, ChevronUp, Utensils, Calendar as CalendarIcon, Settings 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MEAL_PLAN, DIET_INFO, Meal } from '../data/dietData';

interface DietaTabProps {
  userName?: string;
  onOpenSettings?: () => void;
}

const getTodayStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DietaTab({ userName = 'Henrique', onOpenSettings }: DietaTabProps) {
  // Today's date string for resetting daily states YYYY-MM-DD
  const todayStr = getTodayStr();

  // Completed meals state (key: meal.id)
  const [completedMeals, setCompletedMeals] = useState<Record<string, boolean>>({});

  // Water intake state in ml
  const [waterIntakeMl, setWaterIntakeMl] = useState<number>(0);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  // Jantar Substitution Toggle (false = standard, true = cuscuz recheado)
  const [useJantarSubstitution, setUseJantarSubstitution] = useState<boolean>(() => {
    return localStorage.getItem('momentum_diet_jantar_sub') === 'true';
  });

  // Fetch diet state from database/API
  const fetchDietState = async () => {
    try {
      const res = await fetch('/api/diet-state');
      if (!res.ok) return;
      const data = await res.json();
      let meals: Record<string, boolean> = data.completedMeals || {};
      let water: number = Number(data.waterMl) || 0;

      if (data.dietDate !== todayStr) {
        // Reset for new day
        meals = {};
        water = 0;
        fetch('/api/diet-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dietDate: todayStr,
            completedMeals: {},
            waterMl: 0
          })
        }).catch(err => console.error(err));
      }

      setCompletedMeals(meals);
      setWaterIntakeMl(water);
    } catch (err) {
      console.error('Erro ao buscar estado da dieta:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync state to API
  const syncDietState = async (
    newMeals: Record<string, boolean>,
    newWater: number
  ) => {
    try {
      await fetch('/api/diet-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dietDate: todayStr,
          completedMeals: newMeals,
          waterMl: newWater
        })
      });
      window.dispatchEvent(new Event('momentum_diet_update'));
    } catch (err) {
      console.error('Erro ao salvar estado da dieta no servidor:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDietState();
  }, [todayStr]);

  // Listen for sync events from AgendaTab or other tabs
  useEffect(() => {
    const handleSync = () => {
      fetchDietState();
    };

    window.addEventListener('momentum_diet_update', handleSync);
    return () => {
      window.removeEventListener('momentum_diet_update', handleSync);
    };
  }, [todayStr]);

  useEffect(() => {
    localStorage.setItem('momentum_diet_jantar_sub', String(useJantarSubstitution));
  }, [useJantarSubstitution]);

  const handleToggleMeal = (mealId: string) => {
    const next = {
      ...completedMeals,
      [mealId]: !completedMeals[mealId]
    };
    setCompletedMeals(next);
    syncDietState(next, waterIntakeMl);
  };

  const handleAddWater = (amount: number) => {
    const nextWater = Math.min(waterIntakeMl + amount, 5000);
    setWaterIntakeMl(nextWater);
    syncDietState(completedMeals, nextWater);
  };

  const handleResetWater = () => {
    setWaterIntakeMl(0);
    syncDietState(completedMeals, 0);
  };

  const totalMeals = MEAL_PLAN.length;
  const completedCount = MEAL_PLAN.filter(m => completedMeals[m.id]).length;
  const progressPct = Math.round((completedCount / totalMeals) * 100);

  const waterTargetMl = 3000;
  const waterPct = Math.min(100, Math.round((waterIntakeMl / waterTargetMl) * 100));

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto pb-28 md:pb-12">
      {/* HEADER */}
      <div className="flex items-start justify-between pt-2 relative">
        <div className="pr-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#22C55E] uppercase tracking-wider font-display">
              Nutrição & Saúde
            </span>
            <span className="text-[10px] bg-[#22C55E]/10 text-[#22C55E] font-bold px-2 py-0.5 rounded-full">
              Plano Individual
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0E1730] font-display tracking-tight mt-1">
            Plano Alimentar
          </h1>
        </div>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="absolute top-2 right-0 p-2 text-[#9AA1B8] hover:text-[#0E1730] transition-colors cursor-pointer active:scale-95"
          >
            <Settings size={20} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* NUTRI BANNER */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#14532D] rounded-[24px] p-5 md:p-6 text-white shadow-xl space-y-4 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h2 className="text-base font-bold text-white font-display">
              {DIET_INFO.patient}
            </h2>
            <p className="text-xs text-white/70">
              Nutricionista: {DIET_INFO.nutritionist} ({DIET_INFO.crn}) • {DIET_INFO.instagram}
            </p>
          </div>
          <span className="text-[11px] bg-white/10 px-3 py-1 rounded-full text-white/80 w-fit">
            Atualizado em: {DIET_INFO.date}
          </span>
        </div>

        {/* GUIDELINES BADGES */}
        <div className="flex flex-wrap gap-2 pt-1">
          {DIET_INFO.guidelines.map((guide, idx) => (
            <span key={idx} className="text-xs bg-white/10 border border-white/15 px-3 py-1 rounded-xl text-emerald-300 font-medium flex items-center gap-1.5">
              <Sparkles size={12} className="text-emerald-400" />
              {guide}
            </span>
          ))}
        </div>
      </div>

      {/* WATER TRACKER & DAILY PROGRESS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* WATER TRACKER CARD */}
        <div className="bg-white rounded-[22px] border border-[#E3E8F1] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center shrink-0">
                <Droplets size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0E1730] font-display">Meta de Água</h3>
                <p className="text-[11px] text-[#69708A]">Meta diária: 3.0 Litros</p>
              </div>
            </div>
            <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg">
              {waterIntakeMl} / {waterTargetMl} ml
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#F1F5F9] h-2.5 rounded-full overflow-hidden">
            <motion.div 
              className="bg-sky-500 h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${waterPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => handleAddWater(250)}
              className="flex-1 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              + 250ml
            </button>
            <button
              onClick={() => handleAddWater(500)}
              className="flex-1 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              + 500ml
            </button>
            <button
              onClick={handleResetWater}
              className="p-1.5 text-[#69708A] hover:text-[#0E1730] transition-colors cursor-pointer"
              title="Resetar água"
            >
              <RotateCw size={14} />
            </button>
          </div>
        </div>

        {/* DIET PROGRESS CARD */}
        <div className="bg-white rounded-[22px] border border-[#E3E8F1] p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Apple size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0E1730] font-display">Progresso da Dieta</h3>
                <p className="text-[11px] text-[#69708A]">{completedCount} de {totalMeals} refeições feitas</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
              {progressPct}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#F1F5F9] h-2.5 rounded-full overflow-hidden">
            <motion.div 
              className="bg-emerald-500 h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <p className="text-[11px] text-[#69708A]">
            {progressPct === 100 
              ? '🎉 Excelente! Você bateu todas as refeições do plano hoje!' 
              : 'Marque cada refeição conforme for realizando durante o dia.'}
          </p>
        </div>
      </div>

      {/* MEALS LIST */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-[#69708A] uppercase tracking-wider font-display">
          Refeições Diárias
        </h2>

        {MEAL_PLAN.map((meal) => {
          const isDone = !!completedMeals[meal.id];
          const isJantar = meal.id === 'jantar';
          const activeOptions = isJantar && useJantarSubstitution 
            ? meal.substitutions! 
            : meal.options;

          return (
            <div
              key={meal.id}
              className={`bg-white rounded-[22px] border transition-all p-5 space-y-3 ${
                isDone ? 'border-emerald-200 bg-[#F8FAFC]' : 'border-[#E3E8F1] hover:border-[#CBD5E1]'
              }`}
            >
              {/* Meal Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleMeal(meal.id)}
                    className="shrink-0 cursor-pointer"
                  >
                    {isDone ? (
                      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xs">
                        <Check size={16} strokeWidth={3} />
                      </div>
                    ) : (
                      <Circle size={26} className="text-gray-300 hover:text-emerald-500" />
                    )}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded-md">
                        {meal.time}
                      </span>
                      <h3 className={`text-base font-bold font-display ${isDone ? 'line-through text-gray-400' : 'text-[#0E1730]'}`}>
                        {meal.title}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Jantar Substitution Toggle Button */}
                {isJantar && (
                  <button
                    onClick={() => setUseJantarSubstitution(!useJantarSubstitution)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Utensils size={12} />
                    <span>{useJantarSubstitution ? 'Ver Padrão' : 'Usar Substituição'}</span>
                  </button>
                )}
              </div>

              {/* Meal Content Options */}
              <div className="pl-10 space-y-2">
                {activeOptions.map((opt, oIdx) => (
                  <div key={oIdx} className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-2">
                    <p className="text-xs font-bold text-[#334155] font-display">
                      {opt.title}
                    </p>
                    <ul className="space-y-1">
                      {opt.items.map((item, iIdx) => (
                        <li key={iIdx} className="text-xs text-[#475569] flex items-start gap-2">
                          <span className="text-[#22C55E] font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    {opt.notes && (
                      <div className="pt-1 border-t border-[#E2E8F0] text-[11px] text-[#64748B] italic">
                        💡 {opt.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
