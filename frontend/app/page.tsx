"use client";

import { useEffect, useState } from "react";

type HealthState = "checking" | "connected" | "unavailable";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

export default function Home() {
  const [health, setHealth] = useState<HealthState>("checking");

  useEffect(() => {
    fetch(`${apiBaseUrl}/health`)
      .then((response) => {
        if (!response.ok) throw new Error("Health check failed");
        setHealth("connected");
      })
      .catch(() => setHealth("unavailable"));
  }, []);

  const message =
    health === "connected"
      ? "Connected to the AarogyaGrid API"
      : health === "unavailable"
        ? "API unavailable — start the FastAPI service to connect"
        : "Checking API connection…";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-2xl rounded-2xl border border-emerald-100 bg-white p-10 shadow-sm">
        <p className="text-sm font-semibold tracking-[0.18em] text-emerald-700">
          AAROGYAGRID
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
          Predict. Redistribute. Prevent.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
          A medicine supply resilience network for public healthcare facilities.
        </p>
        <div className="mt-8 rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900">
          {message}
        </div>
        <p className="mt-8 text-sm text-slate-500">
          Development foundation · Phase 0
        </p>
      </section>
    </main>
  );
}
