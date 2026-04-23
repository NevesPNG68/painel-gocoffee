import React, { useState, useMemo, useEffect } from 'react';
import { MultiSelect } from '../../components/MultiSelect';
import { getFaturamentoBase } from '../../data/mockData';
import { cn, pad2, moneyBR, intBR, brDate, weekdayPt, weekOfMonth, parseFaixaStart, monthLabelPt } from '../../lib/utils';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell, BarChart, Bar, LabelList } from 'recharts';
import * as XLSX from 'xlsx';

interface Props {
  globalBuffer: ArrayBuffer | null;
  setGlobalBuffer: (b: ArrayBuffer) => void;
}

type Row = { date: string; faixa: string; total: number };

export default function FaturamentoDashboard({ globalBuffer }: Props) {
  const [data, setData] = useState<Row[]>([]);
  const [fAno, setFAno] = useState<string[]>([]);
  const [fMes, setFMes] = useState<string[]>([]);
  const [fDiaSemana, setFDiaSemana] = useState<string[]>([]);
  const [fSemana, setFSemana] = useState<string[]>([]);
  const [fFaixa, setFFaixa] = useState<string[]>([]);

  useEffect(() => {
    if (!globalBuffer) return;
    try {
      const wb = XLSX.read(globalBuffer, { type: 'array' });
      const normalize = (s: string) => String(s || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]/gu, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const sheetName = wb.SheetNames.find(n => normalize(n) === 'dados') || wb.SheetNames[0];
      if (!sheetName) return;
      const ws = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const pick = (obj: any, keys: string[]) => {
        for (const k of keys) {
          if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
        }
        return '';
      };
      const parsed: Row[] = [];
      for (const r of rows) {
        const dataVal = pick(r, ['date','DATA','Data','DATA ','DATA DA ORDEM','Data da Ordem','DATA DA ORDEM ']);
        const faixa = pick(r, ['faixa','FAIXA','Faixa','FAIXA DE HORA','FAIXA HORA','T']);
        const totalVal = pick(r, ['total','Total','TOTAL','Valor','V','LIQUIDO','Líquido','VLR LIQ','B']);
        let iso = '';
        if (typeof dataVal === 'number') {
          const dtc = XLSX.SSF.parse_date_code(dataVal);
          if (dtc) iso = `${dtc.y}-${pad2(dtc.m)}-${pad2(dtc.d)}`;
        } else {
          const s = String(dataVal).trim();
          const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (m) iso = `${m[3]}-${m[2]}-${m[1]}`;
          else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
        }
        if (!iso || !faixa) continue;
        let num = 0;
        if (typeof totalVal === 'number') num = totalVal;
        else {
          const s = String(totalVal).replace(/\s/g, '').replace(/R\$/gi, '');
          num = Number(s.replace(/\./g, '').replace(/,/g, '.')) || 0;
        }
        parsed.push({ date: iso, faixa: String(faixa).trim(), total: num });
      }
      setData(parsed.length > 0 ? parsed : getFaturamentoBase());
    } catch (err) {
      console.error('FaturamentoDashboard parse failed', err);
      setData(getFaturamentoBase());
    }
  }, [globalBuffer]);

  const enriched = useMemo(() => data.map(r => {
    const dt = new Date(r.date + 'T00:00:00');
    return {
      ...r,
      ano: String(dt.getFullYear()),
      mes: monthLabelPt(dt),
      diaSemana: weekdayPt(dt),
      semana: String(weekOfMonth(dt)),
    };
  }), [data]);

  const options = useMemo(() => {
    const unique = (key: keyof (typeof enriched)[number], rows = enriched) => [...new Set(rows.map(d => String(d[key] || '')))].filter(Boolean);
    const monthCandidates = fAno.length > 0 ? enriched.filter(d => fAno.includes(d.ano)) : enriched;
    return {
      anos: unique('ano').sort(),
      meses: unique('mes', monthCandidates),
      diasSemana: ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].filter(d => unique('diaSemana').includes(d)),
      semanas: ['1','2','3','4','5'].filter(s => unique('semana').includes(s)),
      faixas: unique('faixa').sort((a, b) => (parseFaixaStart(a) || 0) - (parseFaixaStart(b) || 0)),
    };
  }, [enriched, fAno]);

  const filteredData = useMemo(() => enriched.filter(r =>
    (!fAno.length || fAno.includes(r.ano)) &&
    (!fMes.length || fMes.includes(r.mes)) &&
    (!fDiaSemana.length || fDiaSemana.includes(r.diaSemana)) &&
    (!fSemana.length || fSemana.includes(r.semana)) &&
    (!fFaixa.length || fFaixa.includes(r.faixa))
  ), [enriched, fAno, fMes, fDiaSemana, fSemana, fFaixa]);

  const daily = useMemo(() => {
    const byDay = new Map<string, typeof filteredData>();
    for (const x of filteredData) {
      if (!byDay.has(x.date)) byDay.set(x.date, []);
      byDay.get(x.date)!.push(x);
    }
    return [...byDay.keys()].sort().map(d => {
      const it = byDay.get(d)!;
      const dt = new Date(d + 'T00:00:00');
      const revenue = it.reduce((s, x) => s + x.total, 0);
      const orders = it.length;
      return {
        date: d,
        dateBR: brDate(d),
        weekday: weekdayPt(dt),
        revenue,
        orders,
        tkt: orders ? revenue / orders : 0,
        semana: it[0]?.semana || String(weekOfMonth(dt)),
      };
    });
  }, [filteredData]);

  const dayFaixa = useMemo(() => {
    const map = new Map<string, typeof filteredData>();
    for (const x of filteredData) {
      const k = `${x.date}||${x.faixa}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(x);
    }
    return [...map.entries()].map(([k, it]) => {
      const [date, faixa] = k.split('||');
      return {
        date,
        faixa,
        faixaStart: parseFaixaStart(faixa) || 0,
        revenue: it.reduce((s, x) => s + x.total, 0),
        orders: it.length,
      };
    }).sort((a, b) => a.date.localeCompare(b.date) || a.faixaStart - b.faixaStart);
  }, [filteredData]);

  const totalRev = daily.reduce((s, d) => s + d.revenue, 0);
  const totalOrd = daily.reduce((s, d) => s + d.orders, 0);
  const avgTkt = totalOrd ? totalRev / totalOrd : 0;
  const numDays = daily.length;
  const avgRevDay = numDays ? totalRev / numDays : 0;
  const avgOrdDay = numDays ? totalOrd / numDays : 0;

  const peakPerDay = useMemo(() => {
    const m = new Map<string, number>();
    dayFaixa.forEach(df => {
      const curr = m.get(df.date) || 0;
      if (df.orders > curr) m.set(df.date, df.orders);
    });
    return m;
  }, [dayFaixa]);

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    daily.forEach(d => map.set(d.weekday, (map.get(d.weekday) || 0) + d.revenue));
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [daily]);

  const barData = useMemo(() => {
    const map = new Map<string, number>();
    daily.forEach(d => map.set(String(d.semana), (map.get(String(d.semana)) || 0) + d.revenue));
    return [...map.entries()].map(([name, total]) => ({ name: `${name}ª`, total })).sort((a, b) => a.name.localeCompare(b.name));
  }, [daily]);

  const weekSummaryArray = useMemo(() => {
    return [...new Set(filteredData.map(d => d.semana))].sort().map(semanaStr => {
      const reqs = filteredData.filter(d => d.semana === semanaStr);
      const wRev = reqs.reduce((sum, d) => sum + d.total, 0);
      const wOrd = reqs.length;
      const wTkt = wOrd > 0 ? wRev / wOrd : 0;
      const wDays = [...new Set(reqs.map(r => r.date))];
      let wPeak = 0;
      wDays.forEach(dia => { wPeak = Math.max(wPeak, peakPerDay.get(dia) || 0); });
      return { semanaStr, wRev, wOrd, wTkt, wPeak };
    });
  }, [filteredData, peakPerDay]);

  const faixas = [...new Set(dayFaixa.map(r => r.faixa))].sort((a, b) => (parseFaixaStart(a) || 0) - (parseFaixaStart(b) || 0));
  const days = [...new Set(dayFaixa.map(r => r.date))].sort();
  const PIE_COLORS = ['#a3ff12', '#ff3db8', '#b84dff', '#4dd7ff', '#ffb000', '#00e676', '#ff6b6b'];

  if (data.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-black/20 rounded-3xl m-6 border border-white/5">
        <h2 className="text-3xl font-black tracking-widest text-[#f5f5f5] mb-2 uppercase">Faturamento</h2>
        <p className="text-muted mb-8 text-center max-w-md">Utilize o botão "CARREGAR PLANILHA BASE" no menu superior.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Faturamento por Faixa Horária</h1>
            <p className="text-muted text-sm mt-1">Carregue ou utilize a base para visualizações.</p>
          </div>
          <div className="flex gap-2">
            <span className="text-xs text-muted border border-white/10 bg-white/5 rounded-full px-3 py-1.5 flex items-center"><span className="w-2 h-2 rounded-full bg-neon-lime mr-2"></span> Completo + Upload</span>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
          <h2 className="text-lg font-bold">Filtros</h2>
          <button onClick={() => { setFAno([]); setFMes([]); setFDiaSemana([]); setFSemana([]); setFFaixa([]); }} className="text-sm font-bold px-4 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-colors">Limpar</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MultiSelect label="Ano" options={options.anos} selected={fAno} onChange={setFAno} />
          <MultiSelect label="Mês" options={options.meses} selected={fMes} onChange={setFMes} />
          <MultiSelect label="Dia da Semana" options={options.diasSemana} selected={fDiaSemana} onChange={setFDiaSemana} />
          <MultiSelect label="Nº Semana" options={options.semanas} selected={fSemana} onChange={setFSemana} />
          <MultiSelect label="Faixa Horária" options={options.faixas} selected={fFaixa} onChange={setFFaixa} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Total do Período" value={moneyBR(totalRev)} subtitle="Somatório no recorte" />
        <KPICard title="Pedidos (período)" value={intBR(totalOrd)} subtitle="Quantidade de vendas" valueColor="text-neon-lime" />
        <KPICard title="Ticket Médio" value={moneyBR(avgTkt)} subtitle="Total ÷ pedidos" />
        <KPICard title="Dias no período" value={intBR(numDays)} subtitle="Datas com registro" />
        <div className="glass-panel p-4 flex flex-col justify-center">
          <div className="text-xs text-muted font-bold uppercase tracking-wider mb-2">Médias Diárias</div>
          <div className="text-xl font-black">{moneyBR(avgRevDay)}</div>
          <div className="text-neon-lime text-lg font-bold">{avgOrdDay.toFixed(1)} <span className="text-sm text-muted font-medium">pd/dia</span></div>
        </div>
      </div>

      {daily.length > 0 && (
        <>
          <div className="glass-panel p-6">
            <h3 className="font-bold mb-4">Faturamento Diário</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a3ff12" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a3ff12" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dateBR" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => String(val).slice(0,5)} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${Number(val)/1000}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0a0c10', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} itemStyle={{ color: '#a3ff12', fontWeight: 'bold' }} formatter={(value: number) => moneyBR(value)} />
                  <Area type="monotone" dataKey="revenue" stroke="#a3ff12" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="glass-panel p-6">
              <h3 className="font-bold mb-4">Ticket Médio por Dia</h3>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={daily}>
                    <defs>
                      <linearGradient id="colorTkt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4dd7ff" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4dd7ff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="dateBR" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => String(val).slice(0,5)} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0c10', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} itemStyle={{ color: '#4dd7ff', fontWeight: 'bold' }} formatter={(value: number) => moneyBR(value)} />
                    <Area type="monotone" dataKey="tkt" stroke="#4dd7ff" strokeWidth={3} fillOpacity={1} fill="url(#colorTkt)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel p-6">
              <h3 className="font-bold mb-4">Pedidos por Hora / Faixa</h3>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faixas.map(f => ({ faixa: f, pedidos: dayFaixa.filter(x => x.faixa === f).reduce((s, x) => s + x.orders, 0) }))}>
                    <XAxis dataKey="faixa" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={70} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0c10', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} formatter={(value: number) => `${intBR(value)} pedidos`} />
                    <Bar dataKey="pedidos" fill="#4dd7ff" radius={[8,8,0,0]}>
                      <LabelList dataKey="pedidos" position="top" fill="rgba(255,255,255,0.75)" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-6 lg:col-span-2">
              <h3 className="font-bold mb-4">Faturamento por Dia da Semana</h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0a0c10', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} formatter={(value: number) => moneyBR(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass-panel p-6">
              <h3 className="font-bold mb-4">Por Semana do Mês</h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} barCategoryGap="25%">
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                      contentStyle={{ backgroundColor: '#0a0c10', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      labelFormatter={(label) => `Semana ${label}`}
                      formatter={(value: number) => moneyBR(value)}
                    />
                    <Bar dataKey="total" radius={[8,8,0,0]} maxBarSize={48}>
                      {barData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                      <LabelList dataKey="total" position="top" formatter={(v: number) => `R$ ${(Number(v) / 1000).toFixed(1)}k`} fill="rgba(255,255,255,0.72)" fontSize={10} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold">Mapa de Calor • Pedidos por Faixa / Dia</h3>
                <p className="text-xs text-muted mt-1">As células representam a quantidade de pedidos.</p>
              </div>
              <div className="text-xs text-muted hidden sm:block">Linhas: datas • Colunas: faixas</div>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[920px]">
                <div className="grid" style={{ gridTemplateColumns: `140px repeat(${faixas.length}, minmax(78px, 1fr))` }}>
                  <div className="bg-[#0a0c10] border-b border-white/10 p-3 text-xs uppercase tracking-wider text-muted md:sticky md:left-0 md:z-20">Dia</div>
                  {faixas.map(f => <div key={f} className="border-b border-white/10 p-3 text-[11px] text-center text-muted whitespace-nowrap">{f}</div>)}
                  {days.map(d => {
                    const dts = new Date(d + 'T00:00:00');
                    return (
                      <React.Fragment key={d}>
                        <div className="bg-[#0a0c10] border-b border-white/5 p-3 text-sm font-bold md:sticky md:left-0 md:z-10">
                          {brDate(d)}
                          <span className="block text-[10px] text-muted font-normal">{weekdayPt(dts)}</span>
                        </div>
                        {faixas.map(f => {
                          const row = dayFaixa.find(x => x.date === d && x.faixa === f);
                          const val = row ? row.orders : 0;
                          const max = Math.max(...dayFaixa.map(x => x.orders), 1);
                          const opacity = val > 0 ? 0.15 + (val / max) * 0.85 : 0.04;
                          return (
                            <div key={`${d}-${f}`} className="border-b border-white/5 border-l border-white/5 p-0.5 group">
                              <div className="relative h-14 rounded-md flex items-center justify-center text-white font-bold transition-transform hover:scale-[1.02]" style={{ backgroundColor: val > 0 ? `rgba(163,255,18,${opacity})` : 'rgba(255,255,255,0.04)' }}>
                                <span className="text-xs font-bold drop-shadow-md">{val > 0 ? val : ''}</span>
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="glass-panel p-6 overflow-hidden">
              <h3 className="text-xl font-bold mb-4">Resumo por Semana</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-muted uppercase">
                      <th className="pb-3 px-2">Semana</th>
                      <th className="pb-3 px-2 text-right">Faturamento</th>
                      <th className="pb-3 px-2 text-right text-neon-lime">Ordens</th>
                      <th className="pb-3 px-2 text-right text-neon-pink">TKT</th>
                      <th className="pb-3 px-2 text-right text-orange-400">Pico/dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekSummaryArray.map(w => (
                      <tr key={w.semanaStr} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-2 font-bold">{w.semanaStr}ª</td>
                        <td className="py-3 px-2 text-right">{moneyBR(w.wRev)}</td>
                        <td className="py-3 px-2 text-right text-neon-lime font-medium">{w.wOrd}</td>
                        <td className="py-3 px-2 text-right text-neon-pink font-medium">{moneyBR(w.wTkt)}</td>
                        <td className="py-3 px-2 text-right text-orange-400 font-medium">{w.wPeak}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="glass-panel p-6 overflow-hidden">
              <h3 className="text-xl font-bold mb-4">Resumo por Dia</h3>
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-sm text-left relative">
                  <thead className="sticky top-0 bg-[#0a0c10]/95 backdrop-blur-xl z-20 shadow-md">
                    <tr className="border-b border-white/10 text-muted uppercase">
                      <th className="pb-3 px-2">Data</th>
                      <th className="pb-3 px-2 text-right text-neon-lime">Ordens</th>
                      <th className="pb-3 px-2 text-right text-neon-pink">TKT</th>
                      <th className="pb-3 px-2 text-right">Fat. Diário</th>
                      <th className="pb-3 px-2 text-right text-orange-400">Pico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.slice().reverse().map(d => {
                      const pk = peakPerDay.get(d.date) || 0;
                      return (
                        <tr key={d.date} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-2 font-bold">{d.date.split('-').reverse().join('/')}</td>
                          <td className="py-3 px-2 text-right text-neon-lime font-medium">{d.orders}</td>
                          <td className="py-3 px-2 text-right text-neon-pink font-medium">{moneyBR(d.tkt)}</td>
                          <td className="py-3 px-2 text-right">{moneyBR(d.revenue)}</td>
                          <td className="py-3 px-2 text-right text-orange-400 font-medium">{pk}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
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
