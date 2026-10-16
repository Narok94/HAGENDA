import React, { useState, useEffect } from 'react';
import { 
  Dumbbell, CheckCircle2, Circle, Flame, Sparkles, Trophy, RotateCw, 
  ChevronRight, Info, Edit3, ArrowRight, Check, ExternalLink, Calendar as CalendarIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WORKOUT_GROUPS, WorkoutGroup, Exercise } from '../data/workoutData';

interface AcademiaTabProps {
  userName?: string;
}

const getTodayStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AcademiaTab({ userName = 'Henrique' }: AcademiaTabProps) {
  const todayStr = getTodayStr();

  // Active group that represents today's current workout session
  const [activeGroupId, setActiveGroupId] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('A');

  // Selected tab group in view (defaults to active group)
  const [selectedGroupId, setSelectedGroupId] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('A');

  // Completed exercises for today: key is `exerciseId`
  const [todayCompletedExercises, setTodayCompletedExercises] = useState<Record<string, boolean>>({});

  // Weights (cargas) saved per exercise
  const [exerciseWeights, setExerciseWeights] = useState<Record<string, string>>({});

  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  // Celebration modal state
  const [showCelebration, setShowCelebration] = useState(false);
  const [completedStats, setCompletedStats] = useState<{ title: string; subtitle: string; nextGroup: string } | null>(null);

  // Fetch workout state from database/API
  const fetchWorkoutState = async () => {
    try {
      const res = await fetch('/api/workout-state');
      if (!res.ok) return;
      const data = await res.json();
      const group = (data.activeGroupId as 'A' | 'B' | 'C' | 'D' | 'E') || 'A';
      setActiveGroupId(group);

      let completed: Record<string, boolean> = data.completedExercises || {};
      if (data.workoutDate !== todayStr) {
        // New day, reset completed exercises for today in backend
        completed = {};
        fetch('/api/workout-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeGroupId: group,
            workoutDate: todayStr,
            completedExercises: {},
            weights: data.weights || {}
          })
        }).catch(err => console.error(err));
      }

      setTodayCompletedExercises(completed);
      setExerciseWeights(data.weights || {});
      setSelectedGroupId(prev => isLoading ? group : prev);
    } catch (err) {
      console.error('Erro ao buscar estado do treino:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync state to API
  const syncWorkoutState = async (
    newGroup: 'A' | 'B' | 'C' | 'D' | 'E',
    newCompleted: Record<string, boolean>,
    newWeights: Record<string, string>
  ) => {
    try {
      await fetch('/api/workout-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeGroupId: newGroup,
          workoutDate: todayStr,
          completedExercises: newCompleted,
          weights: newWeights
        })
      });
      window.dispatchEvent(new Event('momentum_workout_update'));
    } catch (err) {
      console.error('Erro ao salvar estado do treino no servidor:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchWorkoutState();
  }, [todayStr]);

  // Listen for sync events from AgendaTab or other tabs
  useEffect(() => {
    const handleSync = () => {
      fetchWorkoutState();
    };

    window.addEventListener('momentum_workout_update', handleSync);
    return () => {
      window.removeEventListener('momentum_workout_update', handleSync);
    };
  }, [todayStr]);

  const currentViewGroup = WORKOUT_GROUPS.find(g => g.id === selectedGroupId) || WORKOUT_GROUPS[0];
  const isTodayGroup = selectedGroupId === activeGroupId;

  const handleToggleExercise = (exerciseId: string) => {
    const updated = {
      ...todayCompletedExercises,
      [exerciseId]: !todayCompletedExercises[exerciseId]
    };
    setTodayCompletedExercises(updated);
    syncWorkoutState(activeGroupId, updated, exerciseWeights);
  };

  const handleWeightChange = (exerciseId: string, weight: string) => {
    const updatedWeights = {
      ...exerciseWeights,
      [exerciseId]: weight
    };
    setExerciseWeights(updatedWeights);
    syncWorkoutState(activeGroupId, todayCompletedExercises, updatedWeights);
  };

  // Check how many exercises in the active group are completed
  const activeGroup = WORKOUT_GROUPS.find(g => g.id === activeGroupId)!;
  const activeCompletedCount = activeGroup.exercises.filter(ex => todayCompletedExercises[ex.id]).length;
  const activeTotalCount = activeGroup.exercises.length;

  // Handle "Finalizar Treino do Dia"
  const handleFinishDayWorkout = () => {
    // Calculate next group in cycle: A -> B -> C -> D -> E -> A
    const groupOrder: Array<'A' | 'B' | 'C' | 'D' | 'E'> = ['A', 'B', 'C', 'D', 'E'];
    const currentIndex = groupOrder.indexOf(activeGroupId);
    const nextGroupId = groupOrder[(currentIndex + 1) % groupOrder.length];
    const nextGroupObj = WORKOUT_GROUPS.find(g => g.id === nextGroupId)!;

    // Record in history
    const historyItem = {
      date: new Date().toISOString(),
      groupId: activeGroupId,
      title: activeGroup.title,
      subtitle: activeGroup.subtitle,
      completedExercises: activeCompletedCount,
      totalExercises: activeTotalCount,
    };

    const savedHistory = JSON.parse(localStorage.getItem('momentum_workout_history') || '[]');
    localStorage.setItem('momentum_workout_history', JSON.stringify([historyItem, ...savedHistory]));

    // Show celebration modal
    setCompletedStats({
      title: activeGroup.title,
      subtitle: activeGroup.subtitle,
      nextGroup: `${nextGroupObj.title} - ${nextGroupObj.subtitle}`,
    });
    setShowCelebration(true);

    // Advance to next group
    setActiveGroupId(nextGroupId);
    setSelectedGroupId(nextGroupId);

    // Clear completed exercises for the new workout day
    setTodayCompletedExercises({});
    syncWorkoutState(nextGroupId, {}, exerciseWeights);
  };

  return (
    <div className="py-2 space-y-6 max-w-4xl mx-auto pb-12">

      {/* TODAY'S WORKOUT BANNER / HERO CARD */}
      <div className="bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#312E81] rounded-[24px] p-5 md:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-[#FF8A24] border border-white/15">
            <Flame size={14} className="fill-[#FF8A24]" />
            <span>Treino do Dia</span>
          </div>
          <span className="text-xs text-white/70 font-medium flex items-center gap-1">
            <RotateCw size={12} /> Intervalo: 45s | Progressão de Carga
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold font-display text-white">{activeGroup.title}</span>
              <span className="text-sm font-medium text-white/70">({activeGroup.subtitle})</span>
            </div>
            <p className="text-xs text-white/80 mt-1">
              Progresso hoje: <strong className="text-white">{activeCompletedCount} de {activeTotalCount}</strong> exercícios concluídos
            </p>
          </div>

          <button
            onClick={() => setSelectedGroupId(activeGroupId)}
            className="px-4 py-2.5 bg-[#FF8A24] hover:bg-[#E07312] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition-all self-start sm:self-auto cursor-pointer"
          >
            <span>Ver Treino de Hoje</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/15 h-2 rounded-full mt-4 overflow-hidden">
          <motion.div 
            className="bg-gradient-to-r from-[#FF8A24] to-[#22C55E] h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(activeCompletedCount / activeTotalCount) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* WORKOUT GROUP SELECTOR TABS (A, B, C, D, E) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-[#69708A] uppercase tracking-wider font-display">
            Selecione o Grupo
          </p>
          <span className="text-xs text-[#69708A]">
            Clique para ver os exercícios de outro dia
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {WORKOUT_GROUPS.map((group) => {
            const isSelected = group.id === selectedGroupId;
            const isCurrentActive = group.id === activeGroupId;

            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className={`relative py-3 px-2 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white border-[#2F5CFF] shadow-md ring-2 ring-[#2F5CFF]/20'
                    : 'bg-white/70 border-[#E3E8F1] hover:bg-white text-text-sec'
                }`}
              >
                {isCurrentActive && (
                  <span className="absolute -top-2 bg-[#FF8A24] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                    HOJE
                  </span>
                )}
                <span className={`text-base font-bold font-display ${isSelected ? 'text-[#2F5CFF]' : 'text-[#0E1730]'}`}>
                  {group.id}
                </span>
                <span className="text-[10px] text-[#69708A] font-medium truncate max-w-full hidden sm:block mt-0.5">
                  {group.subtitle.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SELECTED WORKOUT DETAILS */}
      <div className="bg-white rounded-[24px] border border-[#E3E8F1] p-5 md:p-6 shadow-xs space-y-5">
        {/* GROUP HEADER */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E3E8F1]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white px-2.5 py-1 rounded-lg" style={{ backgroundColor: currentViewGroup.accentColor }}>
                {currentViewGroup.title}
              </span>
              <h2 className="text-lg md:text-xl font-bold text-[#0E1730] font-display">
                {currentViewGroup.subtitle}
              </h2>
            </div>
            <p className="text-xs text-[#69708A] mt-1">
              {currentViewGroup.exercises.length} exercícios na rotina
            </p>
          </div>

          {!isTodayGroup && (
            <button
              onClick={() => {
                setActiveGroupId(currentViewGroup.id);
                syncWorkoutState(currentViewGroup.id, todayCompletedExercises, exerciseWeights);
              }}
              className="text-xs text-[#2F5CFF] hover:bg-[#2F5CFF]/10 px-3 py-1.5 rounded-xl font-semibold border border-[#2F5CFF]/30 transition-colors flex items-center gap-1 cursor-pointer"
            >
              Definir como Treino de Hoje
            </button>
          )}
        </div>

        {/* EXERCISES LIST */}
        <div className="space-y-3">
          {currentViewGroup.exercises.map((exercise, idx) => {
            const isCompleted = !!todayCompletedExercises[exercise.id];
            const weight = exerciseWeights[exercise.id] || '';

            return (
              <div
                key={exercise.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCompleted
                    ? 'bg-[#F8FAFC] border-emerald-200'
                    : 'bg-white border-[#E3E8F1] hover:border-[#CBD5E1]'
                }`}
              >
                {/* Left: Check & Exercise Name */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleExercise(exercise.id)}
                    className="mt-0.5 shrink-0 text-text-sec hover:text-[#2F5CFF] transition-colors cursor-pointer"
                  >
                    {isCompleted ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xs">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    ) : (
                      <Circle size={22} className="text-gray-300 hover:text-[#2F5CFF]" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#69708A]">#{idx + 1}</span>
                      <h3 className={`text-sm md:text-base font-bold font-display ${isCompleted ? 'line-through text-gray-400' : 'text-[#0E1730]'}`}>
                        {exercise.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#69708A] mt-1 flex-wrap">
                      <span className="bg-[#F1F5F9] px-2 py-0.5 rounded-md font-semibold text-[#334155]">
                        {exercise.series} {exercise.series === 1 ? 'Série' : 'Séries'}
                      </span>
                      <span className="bg-[#F1F5F9] px-2 py-0.5 rounded-md font-semibold text-[#334155]">
                        {exercise.reps} Reps
                      </span>
                      {exercise.notes && (
                        <span className="text-[11px] text-[#2F5CFF] font-medium bg-[#2F5CFF]/10 px-2 py-0.5 rounded-md">
                          {exercise.notes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Load Input */}
                <div className="flex items-center gap-2 self-end sm:self-center bg-[#F8FAFC] p-1.5 rounded-xl border border-[#E2E8F0]">
                  <span className="text-xs font-semibold text-[#69708A] pl-1">Carga:</span>
                  <input
                    type="text"
                    placeholder="0"
                    value={weight}
                    onChange={(e) => handleWeightChange(exercise.id, e.target.value)}
                    className="w-16 px-2 py-1 bg-white rounded-lg border border-[#CBD5E1] text-xs font-bold text-[#0E1730] text-center focus:outline-none focus:border-[#2F5CFF]"
                  />
                  <span className="text-xs text-[#69708A] pr-1">Kg</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* FINISH DAY WORKOUT BUTTON */}
        {isTodayGroup && (
          <div className="pt-4 border-t border-[#E3E8F1] flex flex-col items-center gap-3">
            <button
              onClick={handleFinishDayWorkout}
              className="w-full py-4 bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:from-[#16A34A] hover:to-[#15803D] active:scale-[0.99] text-white font-bold text-base rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer font-display"
            >
              <CheckCircle2 size={20} />
              <span>Finalizar Treino do Dia</span>
              <ArrowRight size={18} />
            </button>
            <p className="text-xs text-[#69708A] text-center">
              Ao finalizar, seu progresso será salvo e o app avançará automaticamente para o próximo treino da fila!
            </p>
          </div>
        )}
      </div>

      {/* EXTERNAL LINK TO HORUSFIT */}
      <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1E293B] text-white flex items-center justify-center shrink-0">
            <Dumbbell size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-[#0E1730]">Plataforma HorusFit</p>
            <p className="text-[11px] text-[#69708A]">Acesse sua ficha online complementar</p>
          </div>
        </div>
        <a
          href="https://horusfit.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-[#2F5CFF] hover:underline flex items-center gap-1 shrink-0"
        >
          <span>Abrir HorusFit</span>
          <ExternalLink size={12} />
        </a>
      </div>

      {/* CELEBRATION MODAL */}
      <AnimatePresence>
        {showCelebration && completedStats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCelebration(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[28px] p-6 shadow-2xl relative z-10 text-center space-y-5 border border-border-discreet overflow-hidden"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <Trophy size={32} />
              </div>

              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
                  Treino Concluído! 🔥
                </span>
                <h2 className="text-2xl font-bold text-[#0E1730] font-display mt-1">
                  Parabéns, {userName}!
                </h2>
                <p className="text-sm text-[#69708A] mt-2">
                  Você finalizou o <strong>{completedStats.title} ({completedStats.subtitle})</strong> com sucesso!
                </p>
              </div>

              <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#E2E8F0] text-left space-y-2">
                <p className="text-xs text-[#69708A] font-semibold uppercase tracking-wider">
                  Próxima Sessão de Treino:
                </p>
                <div className="flex items-center gap-2 text-sm font-bold text-[#0E1730] font-display">
                  <ArrowRight size={16} className="text-[#2F5CFF]" />
                  <span>{completedStats.nextGroup}</span>
                </div>
              </div>

              <button
                onClick={() => setShowCelebration(false)}
                className="w-full py-3.5 bg-[#1E293B] hover:bg-[#0F172A] text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer"
              >
                Continuar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
