"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
type Item = {
  id: string;
  medicine_id: string;
  facility_id?: string;
  warehouse_id?: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
};
type Named = { id: string; name: string };
export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [facilities, setFacilities] = useState<Named[]>([]);
  const [medicines, setMedicines] = useState<Named[]>([]);
  const [facility, setFacility] = useState("");
  const [medicine, setMedicine] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(
    () =>
      api<Item[]>(
        `/inventory${facility ? `?facility_id=${facility}` : ""}${facility && medicine ? "&" : !facility && medicine ? "?" : ""}${medicine ? `medicine_id=${medicine}` : ""}`,
      ).then(setItems),
    [facility, medicine],
  );
  useEffect(() => {
    api<Named[]>("/facilities").then(setFacilities);
    api<Named[]>("/medicines").then(setMedicines);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const names = useMemo(
    () => new Map(medicines.map((x) => [x.id, x.name])),
    [medicines],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api("/inventory", {
        method: "POST",
        body: JSON.stringify({
          facility_id: data.get("facility_id"),
          medicine_id: data.get("medicine_id"),
          batch_number: data.get("batch_number"),
          quantity: Number(data.get("quantity")),
          expiry_date: data.get("expiry_date"),
        }),
      });
      setMessage("Inventory batch added.");
      event.currentTarget.reset();
      load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to add batch",
      );
    }
  }
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <div className="mt-6 flex gap-3">
          <select
            className="rounded border p-2"
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
          >
            <option value="">All facilities</option>
            {facilities.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select
            className="rounded border p-2"
            value={medicine}
            onChange={(e) => setMedicine(e.target.value)}
          >
            <option value="">All medicines</option>
            {medicines.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-3">Medicine</th>
                  <th>Batch</th>
                  <th>Quantity</th>
                  <th>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr className="border-t" key={x.id}>
                    <td className="p-3">{names.get(x.medicine_id)}</td>
                    <td>{x.batch_number}</td>
                    <td>{x.quantity}</td>
                    <td>{x.expiry_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form onSubmit={submit} className="rounded-xl border bg-white p-5">
            <h2 className="font-semibold">Add batch</h2>
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
              name="batch_number"
              placeholder="Batch number"
              className="mt-3 w-full rounded border p-2"
            />
            <input
              required
              min="0"
              type="number"
              name="quantity"
              placeholder="Quantity"
              className="mt-3 w-full rounded border p-2"
            />
            <input
              required
              type="date"
              name="expiry_date"
              className="mt-3 w-full rounded border p-2"
            />
            <button className="mt-3 rounded bg-emerald-700 px-4 py-2 text-white">
              Save batch
            </button>
            <p className="mt-2 text-sm">{message}</p>
          </form>
        </div>
      </main>
    </>
  );
}
