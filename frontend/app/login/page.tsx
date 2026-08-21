"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MOCK_USERS, useAuth } from "../../lib/auth-context";
import { ShieldCheck, Building2, Warehouse, UserCheck, ArrowRight, Activity } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, loginAsMock, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<"mock" | "credentials">("mock");

  const handleMockLogin = async (token: string) => {
    await loginAsMock(token);
    router.push("/dashboard");
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "DISTRICT_ADMIN":
        return <ShieldCheck className="h-6 w-6 text-emerald-600" />;
      case "FACILITY_ADMIN":
        return <Building2 className="h-6 w-6 text-blue-600" />;
      case "HEALTHCARE_STAFF":
        return <Activity className="h-6 w-6 text-purple-600" />;
      case "WAREHOUSE_MANAGER":
        return <Warehouse className="h-6 w-6 text-amber-600" />;
      default:
        return <UserCheck className="h-6 w-6 text-slate-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-4">
          <Activity className="h-10 w-10 text-emerald-400 animate-pulse" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          AAROGYA<span className="text-emerald-400">GRID</span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Operational Medicine Supply Resilience Command Centre
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-slate-800/80 border border-slate-700/60 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 backdrop-blur-md">
          {/* Mode Switcher */}
          <div className="flex border-b border-slate-700 mb-6">
            <button
              onClick={() => setActiveTab("mock")}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "mock"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserCheck className="h-4 w-4" />
              Quick Role Switcher (Mock Auth)
            </button>
            <button
              onClick={() => setActiveTab("credentials")}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "credentials"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Email / Password Login
            </button>
          </div>

          {activeTab === "mock" ? (
            <div>
              <div className="mb-4 bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-3 text-xs text-emerald-300">
                ⚡ <strong>Instant Dev Access:</strong> Select any seeded stakeholder profile below to test role-scoped command centre views and data isolation.
              </div>

              <div className="space-y-3">
                {MOCK_USERS.map((preset) => {
                  const isCurrent = user?.firebase_uid === preset.token;
                  return (
                    <button
                      key={preset.token}
                      onClick={() => handleMockLogin(preset.token)}
                      disabled={isLoading}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start justify-between group ${
                        isCurrent
                          ? "bg-emerald-900/30 border-emerald-500/80 ring-1 ring-emerald-500/50"
                          : "bg-slate-900/50 border-slate-700/70 hover:border-slate-500 hover:bg-slate-700/40"
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
                          {getRoleIcon(preset.role)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white group-hover:text-emerald-300 transition-colors">
                              {preset.name}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              {preset.roleLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            📍 {preset.facilityName}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {preset.description}
                          </p>
                        </div>
                      </div>
                      <div className="self-center">
                        <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleMockLogin("mock-district-admin");
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@aarogyagrid.org"
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full mt-2 flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-slate-900 bg-emerald-400 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 font-semibold transition-colors"
              >
                Sign In to Command Centre
              </button>
            </form>
          )}

          {user && (
            <div className="mt-6 pt-6 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
              <span>Logged in as: <strong className="text-emerald-400">{user.name}</strong> ({user.role})</span>
              <button
                onClick={() => router.push("/dashboard")}
                className="text-emerald-400 hover:underline flex items-center gap-1 font-medium"
              >
                Go to Dashboard &rarr;
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
