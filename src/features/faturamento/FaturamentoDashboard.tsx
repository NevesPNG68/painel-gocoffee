import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

type Props = {
  globalBuffer: ArrayBuffer | null;
  setGlobalBuffer: (buffer: ArrayBuffer | null) => void;
};

type FatRow = {
  date: string;
  faixa: string;
  total: number;
};

function moneyBR(v: number) {
  return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pad2(v: number | string) {
  return String(v).padStart(2, '0');
}

function parseExcelDate(value: any): string {
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;
  }

  const s = String(value || '').trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  return '';
}

function brDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function parseMoney(value: any): number {
  if (typeof value === 'number') return value;
  const s = String(value || '').replace(/R\$/gi, '').replace(/\s/g, '');
  return Number(s.replace(/\./g, '').replace(/,/g, '.')) || 0;
}

function weekdayPt(iso: string) {
  const dt = new Date(iso + 'T00:00:00');
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dt.getDay()] || '';
}

export default function FaturamentoDashboard({ globalBuffer }: Props) {
  const [rows, setRows] = useState<FatRow[]>([]);

  useEffect(() => {
    if (!globalBuffer) return;

    try {
      const wb = XLSX.read(globalBuffer, { type: 'array' });
      const normalize = (s: string) =>
        String(s || '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

      const sheetName =
        wb.SheetNames.find((n) => normalize(n) === 'dados') ||
        wb.SheetNames[0];
      if (!sheetName) return;

      const ws = wb.Sheets[sheetName];
      const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const pick = (obj: any, keys: string[]) => {
        for (const key of keys) {
          if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') return obj[key];
        }
        return '';
      };

      const parsed: FatRow[] = [];
      for (const r of data) {
        const dateRaw = pick(r, ['date', 'DATA', 'Data', 'DATA ', 'DATA DA ORDEM', 'Data da Ordem', 'C']);
        const faixaRaw = pick(r, ['faixa', 'FAIXA', 'Faixa', 'FAIXA DE HORA', 'FAIXA HORA', 'T']);
        const totalRaw = pick(r, ['total', 'Total', 'TOTAL', 'Valor', 'V', 'LIQUIDO', 'Líquido', 'VLR LIQ', 'B']);

        const date = parseExcelDate(dateRaw);
        const faixa = String(faixaRaw || '').trim();
        const total = parseMoney(totalRaw);

        if (!date || !faixa) continue;
        parsed.push({ date, faixa, total });
      }

      setRows(parsed);
    } catch (error) {
      console.error('Erro ao ler faturamento:', error);
    }
  }, [globalBuffer]);

  const summary = useMemo(() => {
    const byDay = new Map<string, FatRow[]>();
    const byFaixa = new Map<string, number>();

    for (const row of rows) {
      if (!byDay.has(row.date)) byDay.set(row.date, []);
      byDay.get(row.date)!.push(row);
      byFaixa.set(row.faixa, (byFaixa.get(row.faixa) || 0) + row.total);
    }

    const days = Array.from(byDay.entries())
      .map(([date, items]) => {
        const revenue = items.reduce((sum, item) => sum + item.total, 0);
        const pedidos = items.length;
        return {
          date,
          dateBR: brDate(date),
          diaSemana: weekdayPt(date),
          revenue,
          pedidos,
          ticket: pedidos ? revenue / pedidos : 0,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const faixas = Array.from(byFaixa.entries())
      .map(([faixa, total]) => ({ faixa, total }))
      .sort((a, b) => b.total - a.total);

    const total = days.reduce((sum, d) => sum + d.revenue, 0);
    const pedidos = days.reduce((sum, d) => sum + d.pedidos, 0);

    return {
      days,
      faixas,
      total,
      pedidos,
      ticket: pedidos ? total / pedidos : 0,
      mediaDia: days.length ? total / days.length : 0,
    };
  }, [rows]);

  if (!globalBuffer) {
    return <section className="glass-panel p-6">Carregando planilha...</section>;
  }

  if (rows.length === 0) {
    return <section className="glass-panel p-6">Não encontrei dados de faturamento na aba DADOS.</section>;
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6">
        <h1 className="text-2xl font-bold mb-4">Faturamento</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/60 text-sm">Faturamento total</div>
            <div className="text-2xl font-black mt-1">{moneyBR(summary.total)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/60 text-sm">Pedidos</div>
            <div className="text-2xl font-black mt-1">{summary.pedidos.toLocaleString('pt-BR')}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/60 text-sm">Ticket médio</div>
            <div className="text-2xl font-black mt-1">{moneyBR(summary.ticket)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/60 text-sm">Média por dia</div>
            <div className="text-2xl font-black mt-1">{moneyBR(summary.mediaDia)}</div>
          </div>
        </div>
      </section>

      <section className="glass-panel p-6">
        <h2 className="text-xl font-bold mb-4">Resumo por dia</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="text-white/60 border-b border-white/10">
              <tr>
                <th className="text-left py-3 pr-4">Data</th>
                <th className="text-left py-3 pr-4">Dia</th>
                <th className="text-right py-3 pr-4">Faturamento</th>
                <th className="text-right py-3 pr-4">Pedidos</th>
                <th className="text-right py-3">Ticket</th>
              </tr>
            </thead>
            <tbody>
              {summary.days.map((d) => (
                <tr key={d.date} className="border-b border-white/5">
                  <td className="py-3 pr-4 font-medium">{d.dateBR}</td>
                  <td className="py-3 pr-4">{d.diaSemana}</td>
                  <td className="py-3 pr-4 text-right">{moneyBR(d.revenue)}</td>
                  <td className="py-3 pr-4 text-right">{d.pedidos.toLocaleString('pt-BR')}</td>
                  <td className="py-3 text-right">{moneyBR(d.ticket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-panel p-6">
        <h2 className="text-xl font-bold mb-4">Faixas horárias</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="text-white/60 border-b border-white/10">
              <tr>
                <th className="text-left py-3 pr-4">Faixa</th>
                <th className="text-right py-3">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {summary.faixas.map((f) => (
                <tr key={f.faixa} className="border-b border-white/5">
                  <td className="py-3 pr-4 font-medium">{f.faixa}</td>
                  <td className="py-3 text-right">{moneyBR(f.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
