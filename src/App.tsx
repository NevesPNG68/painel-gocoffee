import React, { useState, useEffect } from 'react';
import { Coffee, Receipt, CreditCard } from 'lucide-react';
import FaturamentoDashboard from './features/faturamento/FaturamentoDashboard';
import DespesasDashboard from './features/despesas/DespesasDashboard';
import PagamentosDashboard from './features/pagamentos/PagamentosDashboard';
import { cn } from './lib/utils';

type Tab = 'rec' | 'desp' | 'pag';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('rec');
  const [globalBuffer, setGlobalBuffer] = useState<ArrayBuffer | null>(null);
  
  // Loader states
  const [loadingPct, setLoadingPct] = useState<number | null>(null);
  const [loadingText, setLoadingText] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const fetchAutoLoad = async () => {
      try {
        setLoadingPct(10);
        setLoadingText('Procurando arquivo no GitHub...');
        
        // Caminhos dentro do próprio GitHub Pages.
        // Mantenha a planilha no repositório com o nome planilha.xlsx para atualização automática.
        const base = import.meta.env.BASE_URL || '/';
        const candidates = [
          `${base}planilha.xlsx`,
          `${base}PLANILHA.xlsx`,
          `${base}DRE%20GO%20COFFEE_COMPETENCIA.xlsx`,
          `${base}DRE%20GO%20COFFEE_COMPETENCIA.XLSX`,
          `${base}data/planilha.xlsx`
        ];
        
        let buf: ArrayBuffer | null = null;
        
        for (const url of candidates) {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            buf = await res.arrayBuffer();
            break;
          }
        }

        if (!buf) {
          // Arquivo não encontrado, fecha o loader silenciosamente
          if (isMounted) setLoadingPct(null);
          return;
        }

        if (!isMounted) return;

        // Simula o carregamento visual
        let simPct = 20;
        setLoadingText('Processando dados...');
        
        const interval = setInterval(() => {
          simPct += Math.floor(Math.random() * 20) + 10;
          if (simPct >= 100) {
            clearInterval(interval);
            if (!isMounted) return;
            setLoadingPct(100);
            setLoadingText('Concluído!');
            setTimeout(() => {
              if (isMounted) {
                setLoadingPct(null);
                setGlobalBuffer(buf);
              }
            }, 400);
          } else {
            if (isMounted) {
              setLoadingPct(simPct);
              if (simPct > 60) setLoadingText('Montando Dashboards...');
            }
          }
        }, 150);

      } catch(e) {
        console.log('Sem arquivo de autoload local.', e);
        if (isMounted) setLoadingPct(null);
      }
    };

    fetchAutoLoad();
    
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="min-h-screen text-white pb-12 relative">
      {/* Loading Overlay */}
      {loadingPct !== null && (
        <div className="fixed inset-0 z-[9999] bg-[#0a0c10]/95 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="relative flex flex-col items-center p-12 border border-neon-lime border-dashed rounded-3xl bg-black/50 shadow-[0_0_50px_rgba(163,255,18,0.15)]">
            
            <div className="relative w-40 h-40 flex items-center justify-center mb-8">
              {/* SVG Ring Background */}
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="70" fill="none" stroke="#222" strokeWidth="12" />
                {/* SVG Ring Progress */}
                <circle 
                  cx="80" 
                  cy="80" 
                  r="70" 
                  fill="none" 
                  stroke="url(#gradient)" 
                  strokeWidth="12"
                  strokeDasharray="439.8"
                  strokeDashoffset={439.8 - (loadingPct / 100) * 439.8}
                  strokeLinecap="round"
                  className="transition-all duration-200 ease-out"
                />
                <defs>
                   <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                     <stop offset="0%" stopColor="#a3ff12" />
                     <stop offset="100%" stopColor="#ff00ff" />
                   </linearGradient>
                </defs>
              </svg>
              <span className="text-4xl font-black text-neon-lime">{loadingPct}%</span>
            </div>

            <h2 className="text-xl font-bold tracking-widest uppercase text-white/90">
              {loadingText}
            </h2>
          </div>
        </div>
      )}

      <nav className="fixed top-0 left-0 right-0 z-[999] flex items-center bg-[#05070b]/95 backdrop-blur-xl border-b border-white/10 h-auto sm:h-16 px-4 py-3 sm:py-0 gap-2 sm:gap-4 shadow-2xl flex-wrap sm:flex-nowrap justify-center sm:justify-start">
        <div className="font-black text-neon-yellow tracking-[0.18em] text-base whitespace-nowrap hidden sm:block mr-4">
          GO COFFEE
        </div>
        
        <button
          onClick={() => setActiveTab('rec')}
          className={cn(
            "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all border",
            activeTab === 'rec' 
              ? "bg-gradient-to-r from-neon-lime/20 to-neon-pink/10 border-neon-lime/50 text-white shadow-[0_0_15px_rgba(163,255,18,0.2)]" 
              : "bg-transparent border-white/10 text-white/60 hover:text-white hover:border-white/30"
          )}
        >
          <Coffee className="w-4 h-4" /> 
          <span className="truncate">Faturamento</span>
        </button>

        <button
          onClick={() => setActiveTab('desp')}
          className={cn(
            "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all border",
            activeTab === 'desp' 
              ? "bg-gradient-to-r from-neon-yellow/20 to-orange-500/10 border-neon-yellow/50 text-white shadow-[0_0_15px_rgba(255,214,10,0.2)]" 
              : "bg-transparent border-white/10 text-white/60 hover:text-white hover:border-white/30"
          )}
        >
          <Receipt className="w-4 h-4" /> 
          <span className="truncate">Despesas</span>
        </button>

        <button
          onClick={() => setActiveTab('pag')}
          className={cn(
            "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all border",
            activeTab === 'pag' 
              ? "bg-gradient-to-r from-neon-cyan/20 to-purple-500/10 border-neon-cyan/50 text-white shadow-[0_0_15px_rgba(77,215,255,0.2)]" 
              : "bg-transparent border-white/10 text-white/60 hover:text-white hover:border-white/30"
          )}
        >
          <CreditCard className="w-4 h-4" /> 
          <span className="truncate">Pagamentos</span>
        </button>

        <div className="flex-1 hidden sm:block"></div>
      </nav>

      <main className="pt-32 sm:pt-24 px-3 sm:px-6 pb-12 max-w-[1500px] mx-auto">
        {activeTab === 'rec' && <FaturamentoDashboard globalBuffer={globalBuffer} setGlobalBuffer={setGlobalBuffer} />}
        {activeTab === 'desp' && <DespesasDashboard globalBuffer={globalBuffer} setGlobalBuffer={setGlobalBuffer} />}
        {activeTab === 'pag' && <PagamentosDashboard globalBuffer={globalBuffer} setGlobalBuffer={setGlobalBuffer} />}
      </main>
    </div>
  );
}
