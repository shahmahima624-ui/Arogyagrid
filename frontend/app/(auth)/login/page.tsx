"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Lock, Mail, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../../../lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, user, isLoading } = useAuth();

  // Redirect already-authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email address and password.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await signIn(email, password);
    setLoading(false);

    if (authError) {
      setError(authError);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
        {/* Brand Identity Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md mb-2">
            <Activity className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Aarogya<span className="text-teal-600">Grid</span>
          </h1>
          <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
            Medicine Supply Resilience Network
          </p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto pt-1">
            Predict. Redistribute. Prevent. Sign in to access your district operations dashboard.
          </p>
        </div>

        {/* Error Feedback Alert */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Official Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@aarogyagrid.org"
                required
                className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-teal-600 text-white font-semibold text-xs hover:bg-teal-700 transition-colors shadow-2xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign In to AarogyaGrid"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        {/* Demo Info */}
        <div className="pt-4 border-t border-slate-100 text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
            Supabase Auth & RBAC Protected
          </div>
        </div>
      </div>
    </div>
  );
}
