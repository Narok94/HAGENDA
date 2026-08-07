import React, { useState, useEffect } from 'react';
import { Calendar, Dumbbell, Target, User, Settings, Camera, X, ExternalLink, Flame, Trophy, Sparkles, Bell, BellRing, Apple } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AgendaTab from './components/AgendaTab';
import AcademiaTab from './components/AcademiaTab';
import DietaTab from './components/DietaTab';

export default function App() {
  const [activeTab, setActiveTab] = useState<'agenda' | 'academia' | 'dieta' | 'desafio'>('agenda');
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
    const cleanStr = base64String.trim().replace(/^["']|["']$/g, '');
    const padding = '='.repeat((4 - (cleanStr.length % 4)) % 4);
    const base64 = (cleanStr + padding)
      .replace(/-/g, '+')
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
      if (!vapidPublicKey || vapidPublicKey === 'undefined' || vapidPublicKey.trim() === '') {
        throw new Error('A variável VITE_VAPID_PUBLIC_KEY não está definida ou está vazia nas variáveis de ambiente na Vercel.');
      }
      
      vapidPublicKey = vapidPublicKey.trim().replace(/^["']|["']$/g, '');

      let appServerKey: Uint8Array;
      try {
        appServerKey = urlBase64ToUint8Array(vapidPublicKey);
      } catch (err) {
        throw new Error('Formato da chave VITE_VAPID_PUBLIC_KEY inválido. Certifique-se de que é uma chave Base64URL válida.');
      }

      if (appServerKey.length !== 65) {
        throw new Error(`A chave VITE_VAPID_PUBLIC_KEY é inválida (tamanho decodificado: ${appServerKey.length} bytes; esperado: 65 bytes). Gere um novo par VAPID com npx web-push generate-vapid-keys.`);
      }

      // 4. Subscribe
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: appServerKey
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
  const [userName, setUserName] = useState<string>('Henrique');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    return localStorage.getItem('momentum_avatar_url');
  });

  // Contrast & Reminder Settings State
  const [isHighContrast, setIsHighContrast] = useState<boolean>(false);
  const [reminderMinutes, setReminderMinutes] = useState<number>(15);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true);
  const isSettingsInitialized = React.useRef(false);

  // Initial fetch settings from API/Database
  useEffect(() => {
    let isMounted = true;
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.userName) {
          setUserName(data.userName);
        }
        if (data.reminderMinutes !== undefined) {
          setReminderMinutes(Number(data.reminderMinutes) || 15);
        }
        if (data.highContrast !== undefined) {
          setIsHighContrast(data.highContrast);
          if (data.highContrast) {
            document.documentElement.classList.add('high-contrast');
          } else {
            document.documentElement.classList.remove('high-contrast');
          }
        }
        setIsLoadingSettings(false);
        isSettingsInitialized.current = true;
      })
      .catch(err => {
        console.error('Erro ao carregar configurações do servidor:', err);
        if (isMounted) {
          setIsLoadingSettings(false);
          isSettingsInitialized.current = true;
        }
      });

    return () => { isMounted = false; };
  }, []);

  // Save settings when userName, isHighContrast or reminderMinutes changes after initial load
  useEffect(() => {
    if (!isSettingsInitialized.current) return;

    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, highContrast: isHighContrast, reminderMinutes })
    }).catch(err => {
      console.error('Erro ao salvar configurações no servidor:', err);
    });
  }, [userName, isHighContrast, reminderMinutes]);

  // Avatar stays in localStorage
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
    <div className="h-[100dvh] w-full bg-app-bg flex flex-col font-sans text-text-sub relative overflow-hidden">
      {/* MAIN CONTENT AREA */}
      <main 
        style={{ paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))' }}
        className="flex-1 overflow-y-auto w-full md:max-w-4xl md:mx-auto pb-24 relative"
      >
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
              <AcademiaTab 
                userName={userName} 
                onOpenSettings={() => setIsSettingsOpen(true)} 
              />
            )}

            {activeTab === 'dieta' && (
              <DietaTab 
                userName={userName} 
                onOpenSettings={() => setIsSettingsOpen(true)} 
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* BOTTOM NAVIGATION (All devices) */}
      <nav 
        style={{ paddingBottom: 'max(10px, calc(4px + env(safe-area-inset-bottom, 0px)))' }}
        className="tabbar fixed bottom-0 left-0 right-0 w-full bg-white border-t border-[#E3E8F1] pt-2 px-6 flex justify-center gap-14 md:gap-32 items-center z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]"
      >
          {['agenda', 'academia', 'dieta'].map((tab) => {
            const isActive = activeTab === tab;
            let icon = <Calendar size={isActive ? 20 : 18} strokeWidth={isActive ? 2.2 : 1.8} />;
            let label = "Agenda";
            if (tab === 'academia') {
              icon = <Dumbbell size={isActive ? 20 : 18} strokeWidth={isActive ? 2.2 : 1.8} />;
              label = "Academia";
            } else if (tab === 'dieta') {
              icon = <Apple size={isActive ? 20 : 18} strokeWidth={isActive ? 2.2 : 1.8} />;
              label = "Dieta";
            }

            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className="relative flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all active:scale-95 shrink-0"
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

                      {/* Reminder Advance Time Selector */}
                      <div className="pt-3 border-t border-border-discreet/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#0E1730]">Antecedência do lembrete</span>
                          <span className="text-[11px] font-semibold text-brand-primary">{reminderMinutes} min antes</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[5, 10, 15, 30, 60].map((mins) => {
                            const isSelected = reminderMinutes === mins;
                            return (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => setReminderMinutes(mins)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-brand-primary text-white shadow-xs'
                                    : 'bg-white border border-border-discreet text-text-sec hover:text-text-sub hover:bg-gray-50'
                                }`}
                              >
                                {mins} min
                              </button>
                            );
                          })}
                        </div>
                      </div>
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
  );
}
