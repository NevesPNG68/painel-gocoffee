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
  const [loadingPct, setLoadingPct] = useState<number | null>(null);
  const [loadingText, setLoadingText] = useState<string>('');
  const [dashboardVisible, setDashboardVisible] = useState(false);

  useEffect(() => {
    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches || 'ontouchstart' in window;
    if (!isTouchDevice) return;

    let startX = 0;
    let startY = 0;
    let moved = false;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      moved = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
        moved = true;
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (moved) return;

      const target = event.target instanceof Element
        ? event.target.closest('button, a, [role="button"], summary') as HTMLElement | null
        : null;

      if (!target) return;
      if (target instanceof HTMLButtonElement && target.disabled) return;
      if (target.getAttribute('aria-disabled') === 'true') return;
      if (target.closest('input, select, textarea')) return;

      event.preventDefault();
      target.click();
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchAutoLoad = async () => {
      try {
        setDashboardVisible(false);
        setLoadingPct(10);
        setLoadingText('Procurando arquivo no GitHub...');
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
          if (isMounted) setLoadingPct(null);
          return;
        }
        if (!isMounted) return;
        let simPct = 20;
        setLoadingText('Processando dados...');
        const interval = setInterval(() => {
          simPct += Math.floor(Math.random() * 20) + 10;
          if (simPct >= 100) {
            clearInterval(interval);
            if (!isMounted) return;
            setLoadingPct(100);
            setLoadingText('Finalizando painel...');
            setGlobalBuffer(buf);
            setTimeout(() => {
              if (!isMounted) return;
              setDashboardVisible(true);
              setTimeout(() => {
                if (isMounted) setLoadingPct(null);
              }, 250);
            }, 900);
          } else {
            if (isMounted) {
              setLoadingPct(simPct);
              if (simPct > 60) setLoadingText('Montando dashboards...');
            }
          }
        }, 150);
      } catch (e) {
        console.log('Sem arquivo de autoload local.', e);
        if (isMounted) setLoadingPct(null);
      }
    };

    fetchAutoLoad();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen text-white pb-12 relative">
      {loadingPct !== null && (
        <div className="fixed inset-0 z-[9999] bg-[#0a0c10]/95 backdrop-blur-md flex items-center justify-center">
          <div className="w-[340px] h-[340px] flex flex-col items-center justify-center border border-neon-lime border-dashed rounded-3xl bg-black/50 shadow-[0_0_50px_rgba(163,255,18,0.15)]">
            <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
              <svg className="absolute inset-0 block w-40 h-40 transform -rotate-90" viewBox="0 0 160 160" preserveAspectRatio="xMidYMid meet">
                <circle cx="80" cy="80" r="70" fill="none" stroke="#222" strokeWidth="12" />
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
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a3ff12" />
                    <stop offset="100%" stopColor="#ff00ff" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="block w-[120px] text-center text-[40px] leading-none font-black font-mono text-neon-lime">{loadingPct}%</span>
              </div>
            </div>
            <div className="h-10 mt-8 flex items-center justify-center px-6">
              <h2 className="w-[260px] text-center text-base font-bold tracking-[0.18em] uppercase text-white/90 whitespace-nowrap overflow-hidden text-ellipsis">{loadingText}</h2>
            </div>
          </div>
        </div>
      )}

      <nav className="sticky top-0 z-[999] flex items-center bg-[#05070b]/95 backdrop-blur-xl border-b border-white/10 min-h-[76px] sm:min-h-16 px-4 py-3 sm:py-0 gap-2 sm:gap-4 shadow-2xl flex-wrap sm:flex-nowrap justify-center sm:justify-start">
        <div className="font-black text-neon-yellow tracking-[0.18em] text-base whitespace-nowrap hidden sm:block mr-4">
          GO COFFEE
        </div>
        <button
          onClick={() => setActiveTab('rec')}
          className={cn(
            'flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all border',
            activeTab === 'rec'
              ? 'bg-gradient-to-r from-neon-lime/20 to-neon-pink/10 border-neon-lime/50 text-white shadow-[0_0_15px_rgba(163,255,18,0.2)]'
              : 'bg-transparent border-white/10 text-white/60 hover:text-white hover:border-white/30'
          )}
        >
          <Coffee className="w-4 h-4" />
          <span className="truncate">Faturamento</span>
        </button>
        <button
          onClick={() => setActiveTab('desp')}
          className={cn(
            'flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all border',
            activeTab === 'desp'
              ? 'bg-gradient-to-r from-neon-yellow/20 to-orange-500/10 border-neon-yellow/50 text-white shadow-[0_0_15px_rgba(255,214,10,0.2)]'
              : 'bg-transparent border-white/10 text-white/60 hover:text-white hover:border-white/30'
          )}
        >
          <Receipt className="w-4 h-4" />
          <span className="truncate">Despesas</span>
        </button>
        <button
          onClick={() => setActiveTab('pag')}
          className={cn(
            'flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all border',
            activeTab === 'pag'
              ? 'bg-gradient-to-r from-neon-cyan/20 to-purple-500/10 border-neon-cyan/50 text-white shadow-[0_0_15px_rgba(77,215,255,0.2)]'
              : 'bg-transparent border-white/10 text-white/60 hover:text-white hover:border-white/30'
          )}
        >
          <CreditCard className="w-4 h-4" />
          <span className="truncate">Pagamentos</span>
        </button>
        <div className="flex-1 hidden sm:block"></div>
      </nav>

      <main className="pt-4 sm:pt-6 px-3 sm:px-6 pb-12 max-w-[1500px] mx-auto overflow-x-hidden">
        {dashboardVisible && (
          <>
            <section className={activeTab === 'rec' ? 'block' : 'hidden'}>
              <FaturamentoDashboard globalBuffer={globalBuffer} setGlobalBuffer={setGlobalBuffer} />
            </section>
            <section className={activeTab === 'desp' ? 'block' : 'hidden'}>
              <DespesasDashboard globalBuffer={globalBuffer} setGlobalBuffer={setGlobalBuffer} />
            </section>
            <section className={activeTab === 'pag' ? 'block' : 'hidden'}>
              <PagamentosDashboard globalBuffer={globalBuffer} setGlobalBuffer={setGlobalBuffer} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
