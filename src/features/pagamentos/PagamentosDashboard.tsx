import React, { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn, moneyBR } from '../../lib/utils';

interface Pagamento {
   vencimento: string;
   mesPgto: string;
   anoPgto: string;
   fornec: string;
   nf: string;
   item: string;
   forma: string;
   status: string;
   total: number;
   aPagar: number;
}

const MONTH_ORDER = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const PAG_MONTH_LABELS: Record<string, string> = {
  janeiro:'Janeiro', fevereiro:'Fevereiro', marco:'Março', março:'Março', abril:'Abril', 
  maio:'Maio', junho:'Junho', julho:'Julho', agosto:'Agosto', setembro:'Setembro', 
  outubro:'Outubro', novembro:'Novembro', dezembro:'Dezembro'
};

interface Props {
  globalBuffer: ArrayBuffer | null;
  setGlobalBuffer: (b: ArrayBuffer) => void;
}

export default function PagamentosDashboard({ globalBuffer }: Props) {
  const [data, setData] = useState<Pagamento[]>([]);
  const [activeAno, setActiveAno] = useState<string>('');
  const [activeMes, setActiveMes] = useState<string>('');

  useEffect(() => {
    if (!globalBuffer) return;
    try {
      const wb = XLSX.read(globalBuffer, { type: 'array', cellDates: true });
      const normalize = (s: string) => String(s).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]/gu,'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      const sheetName = wb.SheetNames.find(n => normalize(n) === 'despesas') || wb.SheetNames.find(n => normalize(n).includes('despesa'));
      if (!sheetName) return;
      const ws = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', range: 6 });
      const parsed: Pagamento[] = [];

      const dateToBR = (v: any) => {
        if (v instanceof Date && !isNaN(v.getTime())) return v.toLocaleDateString('pt-BR');
        if (typeof v === 'number') {
          const d = XLSX.SSF.parse_date_code(v);
          if (d) return `${String(d.d).padStart(2,'0')}/${String(d.m).padStart(2,'0')}/${d.y}`;
        }
        return String(v || '').trim();
      };
      const toNumber = (v: any) => {
        if (typeof v === 'number') return v;
        const s = String(v || '').trim();
        if (!s) return 0;
        return Number(s.replace(/\./g,'').replace(',','.')) || 0;
      };

      for (let i = 1; i < raw.length; i++) {
        const r = raw[i] || [];
        const mesPgto = normalize(r[15]);
        const anoPgto = String(r[16] || '').trim().replace(/,0$/, '');
        const statusRaw = String(r[18] || '').trim().toUpperCase();
        const item = String(r[5] || '').trim();
        if (!mesPgto || !anoPgto || !item) continue;
        const status = statusRaw === 'PAGO' ? 'PAGO' : (statusRaw.includes('PAGAR') ? 'A PAGAR' : statusRaw);
        const total = toNumber(r[13]) || toNumber(r[10]) || 0;
        const aPagar = toNumber(r[11]) || 0;
        const vencimento = dateToBR(r[14]);
        if (!vencimento && !total && !aPagar) continue;
        parsed.push({
          vencimento, mesPgto, anoPgto,
          fornec: String(r[7] || '').trim(),
          nf: String(r[17] || '').trim(),
          item,
          forma: String(r[12] || '').trim(),
          status,
          total,
          aPagar
        });
      }

      if (parsed.length > 0) {
        const combos = parsed.map(d => ({ ano: d.anoPgto, mes: d.mesPgto })).sort((a,b) => {
          if (Number(a.ano) !== Number(b.ano)) return Number(a.ano) - Number(b.ano);
          return MONTH_ORDER.indexOf(a.mes) - MONTH_ORDER.indexOf(b.mes);
        });
        if (combos.length > 0) {
          const hoje = new Date();
          const currAno = String(hoje.getFullYear());
          const nomesMeses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
          const currMes = nomesMeses[hoje.getMonth()];
          const hasCurrentYear = combos.some(c => c.ano === currAno);
          const yearToUse = hasCurrentYear ? currAno : combos[combos.length - 1].ano;
          setActiveAno(yearToUse);
          setActiveMes(hasCurrentYear ? currMes : combos[combos.length - 1].mes);
        }
        setData(parsed);
      }
    } catch(err) {
      console.error('PagamentosDashboard failed to parse globalBuffer', err);
    }
  }, [globalBuffer]);

  if (data.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-black/20 rounded-3xl m-6 border border-white/5">
        <CreditCard className="w-20 h-20 text-neon-cyan mb-6 opacity-80" />
        <h2 className="text-3xl font-black tracking-widest text-[#f5f5f5] mb-2 uppercase">Dashboard de Pagamentos</h2>
        <p className="text-muted mb-8 text-center max-w-md">Utilize o botão "CARREGAR PLANILHA BASE" no menu superior.</p>
      </div>
    );
  }

  const anos = Array.from(new Set(data.map(d => d.anoPgto))).filter(Boolean).sort((a,b) => Number(a) - Number(b)) as string[];
  const mesesDaAno = Array.from(new Set(data.filter(d => d.anoPgto === activeAno).map(d => d.mesPgto))).sort((a: any,b: any) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)) as string[];
  const filtered = data.filter(d => d.anoPgto === activeAno && d.mesPgto === activeMes);
  const totalMes = filtered.reduce((s,d) => s + d.total, 0);
  const saldoMes = filtered.reduce((s,d) => s + d.aPagar, 0);
  const pagoMes = filtered.reduce((s,d) => s + Math.max(0, d.total - d.aPagar), 0);

  const byDate = new Map<string, Pagamento[]>();
  filtered.forEach(d => {
    const k = d.vencimento || 'Sem vencimento';
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(d);
  });
  const dates = Array.from(byDate.keys()).sort((a,b) => {
    const pa = a.split('/');
    const pb = b.split('/');
    if (pa.length === 3 && pb.length === 3) {
      return new Date(Number(pa[2]), Number(pa[1])-1, Number(pa[0])).getTime() - new Date(Number(pb[2]), Number(pb[1])-1, Number(pb[0])).getTime();
    }
    if (a === 'Sem vencimento') return 1;
    if (b === 'Sem vencimento') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-8">
            <div>
              <h1 className="text-2xl font-black">Pagamentos por dia</h1>
              <p className="text-muted mt-2 text-sm max-w-xl">Filtro aplicado: <b className="text-white">Mês = {PAG_MONTH_LABELS[activeMes] || activeMes}</b> e <b className="text-white">Ano = {activeAno}</b></p>
              <div className="flex gap-4 mt-4">
                <span className="px-4 py-1.5 bg-black/40 border border-white/10 rounded-full text-sm font-bold text-white shadow-inner">{filtered.length} lançamentos</span>
                <span className="px-4 py-1.5 bg-black/40 border border-white/10 rounded-full text-sm font-bold text-white shadow-inner">{dates.length} dias variados</span>
              </div>
            </div>
            <div className="flex gap-4 items-end">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted uppercase tracking-widest">Ano</label>
                <div className="relative">
                  <select className="appearance-none bg-white/5 border border-white/10 text-white font-bold px-4 py-2.5 pr-10 rounded-xl outline-none focus:border-neon-cyan/50 cursor-pointer min-w-[120px]" value={activeAno} onChange={e => { setActiveAno(e.target.value); const nMeses = Array.from(new Set(data.filter(d => d.anoPgto === e.target.value).map(d => d.mesPgto))) as string[]; if (!nMeses.includes(activeMes)) setActiveMes(nMeses[nMeses.length - 1] || ''); }}>
                    {anos.map(a => <option key={a} value={a} className="bg-gray-900">{a}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted uppercase tracking-widest">Mês</label>
                <div className="relative">
                  <select className="appearance-none bg-white/5 border border-white/10 text-white font-bold px-4 py-2.5 pr-10 rounded-xl outline-none focus:border-neon-cyan/50 cursor-pointer min-w-[150px]" value={activeMes} onChange={e => setActiveMes(e.target.value)}>
                    {mesesDaAno.map(m => <option key={m} value={m} className="bg-gray-900">{PAG_MONTH_LABELS[m] || m}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPIBox label="Total do Mês (l.4)" value={moneyBR(totalMes)} />
            <KPIBox label="Pago no Mês" value={moneyBR(pagoMes)} />
            <KPIBox label="Saldo a Pagar (l.4)" value={moneyBR(saldoMes)} isLime />
            <KPIBox label="Conferência" value={`${filtered.length} itens`} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {dates.length === 0 && (
          <div className="text-center py-12 text-muted font-bold font-sm glass-panel text-lg">Nenhum resultado encontrado.</div>
        )}
        {dates.map(date => {
          const items = byDate.get(date)!;
          const aPagarDia = items.reduce((s,d) => s + d.aPagar, 0);
          const pagoDia = items.reduce((s,d) => s + Math.max(0, d.total - d.aPagar), 0);
          return (
            <details key={date} className="group glass-panel overflow-hidden" open>
              <summary className="list-none cursor-pointer p-5 flex items-center justify-between bg-gradient-to-r from-neon-lime/20 via-neon-lime/5 to-transparent hover:from-neon-lime/30 transition-colors select-none">
                <div>
                  <div className="text-lg font-black">{date}</div>
                  <div className="text-sm text-white/60 font-medium mt-1">A pagar: {moneyBR(aPagarDia)} • Pago: {moneyBR(pagoDia)}</div>
                </div>
                <div className="text-xl font-black text-neon-lime">{moneyBR(aPagarDia)}</div>
              </summary>
              <div className="overflow-x-auto border-t border-white/5">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-white/50 uppercase text-[10px] tracking-widest bg-black/20">
                    <tr>
                      <th className="p-4 font-bold">Fornecedor</th>
                      <th className="p-4 font-bold">NF/Pedido</th>
                      <th className="p-4 font-bold">Item</th>
                      <th className="p-4 font-bold">Forma</th>
                      <th className="p-4 font-bold text-center">Status</th>
                      <th className="p-4 font-bold text-right font-mono">Total</th>
                      <th className="p-4 font-bold text-right font-mono">A Pagar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-black/10">
                    {items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-medium" title={it.fornec}>{it.fornec || '—'}</td>
                        <td className="p-4 text-white/60">{it.nf || '—'}</td>
                        <td className="p-4">{it.item || '—'}</td>
                        <td className="p-4 text-white/80">{it.forma || '—'}</td>
                        <td className="p-4 text-center">
                          <span className={cn("px-3 py-1 rounded-full text-xs font-black tracking-wide border", it.status === 'PAGO' ? "bg-neon-lime/10 text-[#73ffbf] border-[#73ffbf]/30" : "bg-red-500/10 text-red-400 border-red-500/30")}>{it.status}</span>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-white/50">{moneyBR(it.total)}</td>
                        <td className="p-4 text-right font-mono font-black text-white">{moneyBR(it.aPagar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function KPIBox({ label, value, isLime }: { label: string, value: string, isLime?: boolean }) {
  return (
    <div className="bg-black/40 border border-white/5 rounded-2xl p-5 shadow-inner">
      <div className="text-white/60 text-xs font-bold uppercase tracking-wider mb-2">{label}</div>
      <div className={cn("text-2xl font-black", isLime ? "text-neon-lime" : "text-white")}>{value}</div>
    </div>
  );
}
