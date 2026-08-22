"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { Activity, ArrowRight, Eye, EyeOff, UserRound } from "lucide-react";
import Link from "next/link";

type Tab = "signin" | "signup";

export default function LoginPage() {
 const router = useRouter();
 const { user, signIn, signUp, isLoading } = useAuth();
 const [tab, setTab] = useState<Tab>("signin");
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [name, setName] = useState("");
 const [showPass, setShowPass] = useState(false);
 const [error, setError] = useState("");
 const [submitting, setSubmitting] = useState(false);

 const handleSignIn = async (e: React.FormEvent) => {
 e.preventDefault();
 setError("");
 setSubmitting(true);
 const { error: err } = await signIn(email, password);
 setSubmitting(false);
 if (err) {
 setError(err);
 } else {
 router.push("/dashboard");
 }
 };

 const handleSignUp = async (e: React.FormEvent) => {
 e.preventDefault();
 setError("");
 setSubmitting(true);
 const { error: err } = await signUp(email, password, name);
 setSubmitting(false);
 if (err) {
 setError(err);
 } else {
 setError("");
 // Show success hint — Supabase sends confirmation email
 setTab("signin");
 }
 };

 const handleContinueAsGuest = () => {
 // Already defaults to DISTRICT_ADMIN — just go to dashboard
 router.push("/dashboard");
 };

 return (
 <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
 {/* Brand */}
 <div className="mb-8 text-center">
 <div className="flex items-center justify-center gap-2 mb-2">
 <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600">
 <Activity className="h-5 w-5 text-white" />
 </div>
 <span className="text-2xl font-black text-slate-900 tracking-tight">
 Aarogya<span className="text-emerald-600">Grid</span>
 </span>
 </div>
 <p className="text-sm text-slate-500">National Health Mission · Supply Resilience Network</p>
 </div>

 {/* Card */}
 <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
 {/* Tabs */}
 <div className="flex border-b border-slate-200">
 <button
 onClick={() => { setTab("signin"); setError(""); }}
 className={`flex-1 py-3 text-sm font-semibold transition-colors ${
 tab === "signin"
 ? "text-emerald-700 border-b-2 border-emerald-600 bg-white"
 : "text-slate-500 hover:text-slate-700 bg-slate-50"
 }`}
 >
 Sign In
 </button>
 <button
 onClick={() => { setTab("signup"); setError(""); }}
 className={`flex-1 py-3 text-sm font-semibold transition-colors ${
 tab === "signup"
 ? "text-emerald-700 border-b-2 border-emerald-600 bg-white"
 : "text-slate-500 hover:text-slate-700 bg-slate-50"
 }`}
 >
 Create Account
 </button>
 </div>

 <div className="p-6">
 {tab === "signin" ? (
 <form onSubmit={handleSignIn} className="space-y-4">
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
 <input
 type="email"
 required
 autoComplete="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="you@example.com"
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
 />
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
 <div className="relative">
 <input
 type={showPass ? "text" : "password"}
 required
 autoComplete="current-password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 placeholder="••••••••"
 className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-9 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
 />
 <button
 type="button"
 onClick={() => setShowPass(!showPass)}
 className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
 >
 {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 </div>

 {error && (
 <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
 {error}
 </p>
 )}

 <button
 type="submit"
 disabled={submitting || isLoading}
 className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
 >
 {submitting ? "Signing in…" : "Sign In"}
 {!submitting && <ArrowRight className="h-4 w-4" />}
 </button>
 </form>
 ) : (
 <form onSubmit={handleSignUp} className="space-y-4">
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
 <input
 type="text"
 required
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="Dr. Priya Sharma"
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
 />
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
 <input
 type="email"
 required
 autoComplete="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="you@example.com"
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
 />
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
 <div className="relative">
 <input
 type={showPass ? "text" : "password"}
 required
 minLength={6}
 autoComplete="new-password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 placeholder="Min. 6 characters"
 className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-9 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
 />
 <button
 type="button"
 onClick={() => setShowPass(!showPass)}
 className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
 >
 {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 </div>

 {error && (
 <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
 {error}
 </p>
 )}

 <p className="text-xs text-slate-500">
 New accounts get <strong className="text-emerald-700">District Admin</strong> access by default — all features are available.
 </p>

 <button
 type="submit"
 disabled={submitting || isLoading}
 className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
 >
 {submitting ? "Creating account…" : "Create Account"}
 {!submitting && <ArrowRight className="h-4 w-4" />}
 </button>
 </form>
 )}

 {/* Divider */}
 <div className="my-4 flex items-center gap-3">
 <div className="flex-1 h-px bg-slate-200" />
 <span className="text-xs text-slate-400">or</span>
 <div className="flex-1 h-px bg-slate-200" />
 </div>

 {/* Guest access */}
 <button
 onClick={handleContinueAsGuest}
 className="w-full py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
 >
 <UserRound className="h-4 w-4 text-slate-400" />
 Continue as Guest (Full Access)
 </button>
 </div>

 {/* Logged in state */}
 {user && user.id !== "default-admin" && (
 <div className="border-t border-slate-100 px-6 py-3 bg-emerald-50 flex items-center justify-between">
 <p className="text-xs text-slate-600">
 Signed in as <strong className="text-emerald-700">{user.name}</strong>
 </p>
 <Link href="/dashboard" className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1">
 Dashboard <ArrowRight className="h-3 w-3" />
 </Link>
 </div>
 )}
 </div>

 <p className="mt-6 text-xs text-slate-400">
 Authentication powered by{" "}
 <span className="font-semibold text-slate-500">Supabase Auth</span>
 </p>
 </div>
 );
}
