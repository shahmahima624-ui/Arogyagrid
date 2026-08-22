"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useAuth, UserRole } from "../lib/auth-context";
import { SidebarNav } from "./sidebar";

const roleDisplayMap: Record<UserRole, { label: string; bg: string; text: string; border: string }> = {
  DISTRICT_ADMIN: { label: "District Officer", bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  FACILITY_ADMIN: { label: "Facility Officer", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  HEALTHCARE_STAFF: { label: "Health Staff", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  WAREHOUSE_MANAGER: { label: "Warehouse Mgr", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  // Listen to realtime notifications/events via SSE
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";
      es = new EventSource(`${baseUrl}/events`);
      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          setEvents((prev) => [parsed, ...prev.slice(0, 19)]);
        } catch {}
      };
    } catch {}
    return () => es?.close();
  }, []);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    router.replace("/login");
  };

  const roleConfig = user?.role ? roleDisplayMap[user.role] : roleDisplayMap.DISTRICT_ADMIN;

  // Derive scope label from backend profile (no hardcoded district names)
  const scopeLabel = user?.district_id
    ? "District Scope"
    : user?.facility_id
    ? "Facility Scope"
    : user?.warehouse_id
    ? "Warehouse Scope"
    : "Unassigned";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs h-14 flex items-center px-4 justify-between">
        {/* Left: Mobile Menu Toggle & Brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-slate-500 hover:text-slate-800 p-1.5 rounded-lg border border-slate-200"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white shadow-2xs group-hover:bg-teal-700 transition-colors">
              <Activity className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-slate-900 leading-none">
                Aarogya<span className="text-teal-600">Grid</span>
              </span>
              <span className="text-[10px] text-slate-400 font-semibold tracking-tight hidden sm:inline">
                Medicine Supply Resilience Network
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Role Badge, Notification Bell, User Menu */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Role & Scope Badge */}
          <div className="hidden sm:flex items-center gap-2 border-r border-slate-200 pr-3">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${roleConfig.bg} ${roleConfig.text} ${roleConfig.border}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {roleConfig.label}
            </span>
            <span className="text-xs font-medium text-slate-500">{scopeLabel}</span>
          </div>

          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => setNotifDrawerOpen(true)}
            className="relative text-slate-500 hover:text-slate-800 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Bell className="h-4 w-4" />
            {events.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                {events.length}
              </span>
            )}
          </button>

          {/* Profile Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-bold text-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : "?"}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:inline" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white shadow-xl border border-slate-200 p-2 z-50 space-y-1">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">{user?.name || "Authenticated User"}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                  <p className="text-[10px] text-teal-600 font-semibold mt-0.5">{user?.role?.replace(/_/g, " ")}</p>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
                >
                  <User className="h-4 w-4 text-slate-400" />
                  Account &amp; Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg text-left"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body Layout (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white shrink-0">
          <SidebarNav />
          <div className="p-3 border-t border-slate-200 text-center">
            <p className="text-[11px] text-slate-400 font-semibold">AarogyaGrid Resilience v2.4</p>
          </div>
        </aside>

        {/* Mobile Slide-over Sidebar Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
            <div className="relative w-64 bg-white border-r border-slate-200 flex flex-col z-10">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">AarogyaGrid Navigation</span>
                <button onClick={() => setMobileOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Notification Drawer */}
        {notifDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs" onClick={() => setNotifDrawerOpen(false)} />
            <div className="relative w-full max-w-md bg-white border-l border-slate-200 flex flex-col z-10 shadow-2xl">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-teal-600" />
                  <h3 className="text-sm font-bold text-slate-900">System Notifications</h3>
                </div>
                <button onClick={() => setNotifDrawerOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {events.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Bell className="h-8 w-8 mx-auto text-slate-300" />
                    <p className="text-xs">No recent notifications</p>
                  </div>
                ) : (
                  events.map((evt, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{evt.event_type || "SUPPLY_ALERT"}</span>
                        <span className="text-[10px] text-slate-400">
                          {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : "Just now"}
                        </span>
                      </div>
                      <p className="text-slate-600">{evt.message || evt.description || "Supply event received."}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
                <Link
                  href="/notifications"
                  onClick={() => setNotifDrawerOpen(false)}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-800"
                >
                  View All Notifications →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
