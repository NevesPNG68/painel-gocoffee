import React, { useState, useEffect } from 'react';
import { Receipt } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn, moneyBR } from '../../lib/utils';
import { MultiSelect } from '../../components/MultiSelect';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Despesa {
  dateStr: string;
  mes: string;
  ano: string;
  qtd: number;
  item: string;
  grupo: string;
  fornec: string;
  ccusto: string;
  vlrUnit: number;
  total: number;
  status: string;
}

const MONTH_ORDER = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CMV_GROUPS = ['CAFÉ','BEBIDAS','SALGADOS','DOCES','INSUMOS','LEITE'];
const INSUMOS_GROUP = 'INSUMOS';
const PALETTE = ['#FF3333','#FFD700','#00CFFF','#FF8C00','#B8FF00','#CC44FF','#00FF99','#FF69B4','#00BFFF'];
const INSUMOS_COLOR: Record<string, string> = {
  'CAFÉ': '#FF6B00', 'BEBIDAS': '#00C8FF', 'SALGADOS': '#FF2D55', 'DOCES': '#FFD700',
  'INSUMOS': '#00E676', 'LEITE': '#E040FB', 'LIMPEZA': '#00BFA5', 'AGUA': '#29B6F6',
  'LUZ': '#FFC107', 'FUNCIONARIOS': '#7C4DFF', 'ALUGUEL': '#F50057', 'IMPOSTOS': '#69F0AE'
};

interface Props {
  globalBuffer: ArrayBuffer | null;
  setGlobalBuffer: (b: ArrayBuffer) => void;
}

