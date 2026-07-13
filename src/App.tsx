import React, { useState, useEffect } from 'react';
import { Calendar, Dumbbell, Target, User, Settings, Camera, X } from 'lucide-react';
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
    <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center sm:p-4 md:p-8">
      {/* Mobile container simulating iPhone 11 */}
      <div className="w-full h-full sm:w-[414px] sm:h-[896px] sm:max-h-full sm:rounded-[40px] bg-[#0F1115] text-white flex flex-col font-sans overflow-hidden sm:border-[6px] border-[#171A21] relative shadow-[0_0_50px_rgba(0,0,0,0.5)] transform-gpu">
        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto pb-24 relative">
          {activeTab === 'agenda' && (
            <AgendaTab 
              userName={userName} 
              avatarUrl={avatarUrl} 
              onOpenSettings={() => setIsSettingsOpen(true)} 
            />
          )}
          {activeTab === 'academia' && (
            <iframe 
              src="https://horusfit.vercel.app/" 
              className="w-full h-full border-none"
              title="Academia HorusFit"
            />
          )}
          {activeTab === 'desafio' && (
            <iframe 
              src="https://desafio90d.vercel.app/" 
              className="w-full h-full border-none"
              title="Desafio 90 Dias"
            />
          )}
        </main>

        {/* BOTTOM NAVIGATION */}
        <nav className="absolute bottom-0 left-0 w-full bg-[#0F1115]/80 backdrop-blur-xl border-t border-[#171A21] pb-safe sm:pb-6 pt-3 px-6 flex justify-around items-center z-40">
          <button 
            onClick={() => setActiveTab('agenda')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${activeTab === 'agenda' ? 'text-[#7C5CFF]' : 'text-[#A1A1AA] hover:text-white'}`}
          >
            <Calendar size={24} strokeWidth={activeTab === 'agenda' ? 2.5 : 2} />
            <span className="text-[10px] font-medium tracking-wide">Agenda</span>
          </button>
          <button 
            onClick={() => setActiveTab('academia')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${activeTab === 'academia' ? 'text-[#7C5CFF]' : 'text-[#A1A1AA] hover:text-white'}`}
          >
            <Dumbbell size={24} strokeWidth={activeTab === 'academia' ? 2.5 : 2} />
            <span className="text-[10px] font-medium tracking-wide">Academia</span>
          </button>
          <button 
            onClick={() => setActiveTab('desafio')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${activeTab === 'desafio' ? 'text-[#7C5CFF]' : 'text-[#A1A1AA] hover:text-white'}`}
          >
            <Target size={24} strokeWidth={activeTab === 'desafio' ? 2.5 : 2} />
            <span className="text-[10px] font-medium tracking-wide">Desafio</span>
          </button>
        </nav>

        {/* SETTINGS MODAL */}
        {isSettingsOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#171A21] w-full max-w-sm rounded-[20px] shadow-2xl overflow-hidden border border-white/5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center p-5 border-b border-white/5">
                <h2 className="text-lg font-semibold text-white">Configurações</h2>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-[#A1A1AA] hover:text-white transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Profile Picture */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative group cursor-pointer">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-[#0F1115] border-2 border-[#7C5CFF] flex items-center justify-center">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User size={32} className="text-[#A1A1AA]" />
                      )}
                    </div>
                    <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera size={24} className="text-white" />
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleAvatarUpload} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                  <p className="text-xs text-[#A1A1AA]">Toque para alterar a foto</p>
                </div>

                {/* Name Input */}
                <div className="space-y-2">
                  <label className="text-sm text-[#A1A1AA] font-medium ml-1">Nome do usuário</label>
                  <input 
                    type="text" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-[#0F1115] border border-white/10 rounded-[16px] px-4 py-3 text-white focus:outline-none focus:border-[#7C5CFF] transition-colors"
                    placeholder="Seu nome"
                  />
                </div>

                {/* Theme (Optional display as requested) */}
                <div className="flex items-center justify-between p-4 bg-[#0F1115] rounded-[16px] border border-white/5">
                  <span className="text-sm font-medium">Tema Escuro</span>
                  <div className="w-10 h-6 bg-[#7C5CFF] rounded-full flex items-center p-1 justify-end">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                  </div>
                </div>
                
                <div className="pt-2 text-center">
                  <p className="text-[10px] text-[#A1A1AA]">Momentum v1.0.0</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
