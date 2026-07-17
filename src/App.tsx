import React, { useState, useEffect } from 'react';
import { Calendar, Dumbbell, Target, User, Settings, Camera, X, ExternalLink, Flame, Trophy, Sparkles, Bell, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AgendaTab from './components/AgendaTab';

export default function App() {
  const [activeTab, setActiveTab] = useState<'agenda' | 'academia' | 'desafio'>('agenda');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Push Notifications State
  const [pushStatus, setPushStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'denied'>('idle');
  const [pushMessage, setPushMessage] = useState<string>('');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);

  // Check initial state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!('Notification' in window)) {
        setPushStatus('denied');
        setPushMessage('Não suportado');
        return;
      }
      if (Notification.permission === 'granted') {
        setIsSubscribed(true);
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            reg.pushManager.getSubscription().then(sub => {
              if (sub) {
                setIsSubscribed(true);
              } else {
                setIsSubscribed(false);
              }
            }).catch(() => {});
          });
        }
      } else if (Notification.permission === 'denied') {
        setPushStatus('denied');
      }
    }
  }, []);

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const handleSubscribePush = async () => {
    setPushStatus('loading');
    setPushMessage('');

    try {
      if (!('Notification' in window)) {
        throw new Error('Notificações não são suportadas por este navegador.');
      }

      // 1. Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('denied');
        throw new Error('Permissão de notificação negada pelo usuário.');
      }

      // 2. Check service worker
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers não são suportados por este navegador.');
      }

      // Register or get active service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // 3. Get VAPID public key
      let vapidPublicKey = (import.meta as any).env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('A variável de ambiente VITE_VAPID_PUBLIC_KEY não está configurada no cliente.');
      }
      
      // Clean up string in case of accidental quotes or whitespace
      vapidPublicKey = vapidPublicKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      console.log('VAPID Key (length: ' + vapidPublicKey.length + '):', vapidPublicKey);

      // 4. Subscribe
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      };

      const subscription = await registration.pushManager.subscribe(subscribeOptions);
      const subscriptionJson = subscription.toJSON();

      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;

      if (!p256dh || !auth) {
        throw new Error('Não foi possível obter as chaves de criptografia da inscrição.');
      }

      // 5. Send subscription to the server
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh,
          auth
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao enviar a inscrição para o servidor.');
      }

      setPushStatus('success');
      setIsSubscribed(true);
      setPushMessage('Lembretes ativados com sucesso!');

      // Show a self test notification after subscribing
      try {
        new Notification('HAGENDA', {
          body: 'Notificações ativadas com sucesso! Você receberá seus lembretes aqui.',
          icon: '/icon-180.png'
        });
      } catch (e) {
        if (registration && registration.showNotification) {
          registration.showNotification('HAGENDA', {
            body: 'Notificações ativadas com sucesso! Você receberá seus lembretes aqui.',
            icon: '/icon-180.png'
          });
        }
      }

    } catch (err: any) {
      console.error('Erro ao registrar push notifications:', err);
      setPushStatus('error');
      setPushMessage(err.message || 'Erro ao registrar notificações.');
    }
  };

  // User Profile State
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('momentum_user_name') || 'Henrique';
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    return localStorage.getItem('momentum_avatar_url');
  });

  // Contrast Settings State
  const [isHighContrast, setIsHighContrast] = useState(() => {
    return localStorage.getItem('momentum_high_contrast') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('momentum_high_contrast', String(isHighContrast));
    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [isHighContrast]);

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
    <div className="h-[100dvh] w-screen bg-app-bg flex overflow-hidden font-sans text-text-sub relative">
      {/* DESKTOP SIDEBAR */}
      <nav className="hidden md:flex w-[260px] lg:w-[280px] bg-app-card border-r border-border-discreet flex-col p-6 z-40 shrink-0 relative">
        {/* Subtle subtle gradient accent at the top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-primary/0 via-brand-primary/40 to-brand-primary/0" />
        
        <div className="flex items-center gap-3 mb-12 mt-4 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E3FD6] to-[#0B1440] flex items-center justify-center shadow-lg shadow-brand-primary/10">
            <Calendar size={20} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-[#0E1730] font-display">Momentum</span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Agenda Tab Button */}
          <button 
            onClick={() => setActiveTab('agenda')}
            className={`relative flex items-center gap-3 px-4 py-3.5 rounded-[14px] transition-all group ${activeTab === 'agenda' ? 'text-white font-semibold' : 'text-text-sec hover:text-text-sub font-medium'}`}
          >
            {activeTab === 'agenda' && (
              <motion.div 
                layoutId="activeTabSidebar"
                className="absolute inset-0 bg-gradient-to-r from-[#1E3FD6] to-[#0B1440] rounded-[14px] shadow-md shadow-brand-primary/10 -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Calendar size={18} strokeWidth={activeTab === 'agenda' ? 2.2 : 1.8} className={activeTab === 'agenda' ? 'text-white' : 'text-text-sec group-hover:text-text-sub transition-colors'} />
            <span className="text-sm">Agenda</span>
          </button>

          {/* Academia Tab Button */}
          <button 
            onClick={() => setActiveTab('academia')}
            className={`relative flex items-center gap-3 px-4 py-3.5 rounded-[14px] transition-all group ${activeTab === 'academia' ? 'text-white font-semibold' : 'text-text-sec hover:text-text-sub font-medium'}`}
          >
            {activeTab === 'academia' && (
              <motion.div 
                layoutId="activeTabSidebar"
                className="absolute inset-0 bg-gradient-to-r from-[#1E3FD6] to-[#0B1440] rounded-[14px] shadow-md shadow-brand-primary/10 -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Dumbbell size={18} strokeWidth={activeTab === 'academia' ? 2.2 : 1.8} className={activeTab === 'academia' ? 'text-white' : 'text-text-sec group-hover:text-text-sub transition-colors'} />
            <span className="text-sm">Academia</span>
          </button>

          {/* Desafio Tab Button */}
          <button 
            onClick={() => setActiveTab('desafio')}
            className={`relative flex items-center gap-3 px-4 py-3.5 rounded-[14px] transition-all group ${activeTab === 'desafio' ? 'text-white font-semibold' : 'text-text-sec hover:text-text-sub font-medium'}`}
          >
            {activeTab === 'desafio' && (
              <motion.div 
                layoutId="activeTabSidebar"
                className="absolute inset-0 bg-gradient-to-r from-[#1E3FD6] to-[#0B1440] rounded-[14px] shadow-md shadow-brand-primary/10 -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Target size={18} strokeWidth={activeTab === 'desafio' ? 2.2 : 1.8} className={activeTab === 'desafio' ? 'text-white' : 'text-text-sec group-hover:text-text-sub transition-colors'} />
            <span className="text-sm">Desafio</span>
          </button>
        </div>

        {/* User profile section at bottom of sidebar */}
        <div className="mt-auto pt-6 border-t border-border-discreet flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-app-bg border border-border-discreet shrink-0 flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={16} className="text-text-sec" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-text-sub truncate font-display">{userName}</span>
            <span className="text-[10px] text-text-sec font-medium">Premium User</span>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="ml-auto p-1.5 rounded-lg text-text-sec hover:text-text-sub hover:bg-app-bg transition-colors"
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
                        <span className="text-xs font-semibold text-brand-primary tracking-wider uppercase font-display">Plataforma</span>
                        <h1 className="text-2xl md:text-3xl font-bold text-text-sub font-display tracking-tight mt-1">Academia</h1>
                      </div>
                      <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white border border-border-discreet flex items-center justify-center text-text-sec hover:text-text-sub transition-all shadow-xs"
                      >
                        <Settings size={18} className="md:w-5 md:h-5" />
                      </button>
                    </div>

                    {/* Main Card */}
                    <div className="bg-gradient-to-br from-[#1E3FD6] to-[#0B1440] rounded-[24px] p-6 md:p-10 flex flex-col items-center text-center relative overflow-hidden shadow-xl mt-4">
                      <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center text-[#FF8A24] shadow-md mb-6">
                        <Dumbbell size={32} strokeWidth={2.5} className="md:w-10 md:h-10" />
                      </div>

                      <h2 className="text-xl md:text-2xl font-bold text-white font-display">HorusFit Treinos</h2>
                      <p className="text-sm text-white/80 mt-3 max-w-[320px] md:max-w-md leading-relaxed">
                        Acesse sua ficha de exercícios personalizada, cronogramas de treino e acompanhamento profissional.
                      </p>

                      {/* Highlights */}
                      <div className="w-full mt-8 space-y-4 text-left max-w-[320px] md:max-w-md">
                        <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                          <Sparkles size={18} className="text-[#FF8A24] shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-white font-display">Interface Otimizada</h4>
                            <p className="text-xs text-white/70 mt-1">Sua planilha em tela cheia sem cortes laterais.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                          <Flame size={18} className="text-[#FF8A24] shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-white font-display">Consistência Diária</h4>
                            <p className="text-xs text-white/70 mt-1">Marque seus treinos e acompanhe seu rendimento.</p>
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
                      className="w-full py-4 bg-brand-primary hover:bg-brand-hover active:scale-[0.98] rounded-[16px] flex items-center justify-center gap-3 text-white font-bold text-sm transition-all shadow-md shadow-brand-primary/20 group font-display"
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
                        <span className="text-xs font-semibold text-[#FF8A24] tracking-wider uppercase font-display">Metas</span>
                        <h1 className="text-2xl md:text-3xl font-bold text-text-sub font-display tracking-tight mt-1">Desafio</h1>
                      </div>
                      <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white border border-border-discreet flex items-center justify-center text-text-sec hover:text-text-sub transition-all shadow-xs"
                      >
                        <Settings size={18} className="md:w-5 md:h-5" />
                      </button>
                    </div>

                    {/* Main Card */}
                    <div className="bg-gradient-to-br from-[#1E3FD6] to-[#0B1440] rounded-[24px] p-6 md:p-10 flex flex-col items-center text-center relative overflow-hidden shadow-xl mt-4">
                      <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center text-[#FF8A24] shadow-md mb-6">
                        <Target size={32} strokeWidth={2.5} className="md:w-10 md:h-10" />
                      </div>

                      <h2 className="text-xl md:text-2xl font-bold text-white font-display">Desafio 90 Dias</h2>
                      <p className="text-sm text-white/80 mt-3 max-w-[320px] md:max-w-md leading-relaxed">
                        Gerencie seus hábitos diários, pontuações, medalhas e veja sua posição no ranking geral do desafio.
                      </p>

                      {/* Highlights */}
                      <div className="w-full mt-8 space-y-4 text-left max-w-[320px] md:max-w-md">
                        <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                          <Trophy size={18} className="text-[#FF8A24] shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-white font-display">Ranking Geral</h4>
                            <p className="text-xs text-white/70 mt-1">Veja sua pontuação contra outros participantes.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                          <Flame size={18} className="text-[#FF8A24] shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-white font-display">Progresso 90 Dias</h4>
                            <p className="text-xs text-white/70 mt-1">Sua consistência registrada de forma clara.</p>
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
                      className="w-full py-4 bg-brand-primary hover:bg-brand-hover active:scale-[0.98] rounded-[16px] flex items-center justify-center gap-3 text-white font-bold text-sm transition-all shadow-md shadow-brand-primary/20 group font-display"
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
        <nav 
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) * 0.5 + 8px)' }}
          className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-border-discreet pt-2 px-8 flex justify-around items-center z-40 shadow-lg"
        >
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
                <div className={`transition-all duration-200 ${isActive ? 'text-brand-primary scale-110' : 'text-text-meta'}`}>
                  {icon}
                </div>
                <span className={`text-[10px] font-medium transition-all ${isActive ? 'text-[#0E1730] font-bold' : 'text-text-meta'}`}>
                  {label}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="activeTabBottomIndicator"
                    className="absolute -bottom-1 w-6 h-[3px] bg-brand-primary rounded-full"
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
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              />
              
              {/* Modal Container */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden border border-border-discreet relative z-10"
              >
                <div className="flex justify-between items-center p-6 border-b border-border-discreet bg-[#F3F5FA]">
                  <h2 className="text-lg font-bold text-[#0E1730] font-display tracking-tight">Configurações</h2>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-text-sec hover:text-text-sub transition-colors border border-border-discreet"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Profile Picture */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative group cursor-pointer">
                      <div className="w-24 h-24 rounded-[24px] overflow-hidden bg-[#F3F5FA] border-[2px] border-brand-primary flex items-center justify-center shadow-md">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-xl font-bold text-brand-primary font-display">
                            {userName.slice(0, 2).toUpperCase()}
                          </div>
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
                    <label className="text-xs text-text-sec font-semibold uppercase tracking-wider ml-1">Nome do usuário</label>
                    <input 
                      type="text" 
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full bg-[#F3F5FA] border border-border-discreet rounded-[14px] px-4 py-3.5 text-text-sub focus:outline-none focus:border-brand-primary transition-all font-semibold text-sm"
                      placeholder="Seu nome"
                    />
                  </div>

                  {/* Contrast / Theme Toggle */}
                  <div className="space-y-3 pt-2">
                    <label className="text-xs text-text-sec font-semibold uppercase tracking-wider ml-1">Estilo & Contraste</label>
                    <div className="flex items-center justify-between p-3.5 bg-[#F3F5FA] border border-border-discreet rounded-[16px] shadow-inner">
                      <div className="flex flex-col gap-0.5 pr-2">
                        <span className="text-sm font-bold text-[#0E1730]">Navy Alto Contraste</span>
                        <span className="text-[10px] text-text-sec font-medium leading-tight">Ideal para uso em ambientes externos / luz do sol</span>
                      </div>
                      <label className="relative flex items-center cursor-pointer select-none shrink-0">
                        <input 
                          type="checkbox" 
                          checked={isHighContrast}
                          onChange={() => setIsHighContrast(!isHighContrast)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-border-discreet peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary shadow-sm" />
                      </label>
                    </div>
                  </div>

                  {/* Push Notifications Block */}
                  <div className="space-y-3 pt-2">
                    <label className="text-xs text-text-sec font-semibold uppercase tracking-wider ml-1">Notificações Push</label>
                    <div className="p-4 bg-[#F3F5FA] border border-border-discreet rounded-[20px] shadow-inner space-y-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${isSubscribed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                          {isSubscribed ? <BellRing size={18} /> : <Bell size={18} />}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-[#0E1730]">Lembretes Diários</span>
                          <span className="text-[10px] text-text-sec font-medium leading-tight">
                            {isSubscribed 
                              ? 'Ativo • Você receberá notificações das suas tarefas.' 
                              : 'Receba alertas direto no seu dispositivo para não esquecer nada.'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleSubscribePush}
                        disabled={pushStatus === 'loading'}
                        className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                          isSubscribed 
                            ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border border-emerald-500/20' 
                            : 'bg-brand-primary text-white hover:bg-brand-hover shadow-md shadow-brand-primary/10 active:scale-[0.98]'
                        }`}
                      >
                        {pushStatus === 'loading' ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : isSubscribed ? (
                          'Ativo (Atualizar Cadastro)'
                        ) : (
                          'Ativar lembretes'
                        )}
                      </button>

                      {pushMessage && (
                        <p className={`text-[10px] text-center font-semibold mt-1 ${
                          pushStatus === 'success' || isSubscribed ? 'text-emerald-600' : 'text-rose-500'
                        }`}>
                          {pushMessage}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-2 pb-1 text-center">
                    <p className="text-[10px] font-bold text-text-sec/50 uppercase tracking-widest">HAGENDA v2.0.0</p>
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
