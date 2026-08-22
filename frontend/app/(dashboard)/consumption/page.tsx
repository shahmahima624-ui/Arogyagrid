"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";

type ConsumptionRecord = {
 id: string;
 facility_id: string;
 medicine_id: string;
 date: string;
 quantity_consumed: number;
 patient_count?: number;
};
type Named = { id: string; name: string };


export default function ConsumptionPage() {
 const [records, setRecords] = useState<ConsumptionRecord[]>([]);
 const [facilities, setFacilities] = useState<Named[]>([]);
 const [medicines, setMedicines] = useState<Named[]>([]);
 const [message, setMessage] = useState("");
 const load = () => api<ConsumptionRecord[]>("/consumption").then(setRecords);
 useEffect(() => {
 load();
 api<Named[]>("/facilities").then(setFacilities);
 api<Named[]>("/medicines").then(setMedicines);
 }, []);
 const facilityNames = useMemo(
 () => new Map(facilities.map((x) => [x.id, x.name])),
 [facilities],
 );
 const medicineNames = useMemo(
 () => new Map(medicines.map((x) => [x.id, x.name])),
 [medicines],
 );
 async function submit(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 const data = new FormData(event.currentTarget);
 try {
 await api("/consumption", {
 method: "POST",
 body: JSON.stringify({
 facility_id: data.get("facility_id"),
 medicine_id: data.get("medicine_id"),
 date: data.get("date"),
 quantity_consumed: Number(data.get("quantity_consumed")),
 patient_count: Number(data.get("patient_count")),
 }),
 });
 setMessage("Consumption recorded.");
 event.currentTarget.reset();
 load();
 } catch (error) {
 setMessage(
 error instanceof Error ? error.message : "Unable to save record",
 );
 }
 }
 return (
 <>
 <main className="mx-auto max-w-6xl p-6">
 <h1 className="text-3xl font-bold">Consumption history</h1>
 <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
 <div className="overflow-hidden rounded-xl border">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-50">
 <tr>
 <th className="p-3">Date</th>
 <th>Facility</th>
 <th>Medicine</th>
 <th>Consumed</th>
 <th>Patients</th>
 </tr>
 </thead>
 <tbody>
 {records.slice(0, 100).map((r) => (
 <tr className="border-t" key={r.id}>
 <td className="p-3">{r.date}</td>
 <td>{facilityNames.get(r.facility_id)}</td>
 <td>{medicineNames.get(r.medicine_id)}</td>
 <td>{r.quantity_consumed}</td>
 <td>{r.patient_count ?? "—"}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <form onSubmit={submit} className="rounded-xl border bg-white p-5">
 <h2 className="font-semibold">Record consumption</h2>
 <select
 required
 name="facility_id"
 className="mt-3 w-full rounded border p-2"
 >
 <option value="">Facility</option>
 {facilities.map((x) => (
 <option value={x.id} key={x.id}>
 {x.name}
 </option>
 ))}
 </select>
 <select
 required
 name="medicine_id"
 className="mt-3 w-full rounded border p-2"
 >
 <option value="">Medicine</option>
 {medicines.map((x) => (
 <option value={x.id} key={x.id}>
 {x.name}
 </option>
 ))}
 </select>
 <input
 required
 defaultValue={new Date().toISOString().slice(0, 10)}
 type="date"
 name="date"
 className="mt-3 w-full rounded border p-2"
 />
 <input
 required
 min="0"
 type="number"
 name="quantity_consumed"
 placeholder="Units consumed"
 className="mt-3 w-full rounded border p-2"
 />
 <input
 min="0"
 type="number"
 name="patient_count"
 placeholder="Patient count"
 className="mt-3 w-full rounded border p-2"
 />
 <button className="mt-3 rounded bg-emerald-700 px-4 py-2 text-white">
 Save record
 </button>
 <p className="mt-2 text-sm">{message}</p>
 </form>
 </div>
 </main>
 </>
 );
}
