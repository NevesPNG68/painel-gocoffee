import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function moneyBR(v: number) {
  return "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function intBR(v: number) {
  return Math.round(Number(v) || 0).toLocaleString("pt-BR");
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function brDate(iso: string) {
  if (!iso || iso.indexOf("-") === -1) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function weekdayPt(dt: Date) {
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dt.getDay()];
}

export function monthLabelPt(dt: Date) {
  const mons = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${mons[dt.getMonth()]}/${String(dt.getFullYear()).slice(-2)}`;
}

export function weekOfMonth(dt: Date) {
  const d = dt.getDate();
  if (d <= 7) return 1;
  if (d <= 14) return 2;
  if (d <= 21) return 3;
  if (d <= 28) return 4;
  return 5;
}

export function parseFaixaStart(faixa: string) {
  const m = String(faixa || "").match(/(\d{2}):\d{2}/);
  return m ? parseInt(m[1], 10) : null;
}