export default function DespesasDashboard({ globalBuffer }: Props) {
  const [data, setData] = useState<Despesa[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [fAno, setFAno] = useState<string[]>([]);
  const [fMes, setFMes] = useState<string[]>([]);
  const [fGrupo, setFGrupo] = useState<string[]>([]);
  const [fCusto, setFCusto] = useState<string[]>([]);
  const [fItem, setFItem] = useState<string[]>([]);

  useEffect(() => {
    if (!globalBuffer) return;
    try {
      const wb = XLSX.read(globalBuffer, { type: 'array', cellDates: true });
      const normalize = (s: string) => String(s).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]/gu,'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      const sheetName = wb.SheetNames.find(n => normalize(n) === 'despesas') || wb.SheetNames.find(n => normalize(n).includes('despesa'));
      if (!sheetName) return;
      const ws = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });

      let headerRow = -1;
      for (let i = 0; i < raw.length; i++) {
        if (String(raw[i][1]).toLowerCase().includes('data') && String(raw[i][2]).toLowerCase().includes('mê')) {
          headerRow = i; break;
        }
      }
      if (headerRow === -1) headerRow = 5;

      const parsed: Despesa[] = [];
      for (let i = headerRow + 1; i < raw.length; i++) {
        const r = raw[i];
        if (!r[1] && !r[5]) continue;

        let dateStr = '';
        const dateVal = r[1];
        if (dateVal instanceof Date) dateStr = dateVal.toLocaleDateString('pt-BR');
        else if (typeof dateVal === 'number') {
          const d = XLSX.SSF.parse_date_code(dateVal);
          if (d) dateStr = `${String(d.d).padStart(2,'0')}/${String(d.m).padStart(2,'0')}/${d.y}`;
        } else dateStr = String(dateVal);

        const item = String(r[5] || '').trim();
        const grupo = String(r[6] || '').trim();
        const total = parseFloat(r[10]) || 0;
        if (!item || !grupo || total === 0) continue;

        parsed.push({
          dateStr,
          mes: String(r[2] || '').trim(),
          ano: String(r[3] || '').trim(),
          qtd: parseFloat(r[4]) || 0,
          item,
          grupo,
          fornec: String(r[7] || '').trim(),
          ccusto: String(r[8] || '').trim(),
          vlrUnit: parseFloat(r[9]) || 0,
          total,
          status: String(r[18] || '').trim()
        });
      }
      if (parsed.length > 0) setData(parsed);

      const revSheet = wb.SheetNames.find(n => normalize(n) === 'dados') || wb.SheetNames.find(n => normalize(n).includes('dados'));
      if (revSheet) {
        const rws = wb.Sheets[revSheet];
        const rRaw = XLSX.utils.sheet_to_json<any>(rws, { defval: '' });
        setRevenueData(rRaw);
      }
    } catch(err) {
      console.error('DespesasDashboard failed to parse globalBuffer', err);
    }
  }, [globalBuffer]);

  if (data.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <Receipt className="w-20 h-20 text-neon-yellow mb-6 opacity-80" />
        <h2 className="text-3xl font-black tracking-widest text-[#f5f5f5] mb-2 uppercase">Dashboard de Despesas</h2>
        <p className="text-muted mb-8 text-center text-sm px-4">Utilize o botão "CARREGAR PLANILHA BASE" no menu superior.</p>
      </div>
    );
  }

  const filtered = data.filter(d => 
    (!fAno.length || fAno.includes(d.ano)) &&
    (!fMes.length || fMes.includes(d.mes)) &&
    (!fGrupo.length || fGrupo.includes(d.grupo)) &&
    (!fCusto.length || fCusto.includes(d.ccusto)) &&
    (!fItem.length || fItem.includes(d.item))
  );

  const monthCandidates = fAno.length > 0 ? data.filter(d => fAno.includes(d.ano)) : data;
  const opts = {
    anos: Array.from(new Set(data.map(d => d.ano))).filter(Boolean).sort() as string[],
    meses: Array.from(new Set(monthCandidates.map(d => d.mes))).filter(Boolean).sort((a: any, b: any) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)) as string[],
    grupos: Array.from(new Set(data.map(d => d.grupo))).filter(Boolean).sort() as string[],
    custos: Array.from(new Set(data.map(d => d.ccusto))).filter(Boolean).sort() as string[],
    itens: Array.from(new Set(data.map(d => d.item))).filter(Boolean).sort() as string[]
  };

  const total = filtered.reduce((s, d) => s + d.total, 0);
  const totalInsumos = filtered.filter(d => d.grupo === INSUMOS_GROUP).reduce((s, d) => s + d.total, 0);
  const cmv = filtered.filter(d => CMV_GROUPS.includes(d.grupo)).reduce((s, d) => s + d.total, 0);

  const byMonthRaw = new Map<string, number>();
  filtered.forEach(d => {
    const key = `${d.mes}/${d.ano.slice(-2)}`;
    byMonthRaw.set(key, (byMonthRaw.get(key) || 0) + d.total);
  });
  const barData = Array.from(byMonthRaw.entries()).map(([name, val]) => ({ name, value: val }));

  const roscaMap = new Map<string, number>();
  filtered.forEach(d => roscaMap.set(d.grupo, (roscaMap.get(d.grupo) || 0) + d.total));
  const pieData = Array.from(roscaMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));
  const totalQtdFiltered = filtered.reduce((s, d) => s + d.qtd, 0);

  let receitaTotal = 0;
  if (revenueData.length > 0) {
    revenueData.forEach(r => {
      let iso = '';
      const dataVal = r['date'] || r['DATA'] || r['Data'] || r['DATA DA ORDEM'] || r['Data da Ordem'] || r['DATA DA ORDEM '];
      if (typeof dataVal === 'number') {
        const dtc = XLSX.SSF.parse_date_code(dataVal);
        if (dtc) iso = `${dtc.y}-${String(dtc.m).padStart(2,'0')}-${String(dtc.d).padStart(2,'0')}`;
      } else {
        const s = String(dataVal).trim();
        const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) iso = `${m[3]}-${m[2]}-${m[1]}`;
        else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
      }
      if (!iso) return;
      const ano = iso.slice(0,4);
      const mesNum = parseInt(iso.slice(5,7), 10);
      const mesNome = MONTH_ORDER[mesNum - 1];
      if (fAno.length > 0 && !fAno.includes(ano)) return;
      if (fMes.length > 0 && !fMes.includes(mesNome)) return;
      const totalVal = r['total'] || r['Total'] || r['TOTAL'] || r['Valor'] || r['V'] || r['LIQUIDO'] || r['Líquido'] || r['VLR LIQ'];
      let num = 0;
      if (typeof totalVal === 'number') num = totalVal;
      else {
        const s = String(totalVal || '').replace(/\s/g,'').replace(/R\$/gi,'');
        num = Number(s.replace(/\./g,'').replace(/,/g,'.')) || 0;
      }
      receitaTotal += num;
    });
  }

  const fixo = filtered.filter(d => ['FIXO'].includes((d.ccusto || '').toUpperCase())).reduce((s, d) => s + d.total, 0);
  const fixoVar = filtered.filter(d => ['FIXO/VARIÁVEL','FIXO/VARIAVEL'].includes((d.ccusto || '').toUpperCase())).reduce((s, d) => s + d.total, 0);
  const fixoMaisFixoVar = fixo + fixoVar;
  const variavel = filtered.filter(d => ['VARIÁVEL','VARIAVEL'].includes((d.ccusto || '').toUpperCase())).reduce((s, d) => s + d.total, 0);

  const pctCmv = receitaTotal > 0 ? ((cmv / receitaTotal) * 100).toFixed(1) + '%' : '0.0%';
  const mkp = cmv > 0 ? (receitaTotal / cmv).toFixed(2) : '0.00';
  const limitGastoPct = ((total / 30000) * 100).toFixed(1) + '%';

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neon-yellow">Despesas e Insumos</h1>
          <p className="text-muted text-sm mt-1">Análise detalhada de custos e CMV.</p>
        </div>
      </div>

      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
          <h2 className="font-bold">Filtros</h2>
          <button onClick={() => { setFAno([]); setFMes([]); setFGrupo([]); setFCusto([]); setFItem([]); }} className="text-xs font-bold text-muted hover:text-white">LIMPAR</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MultiSelect label="Ano" options={opts.anos} selected={fAno} onChange={setFAno} />
          <MultiSelect label="Mês" options={opts.meses} selected={fMes} onChange={setFMes} />
          <MultiSelect label="Grupo" options={opts.grupos} selected={fGrupo} onChange={setFGrupo} />
          <MultiSelect label="Custo" options={opts.custos} selected={fCusto} onChange={setFCusto} />
          <MultiSelect label="Item" options={opts.itens} selected={fItem} onChange={setFItem} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
        <KPIDespesa title="Total Despesas" value={moneyBR(total)} subtitle={`${filtered.length} lançamentos`} color="border-yellow-500 text-white" valueColor="text-white" />
        <KPIDespesa title="Total Insumos" value={moneyBR(totalInsumos)} subtitle={`${total > 0 ? (totalInsumos / total * 100).toFixed(1) : 0}% do total`} color="border-orange-500 text-white" valueColor="text-white" />
        <KPIDespesa title="CMV" value={moneyBR(cmv)} subtitle={`Receita do período: ${moneyBR(receitaTotal)}`} color="border-lime-500 text-white" valueColor="text-white" />
        <KPIDespesa title="% CMV" value={pctCmv} subtitle={`${moneyBR(cmv)} ÷ ${moneyBR(receitaTotal)}`} color="border-green-600 text-lime-400" valueColor="text-lime-400" />
        <KPIDespesa title="MKP" value={mkp} subtitle={`${moneyBR(receitaTotal)} ÷ ${moneyBR(cmv)}`} color="border-pink-500 text-lime-400" valueColor="text-lime-400" />
        <KPIDespesa title="Limite de Gasto" value={limitGastoPct} subtitle={`${moneyBR(total)} ÷ ${moneyBR(30000)}`} color="border-red-500 text-red-400" valueColor="text-red-400" />
        <KPIDespesa title="Fixo" value={moneyBR(fixo)} subtitle={`${total > 0 ? (fixo / total * 100).toFixed(1) : 0}% do total`} color="border-blue-400 text-white" valueColor="text-white" />
        <KPIDespesa title="Fixo + Fixo/Variável" value={moneyBR(fixoMaisFixoVar)} subtitle={`${total > 0 ? (fixoMaisFixoVar / total * 100).toFixed(1) : 0}% do total`} color="border-blue-300 text-white" valueColor="text-white" />
        <KPIDespesa title="Fixo/Variável" value={moneyBR(fixoVar)} subtitle={`${total > 0 ? (fixoVar / total * 100).toFixed(1) : 0}% do total`} color="border-blue-200 text-white" valueColor="text-white" />
        <KPIDespesa title="Variável" value={moneyBR(variavel)} subtitle={`${total > 0 ? (variavel / total * 100).toFixed(1) : 0}% do total`} color="border-yellow-400 text-white" valueColor="text-white" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <h3 className="font-bold mb-4">Total de Despesas por Mês</h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '12px' }} formatter={(v: number) => moneyBR(v)} />
                <Bar dataKey="value" fill="#c8933a" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-panel p-6">
          <h3 className="font-bold mb-4">Peso por Grupo</h3>
          <div className="h-[240px] flex">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={INSUMOS_COLOR[entry.name] || PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '12px' }} formatter={(v: number) => moneyBR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h3 className="font-bold uppercase tracking-wider text-sm">Detalhamento de Despesas</h3>
          <span className="text-muted text-xs">{filtered.length} itens</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 text-muted uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Data</th>
                <th className="px-6 py-4 font-semibold">Item</th>
                <th className="px-6 py-4 font-semibold">Grupo</th>
                <th className="px-6 py-4 font-semibold">Fornecedor</th>
                <th className="px-6 py-4 font-semibold text-right">Qtd</th>
                <th className="px-6 py-4 font-semibold text-right pl-4">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.slice(0, 100).map((d, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-muted">{d.dateStr}</td>
                  <td className="px-6 py-4 max-w-[200px] truncate" title={d.item}>{d.item}</td>
                  <td className="px-6 py-4 font-bold" style={{ color: INSUMOS_COLOR[d.grupo] || '#aaa' }}>{d.grupo}</td>
                  <td className="px-6 py-4 text-muted max-w-[150px] truncate">{d.fornec}</td>
                  <td className="px-6 py-4 font-mono text-right">{Number.isInteger(d.qtd) ? d.qtd : d.qtd.toFixed(2)}</td>
                  <td className="px-6 py-4 font-mono text-right font-bold text-neon-yellow pl-4">{moneyBR(d.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-white/5 border-t border-white/20">
              <tr>
                <td colSpan={4} className="px-6 py-4 font-bold text-right uppercase tracking-wider text-xs">Total na visualização</td>
                <td className="px-6 py-4 font-mono font-bold text-right text-neon-cyan">{Number.isInteger(totalQtdFiltered) ? totalQtdFiltered : totalQtdFiltered.toFixed(2)} un</td>
                <td className="px-6 py-4 font-mono font-bold text-right text-neon-yellow pl-4">{moneyBR(total)}</td>
              </tr>
            </tfoot>
          </table>
          {filtered.length > 100 && (
            <div className="p-4 text-center text-xs text-muted font-bold">Mostrando 100 de {filtered.length} lançamentos.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPIDespesa({ title, value, subtitle, color, valueColor }: { title: string, value: string, subtitle: string, color: string, valueColor?: string }) {
  return (
    <div className={cn("bg-[#151515] border-t-2 border-r-2 border-b-2 border-l-4 p-5 rounded-xl shadow-lg relative flex flex-col justify-center", color)} style={{ borderRightColor: 'rgba(255,255,255,0.05)', borderBottomColor: 'rgba(255,255,255,0.05)', borderTopColor: 'rgba(255,255,255,0.05)' }}>
      <div className="text-xs uppercase tracking-wider font-bold mb-3 text-white/80">{title}</div>
      <div className={cn("text-3xl font-bold font-sans", valueColor || "text-white")}>{value}</div>
      <div className="text-xs mt-3 text-white/40 font-medium">{subtitle}</div>
    </div>
  );
}
