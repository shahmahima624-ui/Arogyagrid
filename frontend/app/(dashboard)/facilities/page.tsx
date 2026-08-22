"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
type Facility = {
 id: string;
 name: string;
 facility_type: string;
 address?: string;
 status: string;
};
type Warehouse = { id: string; name: string; address?: string; status: string };
export default function FacilitiesPage() {
 const [facilities, setFacilities] = useState<Facility[]>([]);
 const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
 useEffect(() => {
 api<Facility[]>("/facilities").then(setFacilities);
 api<Warehouse[]>("/warehouses").then(setWarehouses);
 }, []);
 return (
 <>
 <main className="mx-auto max-w-6xl p-6">
 <h1 className="text-3xl font-bold">Facilities & warehouses</h1>
 <div className="mt-6 overflow-hidden rounded-xl border">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-50 text-slate-500">
 <tr>
 <th className="p-3">Name</th>
 <th>Type</th>
 <th>Status</th>
 </tr>
 </thead>
 <tbody>
 {facilities.map((f) => (
 <tr className="border-t" key={f.id}>
 <td className="p-3 font-medium">{f.name}</td>
 <td>{f.facility_type}</td>
 <td>{f.status}</td>
 </tr>
 ))}
 {warehouses.map((w) => (
 <tr className="border-t" key={w.id}>
 <td className="p-3 font-medium">{w.name}</td>
 <td>WAREHOUSE</td>
 <td>{w.status}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </main>
 </>
 );
}
