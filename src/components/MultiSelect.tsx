import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ label, options, selected, onChange, placeholder = 'Todos' }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      if (window.innerWidth <= 760) document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  const handleSelectAll = () => onChange(options);
  const handleClear = () => onChange([]);
  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter(item => item !== opt));
    else onChange([...selected, opt]);
  };

  const displayText = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selecionados`;

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button type="button" className={cn("w-full flex items-center justify-between text-white p-3 rounded-xl cursor-pointer font-bold","border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)]","hover:border-neon-lime/40 transition-colors")} onClick={() => setIsOpen(!isOpen)}>
        <span className="text-muted text-xs uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm">{displayText}</span>
          <ChevronDown className="w-4 h-4 opacity-70" />
        </div>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[99] sm:hidden" onClick={() => setIsOpen(false)} />
          <div className={cn("fixed sm:absolute z-[100] sm:z-50","bottom-0 sm:bottom-auto left-0 sm:left-auto right-0 sm:right-auto sm:top-[calc(100%+8px)]","sm:w-[280px]","bg-[#0a0c10] sm:bg-[#0a0c10]/95 backdrop-blur-xl sm:border border-[rgba(255,255,255,0.12)]","rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden","flex flex-col max-h-[80vh] sm:max-h-[400px]")}>
            <div className="p-4 border-b border-white/10 flex flex-col gap-3">
              <div className="flex sm:hidden justify-between items-center mb-2">
                <span className="font-bold text-white">{label}</span>
                <button onClick={() => setIsOpen(false)} className="p-1 text-white/70"><X className="w-5 h-5" /></button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                <input type="text" placeholder="Filtrar..." className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-neon-lime/40" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 shrink-0">
                <button onClick={handleSelectAll} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white transition-colors">Todos</button>
                <button onClick={handleClear} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white transition-colors">Nenhum</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 overscroll-contain p-2">
              {filteredOptions.length === 0 ? <div className="p-4 text-center text-sm text-white/50">Sem opções</div> : filteredOptions.map((opt) => (
                <label key={opt} onClick={(e) => { e.preventDefault(); toggleOption(opt); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
                  <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0", selected.includes(opt) ? "bg-neon-lime border-neon-lime text-black" : "border-white/20 bg-black/20")}>
                    {selected.includes(opt) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className="text-sm text-white line-clamp-1">{opt}</span>
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-white/10 sm:hidden">
               <button onClick={() => setIsOpen(false)} className="w-full py-3 bg-neon-lime text-black rounded-xl font-bold">Aplicar Filtros</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
