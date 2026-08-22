"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "../../../lib/api";

type Named = { id: string; name: string };
type Point = { date: string; quantity_consumed: number; rolling_mean_7: number | null };
type Intelligence = {
 summary: {
 total_consumption: number;
 average_daily_demand: number;
 recent_7_day_average: number;
 previous_7_day_average: number;
 recent_demand_change_percent: number | null;
 current_usable_stock: number;
 days_with_recorded_consumption: number;
 };
 series: Point[];
};

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
 return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>{note && <p className="mt-1 text-xs text-slate-500">{note}</p>}</div>;
}

export default function ConsumptionIntelligencePage() {
 const [facilities, setFacilities] = useState<Named[]>([]);
 const [medicines, setMedicines] = useState<Named[]>([]);
 const [facilityId, setFacilityId] = useState("");
 const [medicineId, setMedicineId] = useState("");
 const [data, setData] = useState<Intelligence | null>(null);
 const [error, setError] = useState("");

 useEffect(() => {
 api<Named[]>("/facilities").then((items) => { setFacilities(items); setFacilityId(items[0]?.id ?? ""); }).catch((e) => setError(e.message));
 api<Named[]>("/medicines").then((items) => { setMedicines(items); setMedicineId(items[0]?.id ?? ""); }).catch((e) => setError(e.message));
 }, []);
 useEffect(() => {
 if (!facilityId || !medicineId) return;
 setError("");
 api<Intelligence>(`/consumption-intelligence/series?facility_id=${facilityId}&medicine_id=${medicineId}&days=90`)
 .then(setData).catch((e) => { setData(null); setError(e.message); });
 }, [facilityId, medicineId]);

 const chart = useMemo(() => data?.series.slice(-30) ?? [], [data]);
 const chartMax = Math.max(1, ...chart.map((point) => point.quantity_consumed));
 const change = data?.summary.recent_demand_change_percent ?? null;
 return <>
 <main className="mx-auto max-w-7xl p-6">
 <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
 <div><p className="text-sm font-semibold text-emerald-700">Consumption intelligence</p><h1 className="text-3xl font-bold text-slate-900">Demand history, ready for forecasting</h1><p className="mt-1 text-slate-600">Observed consumption and deterministic features only. No predictive forecast is shown.</p></div>
 <div className="flex gap-2"><select value={facilityId} onChange={(e) => setFacilityId(e.target.value)} className="rounded-lg border border-slate-300 bg-white p-2 text-sm">{facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={medicineId} onChange={(e) => setMedicineId(e.target.value)} className="rounded-lg border border-slate-300 bg-white p-2 text-sm">{medicines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
 </div>
 {error && <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
 {!data && !error && <p className="mt-8 text-slate-500">Loading consumption series…</p>}
 {data && <>
 <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <Metric label="Average daily demand" value={`${data.summary.average_daily_demand.toFixed(1)} units`} note="Across the selected 90 days" />
 <Metric label="Last 7 days" value={`${data.summary.recent_7_day_average.toFixed(1)} units/day`} note={`Prior 7 days: ${data.summary.previous_7_day_average.toFixed(1)}`} />
 <Metric label="Recent demand change" value={change === null ? "Not enough baseline" : `${change > 0 ? "+" : ""}${change}%`} note="Last 7 days versus prior 7 days" />
 <Metric label="Current usable stock" value={`${data.summary.current_usable_stock.toLocaleString()} units`} note={`${data.summary.days_with_recorded_consumption} days with recorded consumption`} />
 </section>
 <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
 <div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Consumption trend</h2><p className="text-sm text-slate-500">Daily units consumed — latest 30 days</p></div><BarChart3 className="h-5 w-5 text-emerald-600" /></div>
 <div className="mt-6 flex h-56 items-end gap-1 border-b border-slate-200 pb-1">
 {chart.map((point) => <div key={point.date} className="group relative flex h-full flex-1 items-end"><div title={`${point.date}: ${point.quantity_consumed} units`} className="w-full rounded-t bg-emerald-500 transition hover:bg-emerald-700" style={{ height: `${Math.max(2, (point.quantity_consumed / chartMax) * 100)}%` }} /><span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-white px-2 py-1 text-xs text-slate-900 group-hover:block">{point.date}: {point.quantity_consumed}</span></div>)}
 </div>
 <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{chart[0]?.date}</span><span>{chart.at(-1)?.date}</span></div>
 </section>
 <section className="mt-6 grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Rolling demand context</h2><p className="mt-2 text-sm text-slate-600">The series includes lag 1, 7 and 14 days, rolling 7/14-day means, rolling 7-day standard deviation, day of week, month, patient count, and current usable stock.</p></div><div className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><span className={`rounded-full p-2 ${change !== null && change > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{change !== null && change > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}</span><div><h2 className="font-semibold text-slate-900">Recent demand signal</h2><p className="text-sm text-slate-600">{change === null ? "A prior 7-day baseline is not available." : change > 0 ? "Consumption is higher than the previous week." : "Consumption is stable or lower than the previous week."}</p></div></div></div></section>
 </>}
 </main>
 </>;
}
