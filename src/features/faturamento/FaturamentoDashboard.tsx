import React, { useState, useMemo, useEffect } from 'react';
import { MultiSelect } from '../../components/MultiSelect';
import { getFaturamentoBase } from '../../data/mockData';
import { cn, pad2, moneyBR, intBR, brDate, weekdayPt, weekOfMonth, parseFaixaStart, monthLabelPt } from '../../lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  globalBuffer: ArrayBuffer | null;
  setGlobalBuffer: (b: ArrayBuffer) => void;
}

export default function FaturamentoDashboard({ globalBuffer, setGlobalBuffer }: Props) {
  const [data, setData] = useState<{date: string, faixa: string, total: number}[]>([]);
  
  // Custom Filter State
  const [fAno, setFAno] = useState<string[]>([]);
  const [fMes, setFMes] = useState<string[]>([]);
  const [fDiaSemana, setFDiaSemana] = useState<string[]>([]);
  const [fSemana, setFSemana] = useState<string[]>([]);
  const [fFaixa, setFFaixa] = useState<string[]>([]);

  // Compute filter options based on DATA
  const options = useMemo(() => {
    // Generate derived fields for options
    const enriched = data.map(r => {
      const dt = new Date(r.date + "T00:00:00");
      return {
        ...r,
        ano: String(dt.getFullYear()),
        mes: monthLabelPt(dt),
        diaSemana: weekdayPt(dt),
        semana: String(weekOfMonth(dt))
      };
    });

    const unique = (key: keyof typeof enriched[0], rows = enriched) => [...new Set(rows.map(d => d[key] as string))].filter(Boolean);

    // Cascading filter: if year is selected, only show months for that year
    const monthCandidates = fAno.length > 0 ? enriched.filter(d => fAno.includes(d.ano)) : enriched;

    return {
      anos: unique('ano').sort(),
      meses: unique('mes', monthCandidates), // Cascading applied here
      diasSemana: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].filter(d => unique('diaSemana').includes(d)),
      semanas: ['1', '2', '3', '4', '5'].filter(s => unique('semana').includes(s)),
      faixas: (unique('faixa') as string[]).sort((a, b) => (parseFaixaStart(a) || 0) - (parseFaixaStart(b) || 0))
    };
  }, [data, fAno]);

  // Handle initialization of filters (run once when data changes to ensure we have options)
  // Actually, we default to empty arrays = "All"
  
  // Apply filters
  const filteredData = useMemo(() => {
    let out = data.map(r => {
      const dt = new Date(r.date + "T00:00:00");
      return {
        ...r,
        ano: String(dt.getFullYear()),
        mes: monthLabelPt(dt),
        diaSemana: weekdayPt(dt),
        semana: String(weekOfMonth(dt))
      };
    });

    if (fAno.length) out = out.filter(r => fAno.includes(r.ano));
    if (fMes.length) out = out.filter(r => fMes.includes(r.mes));
    if (fDiaSemana.length) out = out.filter(r => fDiaSemana.includes(r.diaSemana));
    if (fSemana.length) out = out.filter(r => fSemana.includes(r.semana));
    if (fFaixa.length) out = out.filter(r => fFaixa.includes(r.faixa));

    return out;
  }, [data, fAno, fMes, fDiaSemana, fSemana, fFaixa]);

  // Aggregations
  const { daily, dayFaixa, days, faixas } = useMemo(() => {
    const byDay = new Map<string, typeof filteredData>();
    for (const x of filteredData) {
      if (!byDay.has(x.date)) byDay.set(x.date, []);
      byDay.get(x.date)!.push(x);
    }
    const days = [...byDay.keys()].sort();
    
    const daily = days.map(d => {
      const it = byDay.get(d)!;
      const dt = new Date(d + "T00:00:00");
      const revenue = it.reduce((s, x) => s + x.total, 0);
      const orders = it.length;
      return {
        date: d,
        dateBR: brDate(d),
        weekday: weekdayPt(dt),
        revenue,
        orders,
        tkt: orders ? revenue / orders : 0,
        semana: it[0]?.semana || weekOfMonth(dt),
        mes: it[0]?.mes || monthLabelPt(dt)
      };
    });

    const dayFaixaMap = new Map<string, typeof filteredData>();
    for (const x of filteredData) {
      const k = `${x.date}||${x.faixa}`;
      if (!dayFaixaMap.has(k)) dayFaixaMap.set(k, []);
      dayFaixaMap.get(k)!.push(x);
    }

    const dayFaixa = Array.from(dayFaixaMap.entries()).map(([k, it]) => {
      const [date, faixa] = k.split('||');
      return {
        date,
        faixa,
        faixaStart: parseFaixaStart(faixa) || 0,
        revenue: it.reduce((s, x) => s + x.total, 0),
        orders: it.length
      };
    });
    dayFaixa.sort((a,b) => a.date.localeCompare(b.date) || a.faixaStart - b.faixaStart);

    const fSet = new Set(dayFaixa.map(r => r.faixa));
    const faixasList = Array.from(fSet).sort((a,b) => (parseFaixaStart(a) || 0) - (parseFaixaStart(b) || 0));

    return { daily, dayFaixa, days, faixas: faixasList };
  }, [filteredData]);

  // Overall Totals
  const totalRev = daily.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrd = daily.reduce((sum, d) => sum + d.orders, 0);
  const avgTkt = totalOrd > 0 ? totalRev / totalOrd : 0;
  const numDays = daily.length;
  const avgRevDay = numDays > 0 ? totalRev / numDays : 0;
  const avgOrdDay = numDays > 0 ? totalOrd / numDays : 0;

  // Missing Sections Logic
  const peakPerDay = new Map<string, number>();
  const peakPerWeek = new Map<string, number>();
  
  dayFaixa.forEach(df => {
      const dayInfo = daily.find(d => d.date === df.date);
      if (!dayInfo) return;
      
      const vDate = peakPerDay.get(df.date) || 0;
      if (df.orders > vDate) peakPerDay.set(df.date, df.orders);
  });

  const barDataMap = new Map<string, number>();
  daily.forEach(d => barDataMap.set(d.semana, (barDataMap.get(d.semana) || 0) + d.revenue));

  const weekSummaryArray = Array.from(barDataMap.keys()).sort().map(semanaStr => {
     const reqs = filteredData.filter(d => d.semana === semanaStr);
     const wRev = reqs.reduce((sum, d) => sum + d.total, 0);
     const wOrd = reqs.length;
     const wTkt = wOrd > 0 ? wRev/wOrd : 0;
     const wDays = Array.from(new Set(reqs.map(r => r.date)));
     let wPeak = 0;
     wDays.forEach(dia => {
        wPeak = Math.max(wPeak, peakPerDay.get(dia as string) || 0);
     });
     return { semanaStr, wRev, wOrd, wTkt, wPeak };
  });

  // Process GlobalBuffer
  useEffect(() => {
    if (!globalBuffer) return;
    try {
      const wb = XLSX.read(globalBuffer, { type: 'array' });
      
      const normalize = (s: string) => String(s || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]/gu,'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const sheetName = wb.SheetNames.find(n => normalize(n) === 'dados') || wb.SheetNames[0];
      
      if (!sheetName) return; // Silent return for other tabs
      const ws = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      
      const pick = (obj: any, keys: string[]) => {
        for(const k of keys) {
          if(obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
        }
        return '';
      };

      const parsed: {date: string, faixa: string, total: number}[] = [];
      for (const r of rows) {
        const dataVal = pick(r, ['date','DATA','Data','DATA ','DATA DA ORDEM','Data da Ordem','DATA DA ORDEM ']);
        const faixa = pick(r, ['faixa','FAIXA','Faixa','FAIXA DE HORA','FAIXA HORA']);
        const totalVal = pick(r, ['total','Total','TOTAL','Valor','V','LIQUIDO','Líquido','VLR LIQ']);
        
        let iso = '';
        if (typeof dataVal === 'number') {
          const dtc = XLSX.SSF.parse_date_code(dataVal);
          if (dtc) iso = `${dtc.y}-${pad2(dtc.m)}-${pad2(dtc.d)}`;
        } else {
          const s = String(dataVal).trim();
          const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if(m) iso = `${m[3]}-${m[2]}-${m[1]}`;
          else if(/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
        }
        if(!iso || !faixa) continue;
        
        let num = 0;
        if(typeof totalVal === 'number') num = totalVal;
        else {
          const s = String(totalVal).replace(/\s/g,'').replace(/R\$/gi,'');
          num = Number(s.replace(/\./g,'').replace(/,/g,'.')) || 0;
        }

        parsed.push({
          date: iso,
          faixa: String(faixa).trim(),
          total: num
        });
      }
      if (parsed.length > 0) setData(parsed);
    } catch (err) {
      console.error('FaturamentoDashboard failed to parse globalBuffer', err);
    }
  }, [globalBuffer]);

  // File Upload Logic (Removed, replaced by globalBuffer in App.tsx)

  // Pie Chart Data
  const pieDataMap = new Map<string, number>();
  daily.forEach(d => {
    pieDataMap.set(d.weekday, (pieDataMap.get(d.weekday) || 0) + d.revenue);
  });
  const pieData = Array.from(pieDataMap.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  const PIE_COLORS = ['#a3ff12', '#ff3db8', '#b84dff', '#4dd7ff', '#ffb000', '#00e676', '#ff6b6b'];

  // Bar Chart Data (by Week)
  const barData = Array.from(barDataMap.entries()).map(([name, total]) => ({ name: `${name}ª`, total })).sort((a,b) => a.name.localeCompare(b.name));

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
      {/* Header Panel */}
      <div className="glass-panel p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-2xl font-bold tracking-wide">Faturamento por Faixa Horária</h1>
             <p className="text-muted text-sm mt-1">Carregue ou utilize a base para visualizações.</p>
          </div>
          <div className="flex gap-2">
             <span className="text-xs text-muted border border-white/10 bg-white/5 rounded-full px-3 py-1.5 flex items-center">
               <span className="w-2 h-2 rounded-full bg-neon-lime mr-2"></span> Completo + Upload
             </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
          <h2 className="text-lg font-bold">Filtros</h2>
          <div className="flex gap-2 items-center">
            <button 
              onClick={() => { setFAno([]); setFMes([]); setFDiaSemana([]); setFSemana([]); setFFaixa([]); }}
              className="text-sm font-bold px-4 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-colors">
              Limpar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MultiSelect label="Ano" options={options.anos} selected={fAno} onChange={setFAno} />
          <MultiSelect label="Mês" options={options.meses} selected={fMes} onChange={setFMes} />
          <MultiSelect label="Dia da Semana" options={options.diasSemana} selected={fDiaSemana} onChange={setFDiaSemana} />
          <MultiSelect label="Nº Semana" options={options.semanas} selected={fSemana} onChange={setFSemana} />
          <MultiSelect label="Faixa Horária" options={options.faixas} selected={fFaixa} onChange={setFFaixa} />
        </div>
      </div>

      {/* KPI Cards */}
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

      {/* Main Charts */}
      {daily.length > 0 ? (
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
                  <XAxis dataKey="dateBR" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val.slice(0,5)} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val/1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0a0c10', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#a3ff12', fontWeight: 'bold' }}
                    formatter={(value: number) => moneyBR(value)}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#a3ff12" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel p-6">
            <h3 className="font-bold mb-4">Ticket Médio e Pedidos</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="colorTkt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4dd7ff" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4dd7ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dateBR" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val.slice(0,5)} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0a0c10', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#4dd7ff', fontWeight: 'bold' }}
                    formatter={(value: number) => moneyBR(value)}
                  />
                  <Area type="monotone" dataKey="tkt" stroke="#4dd7ff" strokeWidth={3} fillOpacity={1} fill="url(#colorTkt)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-6 lg:col-span-2">
              <h3 className="font-bold mb-4">Faturamento por Dia da Semana</h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0a0c10', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      formatter={(value: number) => moneyBR(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="glass-panel p-6">
               <h3 className="font-bold mb-4">Por Semana do Mês</h3>
               <div className="h-[240px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={barData}>
                     <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                     <YAxis hide />
                     <Tooltip
                        contentStyle={{ backgroundColor: '#0a0c10', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        formatter={(value: number) => moneyBR(value)}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      />
                     <Bar dataKey="total" radius={[8,8,0,0]}>
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>
          </div>
          
          {/* Heatmap implementation - simple grid visualization */}
          <div className="glass-panel p-6 overflow-hidden">
             <h3 className="font-bold mb-1">Mapa de Calor (Pedidos/Hora)</h3>
             <p className="text-sm text-muted mb-4">Densidade de pedidos por faixa horária</p>
             <div className="overflow-x-auto pb-4">
                 {/* Creating the heatmap grid manually as it's highly custom */}
                 <div className="min-w-max grid" style={{ gridTemplateColumns: `80px repeat(${faixas.length}, minmax(50px, 1fr))` }}>
                    <div className="p-2 text-xs font-bold text-white/50 sticky left-0 bg-[#0a0c10]/90 z-10">DIA</div>
                    {faixas.map(f => (
                      <div key={f} className="p-2 text-xs font-bold text-white/50 text-center">{f.slice(0,5)}</div>
                    ))}
                    
                    {days.slice().reverse().map(d => {
                       const dts = new Date(d + "T00:00:00");
                       const dayFaixas = dayFaixa.filter(df => df.date === d);
                       // We calc max value overall to color-code
                       const maxOrd = Math.max(...dayFaixa.map(df => df.orders), 1);
                       
                       return (
                         <React.Fragment key={d}>
                           <div className="p-2 text-xs font-bold text-white/80 sticky left-0 bg-[#0a0c10]/90 z-10 border-t border-white/5">
                             {pad2(dts.getDate())}/{weekdayPt(dts)}
                           </div>
                           {faixas.map(f => {
                             const match = dayFaixas.find(df => df.faixa === f);
                             const val = match?.orders || 0;
                             let opacity = 0.04;
                             if(val > 0) {
                               const ratio = val / maxOrd;
                               if(ratio <= 0.2) opacity = 0.16;
                               else if(ratio <= 0.4) opacity = 0.28;
                               else if(ratio <= 0.6) opacity = 0.45;
                               else if(ratio <= 0.8) opacity = 0.70;
                               else opacity = 0.95;
                             }
                             
                             return (
                               <div key={f} className="p-1 border-t border-white/5">
                                 <div 
                                    className="w-full h-8 sm:h-10 rounded-lg flex items-center justify-center heat-v group relative"
                                    style={{ backgroundColor: val > 0 ? `rgba(163,255,18,${opacity})` : 'rgba(255,255,255,0.04)' }}
                                 >
                                   <span className="text-xs font-bold drop-shadow-md">{val > 0 ? val : ''}</span>
                                   {/* Tooltip on hover */}
                                   <div className="hidden group-hover:block absolute bottom-full mb-2 z-50 bg-[#0a0c10] border border-white/10 p-2 rounded-lg whitespace-nowrap text-xs shadow-xl">
                                      {d}/{monthLabelPt(dts).split('/')[0]} • {f}<br/>
                                      <span className="text-neon-lime">{val} pedidos</span>
                                   </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
             {/* Weekly Summary */}
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

             {/* Daily Summary */}
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
                                 <td className="py-3 px-2 font-bold">
                                    <a href={`#det-${d.date}`} className="hover:text-neon-cyan transition-colors underline decoration-white/20 underline-offset-4">
                                      {d.date.split('-').reverse().join('/')}
                                    </a>
                                 </td>
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

          {/* Details per day */}
          <div className="mt-8 space-y-6">
             <h2 className="text-2xl font-bold tracking-wide">Detalhe por Faixa Horária</h2>
             {daily.slice().reverse().map(d => {
                const dayRows = dayFaixa.filter(df => df.date === d.date);
                if(dayRows.length === 0) return null;
                
                // Sort by orders desc
                const sortedByOrdersDesc = [...dayRows].sort((a,b) => b.orders - a.orders);
                const top3 = sortedByOrdersDesc.slice(0,3);
                
                // Sort chronologically for display
                const chrono = [...dayRows].sort((a,b) => (parseFaixaStart(a.faixa)||0) - (parseFaixaStart(b.faixa)||0));
                
                return (
                  <div id={`det-${d.date}`} key={d.date} className="glass-panel p-6 group scroll-mt-24">
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-white/10 pb-4">
                        <div>
                           <h3 className="text-xl font-bold flex items-center gap-2">
                             {d.date.split('-').reverse().join('/')}
                             <span className="text-sm font-medium text-muted bg-white/5 px-2 py-0.5 rounded uppercase">{d.weekday}</span>
                           </h3>
                           <p className="text-sm text-neon-lime mt-1 font-medium">{d.orders} ordens • {moneyBR(d.revenue)}</p>
                        </div>
                        <div className="text-xs">
                           <span className="text-muted block mb-1">TOP HORÁRIOS:</span>
                           <div className="flex gap-2">
                             {top3.map((t, idx) => (
                               <span key={t.faixa} className={cn(
                                  "px-2 py-1 rounded bg-[#0a0c10] border border-white/10 font-bold",
                                  idx===0 ? "text-orange-400 border-orange-400/30" : "text-white/80"
                               )}>
                                 {t.faixa.slice(0,5)} <span className="opacity-50 font-normal">({t.orders} un)</span>
                               </span>
                             ))}
                           </div>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {chrono.map(df => {
                           const peak = peakPerDay.get(d.date) || 1;
                           const pct = (df.orders / peak) * 100;
                           return (
                             <div key={df.faixa} className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                                <div className="flex justify-between items-end mb-2">
                                   <span className="font-bold text-sm tracking-wider">{df.faixa}</span>
                                   <div className="text-right">
                                      <div className="text-neon-lime font-bold leading-none">{df.orders}</div>
                                      <div className="text-[10px] text-muted">{moneyBR(df.revenue)}</div>
                                   </div>
                                </div>
                                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                                   <div 
                                      className="h-full bg-gradient-to-r from-neon-lime to-green-400 rounded-full transition-all duration-1000 ease-out"
                                      style={{ width: `${pct}%` }}
                                   ></div>
                                </div>
                             </div>
                           );
                        })}
                     </div>
                  </div>
                );
             })}
          </div>
        </>
      ) : (
        <div className="glass-panel p-8 text-center text-muted font-bold">
          Nenhum registro encontrado.
        </div>
      )}
    </div>
  );
}

function KPICard({ title, value, subtitle, valueColor = "text-white" }: { title: string, value: React.ReactNode, subtitle: string, valueColor?: string }) {
  return (
    <div className="glass-panel p-4 flex flex-col justify-center transition-transform hover:-translate-y-1 duration-200">
      <div className="text-xs text-muted font-bold uppercase tracking-wider mb-2">{title}</div>
      <div className={cn("text-2xl font-black mb-1", valueColor)}>{value}</div>
      <div className="text-xs text-muted">{subtitle}</div>
    </div>
  );
}
