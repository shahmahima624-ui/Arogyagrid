"use client";
import { useEffect, useState } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";

export default function Dashboard() {
  const [counts, setCounts] = useState({
    facilities: 0,
    medicines: 0,
    inventory: 0,
  });
  useEffect(() => {
    Promise.all([
      api<unknown[]>("/facilities"),
      api<unknown[]>("/medicines"),
      api<unknown[]>("/inventory"),
    ])
      .then(([facilities, medicines, inventory]) =>
        setCounts({
          facilities: facilities.length,
          medicines: medicines.length,
          inventory: inventory.length,
        }),
      )
      .catch(() => undefined);
  }, []);
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-sm font-semibold text-emerald-700">
          DISTRICT MEDICINE RESILIENCE
        </p>
        <h1 className="mt-2 text-3xl font-bold">Operational foundation</h1>
        <p className="mt-2 text-slate-600">
          Live Phase 1 records from the AarogyaGrid API.
        </p>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Facilities", counts.facilities],
            ["Medicines", counts.medicines],
            ["Inventory batches", counts.inventory],
          ].map(([label, value]) => (
            <div className="rounded-xl border bg-white p-6" key={String(label)}>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-bold">{value}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
