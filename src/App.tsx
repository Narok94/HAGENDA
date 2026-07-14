import React, { useState, useEffect } from 'react';
import { Calendar, Dumbbell, Target, User, Settings, Camera, X, ExternalLink, Flame, Trophy, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AgendaTab from './components/AgendaTab';

export default function App() {
  const [activeTab, setActiveTab] = useState<'agenda' | 'academia' | 'desafio'>('agenda');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // User Profile State
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('momentum_user_name') || 'Henrique';
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    return localStorage.getItem('momentum_avatar_url');
  });

  useEffect(() => {
    localStorage.setItem('momentum_user_name', userName);
  }, [userName]);

  useEffect(() => {
    if (avatarUrl) {
      localStorage.setItem('momentum_avatar_url', avatarUrl);
    } else {
      localStorage.removeItem('momentum_avatar_url');
    }
  }, [avatarUrl]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-[100dvh] w-screen bg-app-bg flex overflow-hidden font-sans text-white relative">
      {/* DESKTOP SIDEBAR */}
      <nav className="hidden md:flex w-[260px] lg:w-[280px] bg-app-card border-r border-white/5 flex-col p-6 z-40 shrink-0 relative">
        {/* Subtle subtle gradient accent at the top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-primary/0 via-brand-primary/40 to-brand-primary/0" />
        
        <div className="flex items-center gap-3 mb-12 mt-4 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-[#7B6EFF] flex items-center justify-center shadow-lg shadow-brand-primary/20">
            <Calendar size={20} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">Momentum</span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Agenda Tab Button */}
          <button 
            onClick={() => setActiveTab('agenda')}
            className={`relative flex items-center gap-3 px-4 py-3.5 rounded-[14px] transition-all group ${activeTab === 'agenda' ? 'text-white font-semibold' : 'text-text-sec hover:text-white font-medium'}`}
          >
            {activeTab === 'agenda' && (
              <motion.div 
                layoutId="activeTabSidebar"
                className="absolute inset-0 bg-brand-primary rounded-[14px] shadow-md shadow-brand-primary/10 -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Calendar size={18} strokeWidth={activeTab === 'agenda' ? 2.2 : 1.8} className={activeTab === 'agenda' ? 'text-white' : 'text-text-sec group-hover:text-white transition-colors'} />
            <span className="text-sm">Agenda</span>
          </button>

          {/* Academia Tab Button */}
          <button 
            onClick={() => setActiveTab('academia')}
            className={`relative flex items-center gap-3 px-4 py-3.5 rounded-[14px] transition-all group ${activeTab === 'academia' ? 'text-white font-semibold' : 'text-text-sec hover:text-white font-medium'}`}
          >
            {activeTab === 'academia' && (
              <motion.div 
                layoutId="activeTabSidebar"
                className="absolute inset-0 bg-brand-primary rounded-[14px] shadow-md shadow-brand-primary/10 -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Dumbbell size={18} strokeWidth={activeTab === 'academia' ? 2.2 : 1.8} className={activeTab === 'academia' ? 'text-white' : 'text-text-sec group-hover:text-white transition-colors'} />
            <span className="text-sm">Academia</span>
          </button>

          {/* Desafio Tab Button */}
          <button 
            onClick={() => setActiveTab('desafio')}
            className={`relative flex items-center gap-3 px-4 py-3.5 rounded-[14px] transition-all group ${activeTab === 'desafio' ? 'text-white font-semibold' : 'text-text-sec hover:text-white font-medium'}`}
          >
            {activeTab === 'desafio' && (
              <motion.div 
                layoutId="activeTabSidebar"
                className="absolute inset-0 bg-brand-primary rounded-[14px] shadow-md shadow-brand-primary/10 -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Target size={18} strokeWidth={activeTab === 'desafio' ? 2.2 : 1.8} className={activeTab === 'desafio' ? 'text-white' : 'text-text-sec group-hover:text-white transition-colors'} />
            <span className="text-sm">Desafio</span>
          </button>
        </div>

        {/* User profile section at bottom of sidebar */}
        <div className="mt-auto pt-6 border-t border-white/5 flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-app-bg border border-white/10 shrink-0 flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={16} className="text-text-sec" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-white truncate">{userName}</span>
            <span className="text-[10px] text-text-sec font-medium">Premium User</span>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="ml-auto p-1.5 rounded-lg text-text-sec hover:text-white hover:bg-white/5 transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-[100dvh] bg-app-bg relative overflow-hidden">
        <main className="flex-1 overflow-y-auto w-full md:max-w-4xl md:mx-auto pb-24 md:pb-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="h-full w-full"
            >
              {activeTab === 'agenda' && (
                <AgendaTab 
                  userName={userName} 
                  avatarUrl={avatarUrl} 
                  onOpenSettings={() => setIsSettingsOpen(true)} 
                />
              )}
              
              {activeTab === 'academia' && (
                <div className="p-6 pt-10 md:p-12 md:pt-16 flex flex-col min-h-full justify-between max-w-4xl mx-auto">
                  <div className="space-y-8 md:space-y-10">
                    {/* Header */}
                    <div className="flex items-center justify-between pt-4">
                      <div>
                        <span className="text-xs font-semibold text-brand-primary tracking-wider uppercase">Plataforma</span>
                        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">Academia</h1>
                      </div>
                      <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-app-card border border-white/5 flex items-center justify-center text-text-sec hover:text-white transition-colors hover:border-white/10 shadow-md"
                      >
                        <Settings size={18} className="md:w-5 md:h-5" />
                      </button>
                    </div>

                    {/* Main Card */}
                    <div className="bg-app-card border border-white/5 rounded-[24px] p-6 md:p-10 flex flex-col items-center text-center relative overflow-hidden shadow-xl mt-4">
                      {/* Glowing background decor */}
                      <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-brand-primary/10 blur-3xl pointer-events-none"></div>
                      <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-violet-500/5 blur-3xl pointer-events-none"></div>

                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shadow-lg shadow-brand-primary/10 mb-6">
                        <Dumbbell size={32} strokeWidth={2.5} className="md:w-10 md:h-10" />
                      </div>

                      <h2 className="text-xl md:text-2xl font-bold text-white">HorusFit Treinos</h2>
                      <p className="text-sm text-text-sec mt-3 max-w-[320px] md:max-w-md leading-relaxed">
                        Acesse sua ficha de exercícios personalizada, cronogramas de treino e acompanhamento profissional.
                      </p>

                      {/* Highlights */}
                      <div className="w-full mt-8 space-y-4 text-left max-w-[320px] md:max-w-md">
                        <div className="flex items-start gap-4 p-4 bg-app-bg/50 rounded-2xl border border-white/5">
                          <Sparkles size={18} className="text-brand-primary shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-white">Interface Otimizada</h4>
                            <p className="text-xs text-text-sec mt-1">Sua planilha em tela cheia sem cortes laterais.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 bg-app-bg/50 rounded-2xl border border-white/5">
                          <Flame size={18} className="text-brand-primary shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-white">Consistência Diária</h4>
                            <p className="text-xs text-text-sec mt-1">Marque seus treinos e acompanhe seu rendimento.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="space-y-4 mt-8 max-w-[320px] md:max-w-md mx-auto w-full pb-8 md:pb-0">
                    <a 
                      href="https://horusfit.vercel.app/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full py-4 bg-brand-primary hover:bg-brand-hover active:scale-[0.98] rounded-[16px] flex items-center justify-center gap-3 text-white font-bold text-sm transition-all shadow-lg shadow-brand-primary/25 group"
                    >
                      <span>Abrir Academia HorusFit</span>
                      <ExternalLink size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                    <p className="text-[11px] text-text-sec text-center leading-normal">
                      O aplicativo será aberto em uma nova aba para melhor usabilidade.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'desafio' && (
                <div className="p-6 pt-10 md:p-12 md:pt-16 flex flex-col min-h-full justify-between max-w-4xl mx-auto">
                  <div className="space-y-8 md:space-y-10">
                    {/* Header */}
                    <div className="flex items-center justify-between pt-4">
                      <div>
                        <span className="text-xs font-semibold text-[#FF5252] tracking-wider uppercase">Metas</span>
                        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">Desafio</h1>
                      </div>
                      <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-app-card border border-white/5 flex items-center justify-center text-text-sec hover:text-white transition-colors hover:border-white/10 shadow-md"
                      >
                        <Settings size={18} className="md:w-5 md:h-5" />
                      </button>
                    </div>

                    {/* Main Card */}
                    <div className="bg-app-card border border-white/5 rounded-[24px] p-6 md:p-10 flex flex-col items-center text-center relative overflow-hidden shadow-xl mt-4">
                      {/* Glowing background decor */}
                      <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-[#FF5252]/10 blur-3xl pointer-events-none"></div>
                      <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-[#FF7A00]/5 blur-3xl pointer-events-none"></div>

                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-[#FF5252]/10 border border-[#FF5252]/20 flex items-center justify-center text-[#FF5252] shadow-lg shadow-[#FF5252]/10 mb-6">
                        <Target size={32} strokeWidth={2.5} className="md:w-10 md:h-10" />
                      </div>

                      <h2 className="text-xl md:text-2xl font-bold text-white">Desafio 90 Dias</h2>
                      <p className="text-sm text-text-sec mt-3 max-w-[320px] md:max-w-md leading-relaxed">
                        Gerencie seus hábitos diários, pontuações, medalhas e veja sua posição no ranking geral do desafio.
                      </p>

                      {/* Highlights */}
                      <div className="w-full mt-8 space-y-4 text-left max-w-[320px] md:max-w-md">
                        <div className="flex items-start gap-4 p-4 bg-app-bg/50 rounded-2xl border border-white/5">
                          <Trophy size={18} className="text-[#FF7A00] shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-white">Ranking Geral</h4>
                            <p className="text-xs text-text-sec mt-1">Veja sua pontuação contra outros participantes.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 bg-app-bg/50 rounded-2xl border border-white/5">
                          <Flame size={18} className="text-[#FF5252] shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-white">Progresso 90 Dias</h4>
                            <p className="text-xs text-text-sec mt-1">Sua consistência registrada de forma clara.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="space-y-4 mt-8 max-w-[320px] md:max-w-md mx-auto w-full pb-8 md:pb-0">
                    <a 
                      href="https://desafio90d.vercel.app/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full py-4 bg-gradient-to-r from-[#FF5252] to-[#FF7A00] hover:opacity-90 active:scale-[0.98] rounded-[16px] flex items-center justify-center gap-3 text-white font-bold text-sm transition-all shadow-lg shadow-[#FF5252]/20 group"
                    >
                      <span>Abrir Desafio 90 Dias</span>
                      <ExternalLink size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                    <p className="text-[11px] text-text-sec text-center leading-normal">
                      O desafio será aberto em uma nova aba para melhor visualização.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* BOTTOM NAVIGATION (Mobile Only) */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-app-bg/85 backdrop-blur-md border-t border-white/5 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-3 px-8 flex justify-around items-center z-40 shadow-lg">
          {['agenda', 'academia', 'desafio'].map((tab) => {
            const isActive = activeTab === tab;
            let icon = <Calendar size={isActive ? 22 : 20} strokeWidth={isActive ? 2.2 : 1.8} />;
            let label = "Agenda";
            if (tab === 'academia') {
              icon = <Dumbbell size={isActive ? 22 : 20} strokeWidth={isActive ? 2.2 : 1.8} />;
              label = "Academia";
            } else if (tab === 'desafio') {
              icon = <Target size={isActive ? 22 : 20} strokeWidth={isActive ? 2.2 : 1.8} />;
              label = "Desafio";
            }

            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className="relative flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all active:scale-95 shrink-0"
              >
                <div className={`transition-all duration-200 ${isActive ? 'text-brand-primary scale-110' : 'text-text-sec'}`}>
                  {icon}
                </div>
                <span className={`text-[10px] font-medium transition-all ${isActive ? 'text-white' : 'text-text-sec'}`}>
                  {label}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="activeTabBottomIndicator"
                    className="absolute -bottom-1 w-6 h-1 bg-brand-primary rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* SETTINGS MODAL */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSettingsOpen(false)}
                className="absolute inset-0 bg-black/70 backdrop-blur-md"
              />
              
              {/* Modal Container */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                className="bg-app-card w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden border border-white/5 relative z-10"
              >
                <div className="flex justify-between items-center p-6 border-b border-white/5 bg-app-card/50 backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-white tracking-tight">Configurações</h2>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-8 h-8 rounded-full bg-app-bg flex items-center justify-center text-text-sec hover:text-white transition-colors border border-white/5 hover:border-white/10"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Profile Picture */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative group cursor-pointer">
                      <div className="w-24 h-24 rounded-[24px] overflow-hidden bg-app-bg border-[2px] border-brand-primary flex items-center justify-center shadow-lg shadow-brand-primary/10">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <User size={32} className="text-text-sec" />
                        )}
                      </div>
                      <label className="absolute inset-0 bg-black/60 rounded-[22px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-xs">
                        <Camera size={24} className="text-white animate-pulse" />
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleAvatarUpload} 
                          className="hidden" 
                          id="settings-avatar-input"
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-text-sec font-medium">Toque para alterar a foto</p>
                  </div>

                  {/* Name Input */}
                  <div className="space-y-2">
                    <label className="text-xs text-text-sec font-medium uppercase tracking-wider ml-1">Nome do usuário</label>
                    <input 
                      type="text" 
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full bg-app-bg border border-white/10 rounded-[14px] px-4 py-3.5 text-white focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_2px_rgba(108,92,231,0.2)] transition-all font-medium text-sm"
                      placeholder="Seu nome"
                    />
                  </div>
                  
                  <div className="pt-4 pb-1 text-center">
                    <p className="text-[10px] font-medium text-text-sec/40 uppercase tracking-widest">Momentum v1.1.0</p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
