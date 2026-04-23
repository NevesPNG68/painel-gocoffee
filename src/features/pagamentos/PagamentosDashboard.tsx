import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

type Props = {
  globalBuffer: ArrayBuffer | null;
  setGlobalBuffer: (buffer: ArrayBuffer | null) => void;
};

type PagamentoRow = {
  vencimento: string;
  mes: string;
  ano: string;
  fornecedor: string;
  item: string;
  status: string;
  total: number;
  aPagar: number;
};

const MONTH_ORDER = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MONTH_LABELS: Record<string, string> = {
  janeiro: 'Janeiro', fevereiro: 'Fevereiro', marco: 'Março', abril: 'Abril', maio: 'Maio', junho: 'Junho',
  julho: 'Julho', agosto: 'Agosto', setembro: 'Setembro', outubro: 'Outubro', novembro: 'Novembro', dezembro: 'Dezembro'
};

function moneyBR(v: number) {
  return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalize(value: any) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseMoney(value: any): number {
  if (typeof value === 'number') return value;
  const s = String(value || '').replace(/R\$/gi, '').replace(/\s/g, '');
  return Number(s.replace(/\./g, '').replace(/,/g, '.')) || 0;
}

function parseDateBR(value: any): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toLocaleDateString('pt-BR');
  }
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`;
  }
  return String(value || '').trim();
}

export default function PagamentosDashboard({ globalBuffer }: Props) {
  const [rows, setRows] = useState<PagamentoRow[]>([]);
  const [ano, setAno] = useState('');
  const [mes, setMes] = useState('');

  useEffect(() => {
    if (!globalBuffer) return;

    try {
      const wb = XLSX.read(globalBuffer, { type: 'array', cellDates: true });
      const sheetName = wb.SheetNames.find((n) => normalize(n) === 'despesas') || wb.SheetNames.find((n) => normalize(n).includes('despesa'));
      if (!sheetName) return;

      const ws = wb.Sheets[sheetName];
      const matrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', range: 1 });
      const parsed: PagamentoRow[] = [];

      for (const r of matrix) {
        const item = String(r[5] || '').trim();
        const mesPgto = normalize(r[15]);
        const anoPgto = String(r[16] || '').trim().replace(/,0$/, '');
        if (!item || !mesPgto || !anoPgto) continue;

        parsed.push({
          vencimento: parseDateBR(r[14]),
          mes: mesPgto,
          ano: anoPgto,
          fornecedor: String(r[7] || '').trim(),
          item,
          status: String(r[18] || '').trim() || '—',
          total: parseMoney(r[13]) || parseMoney(r[10]) || 0,
          aPagar: parseMoney(r[11]) || 0,
        });
      }

      setRows(parsed);

      const combos = parsed
        .map((r) => ({ ano: r.ano, mes: r.mes }))
        .sort((a, b) => Number(a.ano) - Number(b.ano) || MONTH_ORDER.indexOf(a.mes) - MONTH_ORDER.indexOf(b.mes));

      if (combos.length) {
        const last = combos[combos.length - 1];
        setAno(last.ano);
        setMes(last.mes);
      }
    } catch (error) {
      console.error('Erro ao ler pagamentos:', error);
    }
  }, [globalBuffer]);

  const anos = useMemo(() => Array.from(new Set(rows.map((r) => r.ano))).sort((a, b) => Number(a) - Number(b)), [rows]);
  const meses = useMemo(
    () => Array.from(new Set(rows.filter((r) => r.ano === ano).map((r) => r.mes))).sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)),
    [rows, ano]
  );

  const filtered = useMemo(() => rows.filter((r) => r.ano === ano && r.mes === mes), [rows, ano, mes]);
  const total = filtered.reduce((sum, r) => sum + r.total, 0);
  const saldo = filtered.reduce((sum, r) => sum + r.aPagar, 0);
  const pago = filtered.reduce((sum, r) => sum + Math.max(0, r.total - r.aPagar), 0);

  const grouped = useMemo(() => {
    const map = new Map<string, PagamentoRow[]>();
    for (const row of filtered) {
      const key = row.vencimento || 'Sem vencimento';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [filtered]);

  if (!globalBuffer) {
    return <section className="glass-panel p-6">Carregando planilha...</section>;
  }

  if (rows.length === 0) {
    return <section className="glass-panel p-6">Não encontrei dados de pagamentos na aba DESPESAS.</section>;
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Pagamentos</h1>
            <p className="text-white/60 mt-1">Agrupado por vencimento com base na aba DESPESAS.</p>
          </div>
          <div className="flex gap-3">
            <select value={ano} onChange={(e) => setAno(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={mes} onChange={(e) => setMes(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              {meses.map((m) => <option key={m} value={m}>{MONTH_LABELS[m] || m}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-white/60 text-sm">Total</div><div className="text-2xl font-black mt-1">{moneyBR(total)}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-white/60 text-sm">Pago</div><div className="text-2xl font-black mt-1">{moneyBR(pago)}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-white/60 text-sm">A pagar</div><div className="text-2xl font-black mt-1">{moneyBR(saldo)}</div></div>
        </div>
      </section>

      {grouped.map(([date, items]) => {
        const saldoDia = items.reduce((sum, r) => sum + r.aPagar, 0);
        return (
          <section key={date} className="glass-panel overflow-hidden">
            <div className="px-6 py-4 bg-white/5 border-b border-white/10 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-bold">{date}</div>
                <div className="text-white/60 text-sm">{items.length} lançamento(s)</div>
              </div>
              <div className="text-xl font-black">{moneyBR(saldoDia)}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="text-white/60 border-b border-white/10">
                  <tr>
                    <th className="text-left py-3 px-6 pr-4">Fornecedor</th>
                    <th className="text-left py-3 pr-4">Item</th>
                    <th className="text-left py-3 pr-4">Status</th>
                    <th className="text-right py-3 pr-4">Total</th>
                    <th className="text-right py-3 px-6">A pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, idx) => (
                    <tr key={idx} className="border-b border-white/5">
                      <td className="py-3 px-6 pr-4 font-medium">{r.fornecedor || '—'}</td>
                      <td className="py-3 pr-4">{r.item}</td>
                      <td className="py-3 pr-4">{r.status}</td>
                      <td className="py-3 pr-4 text-right">{moneyBR(r.total)}</td>
                      <td className="py-3 px-6 text-right">{moneyBR(r.aPagar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
