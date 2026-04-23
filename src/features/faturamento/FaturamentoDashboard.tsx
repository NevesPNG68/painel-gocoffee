import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { MultiSelect } from '../../components/MultiSelect';
import { cn, moneyBR, intBR, brDate, weekdayPt, weekOfMonth, parseFaixaStart, monthLabelPt } from '../../lib/utils';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';

type Props = {
  globalBuffer: ArrayBuffer | null;
  setGlobalBuffer: (buffer: ArrayBuffer | null) => void;
};

type FatRow = { date: string; faixa: string; total: number };

function parseExcelDate(value: any): string {
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(value || '').trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? s : '';
}

function parseMoney(value: any): number {
  if (typeof value === 'number') return value;
  const s = String(value || '').replace(/R\$/gi, '').replace(/\s/g, '');
  return Number(s.replace(/\./g, '').replace(/,/g, '.')) || 0;
}

export default function FaturamentoDashboard({ globalBuffer }: Props) {
  const [rows, setRows] = useState<FatRow[]>([]);
  const [fAno, setFAno] = useState<string[]>([]);
  const [fMes, setFMes] = useState<string[]>([]);
  const [fDiaSemana, setFDiaSemana] = useState<string[]>([]);
  const [fSemana, setFSemana] = useState<string[]>([]);
  const [fFaixa, setFFaixa] = useState<string[]>([]);

  useEffect(() => {
    if (!globalBuffer) return;
    try {
      const wb = XLSX.read(globalBuffer, { type: 'array' });
      const normalize = (s: string) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const sheetName = wb.SheetNames.find((n) => normalize(n) === 'dados') || wb.SheetNames[0];
      if (!sheetName) return;
      const ws = wb.Sheets[sheetName];
      const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const pick = (obj: any, keys: string[]) => {
        for (const key of keys) if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') return obj[key];
        return '';
      };
      const parsed: FatRow[] = [];
      for (const r of data) {
        const date = parseExcelDate(pick(r, ['date','DATA','Data','DATA ','DATA DA ORDEM','Data da Ordem','C']));
        const faixa = String(pick(r, ['faixa','FAIXA','Faixa','FAIXA DE HORA','FAIXA HORA','T']) || '').trim();
        const total = parseMoney(pick(r, ['total','Total','TOTAL','Valor','V','LIQUIDO','Líquido','VLR LIQ','B']));
        if (!date || !faixa) continue;
        parsed.push({ date, faixa, total });
      }
      setRows(parsed);
    } catch (error) {
      console.error('Erro ao ler faturamento:', error);
    }
  }, [globalBuffer]);

  const enriched = useMemo(() => rows.map(r => {
    const dt = new Date(r.date + 'T00:00:00');
    return { ...r, ano: String(dt.getFullYear()), mes: monthLabelPt(dt), diaSemana: weekdayPt(dt), semana: String(weekOfMonth(dt)) };
  }), [rows]);

  const unique = (key: 'ano'|'mes'|'diaSemana'|'semana'|'faixa', source = enriched) => [...new Set(source.map((d) => d[key]))].filter(Boolean) as string[];
  const options = useMemo(() => {
    const monthCandidates = fAno.length > 0 ? enriched.filter(d => fAno.includes(d.ano)) : enriched;
    return {
      anos: unique('ano').sort(),
      meses: unique('mes', monthCandidates),
      diasSemana: ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].filter(d => unique('diaSemana').includes(d)),
      semanas: ['1','2','3','4','5'].filter(s => unique('semana').includes(s)),
      faixas: unique('faixa').sort((a, b) => (parseFaixaStart(a) || 0) - (parseFaixaStart(b) || 0)),
    };
  }, [enriched, fAno]);

  const filtered = useMemo(() => enriched.filter(r =>
    (fAno.length === 0 || fAno.includes(r.ano)) &&
    (fMes.length === 0 || fMes.includes(r.mes)) &&
    (fDiaSemana.length === 0 || fDiaSemana.includes(r.diaSemana)) &&
    (fSemana.length === 0 || fSemana.includes(r.semana)) &&
    (fFaixa.length === 0 || fFaixa.includes(r.faixa))
  ), [enriched, fAno, fMes, fDiaSemana, fSemana, fFaixa]);

  const cards = useMemo(() => {
    const total = filtered.reduce((s, r) => s + r.total, 0);
    const pedidos = filtered.length;
    const ticket = pedidos ? total / pedidos : 0;
    const dias = [...new Set(filtered.map(r => r.date))].length;
    return { total, pedidos, ticket, mediaDia: dias ? total / dias : 0 };
  }, [filtered]);

  const serieDia = useMemo(() => {
    const map = new Map<string, { date: string; faturamento: number; pedidos: number }>();
    for (const r of filtered) {
      if (!map.has(r.date)) map.set(r.date, { date: r.date, faturamento: 0, pedidos: 0 });
      const row = map.get(r.date)!;
      row.faturamento += r.total;
      row.pedidos += 1;
    }
    return [...map.values()].sort((a,b) => a.date.localeCompare(b.date)).map(r => ({ ...r, label: brDate(r.date) }));
  }, [filtered]);

  const serieFaixa = useMemo(() => {
    const map = new Map<string, { faixa: string; revenue: number; orders: number }>();
    for (const r of filtered) {
      if (!map.has(r.faixa)) map.set(r.faixa, { faixa: r.faixa, revenue: 0, orders: 0 });
      const row = map.get(r.faixa)!;
      row.revenue += r.total;
      row.orders += 1;
    }
    return [...map.values()].sort((a,b) => (parseFaixaStart(a.faixa) || 0) - (parseFaixaStart(b.faixa) || 0));
  }, [filtered]);

  if (!globalBuffer) return <div className="glass-panel p-8 text-center text-muted font-bold">Carregando planilha...</div>;
  if (rows.length === 0) return <div className="glass-panel p-8 text-center text-muted font-bold">Não encontrei dados de faturamento na aba DADOS.</div>;

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-lime/8 via-transparent to-neon-pink/6 pointer-events-none" />
        <div className="relative">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-8">
            <div>
              <h1 className="text-2xl font-black">Faturamento</h1>
              <p className="text-muted mt-2 text-sm max-w-xl">Painel no layout original, com filtros múltiplos, resumo visual e análise por faixa horária.</p>
            </div>
            <div className="px-4 py-2 rounded-full border border-white/10 bg-black/30 text-sm font-bold text-white/80">{intBR(filtered.length)} registros</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
            <MultiSelect label="Ano" options={options.anos} selected={fAno} onChange={setFAno} />
            <MultiSelect label="Mês" options={options.meses} selected={fMes} onChange={setFMes} />
            <MultiSelect label="Dia" options={options.diasSemana} selected={fDiaSemana} onChange={setFDiaSemana} />
            <MultiSelect label="Semana" options={options.semanas} selected={fSemana} onChange={setFSemana} />
            <MultiSelect label="Faixa" options={options.faixas} selected={fFaixa} onChange={setFFaixa} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard title="Faturamento" value={moneyBR(cards.total)} subtitle="Total da seleção" valueColor="text-neon-lime" />
            <KPICard title="Pedidos" value={intBR(cards.pedidos)} subtitle="Qtde de registros" valueColor="text-white" />
            <KPICard title="Ticket médio" value={moneyBR(cards.ticket)} subtitle="Faturamento / pedidos" valueColor="text-neon-cyan" />
            <KPICard title="Média por dia" value={moneyBR(cards.mediaDia)} subtitle="Base nos dias filtrados" valueColor="text-neon-yellow" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-black">Fluxo diário</h2><span className="text-xs text-muted">Faturamento por data</span></div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieDia}>
                <defs><linearGradient id="fatArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a3ff12" stopOpacity={0.5}/><stop offset="100%" stopColor="#a3ff12" stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,.55)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,.55)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => moneyBR(Number(v) || 0)} labelFormatter={(l) => `Data: ${l}`} />
                <Area type="monotone" dataKey="faturamento" stroke="#a3ff12" fill="url(#fatArea)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-black">Pedidos por faixa</h2><span className="text-xs text-muted">Volume por horário</span></div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieFaixa}>
                <XAxis dataKey="faixa" tick={{ fill: 'rgba(255,255,255,.55)', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis tick={{ fill: 'rgba(255,255,255,.55)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any, n: any) => n === 'revenue' ? moneyBR(Number(v) || 0) : intBR(Number(v) || 0)} />
                <Bar dataKey="orders" fill="#4dd7ff" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-black">Faixas horárias detalhadas</h2><span className="text-xs text-muted">Faturamento e pedidos</span></div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {serieFaixa.map((df) => {
            const max = Math.max(...serieFaixa.map(x => x.revenue), 1);
            const pct = (df.revenue / max) * 100;
            return (
              <div key={df.faixa} className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors heat-v">
                <div className="flex justify-between items-end mb-2">
                  <span className="font-bold text-sm tracking-wider">{df.faixa}</span>
                  <div className="text-right">
                    <div className="text-neon-lime font-bold leading-none">{df.orders}</div>
                    <div className="text-[10px] text-muted">{moneyBR(df.revenue)}</div>
                  </div>
                </div>
                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-neon-lime to-green-400 rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%` }}></div></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, subtitle, valueColor = 'text-white' }: { title: string; value: React.ReactNode; subtitle: string; valueColor?: string }) {
  return (
    <div className="glass-panel p-4 flex flex-col justify-center transition-transform hover:-translate-y-1 duration-200">
      <div className="text-xs text-muted font-bold uppercase tracking-wider mb-2">{title}</div>
      <div className={cn('text-2xl font-black mb-1', valueColor)}>{value}</div>
      <div className="text-xs text-muted">{subtitle}</div>
    </div>
  );
}
