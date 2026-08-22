"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { AppShell } from "../../components/app-shell";
import { Activity, ShieldAlert, LogOut } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, unprovisionedError, signOut } = useAuth();

  useEffect(() => {
    if (!isLoading && !user && !unprovisionedError) {
      router.replace("/login");
    }
  }, [isLoading, user, unprovisionedError, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md mb-3 animate-pulse">
          <Activity className="h-6 w-6" />
        </div>
        <p className="text-xs font-bold text-slate-700">Verifying District Auth Credentials...</p>
        <p className="text-[11px] text-slate-400">Authenticating token against FastAPI security server...</p>
      </div>
    );
  }

  if (unprovisionedError && !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 mx-auto border border-amber-200">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">Account Not Provisioned</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your Supabase account exists, but has not been allocated an application role or facility in the district database.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-center">
            <button
              onClick={() => signOut()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-2xs"
            >
              <LogOut className="h-4 w-4" />
              Sign Out to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
