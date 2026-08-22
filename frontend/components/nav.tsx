"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { useState } from "react";
import {
  Activity,
  LayoutDashboard,
  Building2,
  Boxes,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  ShieldAlert,
  Clock,
  Zap,
  Truck,
  Bot,
  Mic,
  ScanLine,
  MapPin,
  FileText,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  ShieldCheck,
  Search,
} from "lucide-react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/facilities", label: "Health Centers", icon: Building2 },
  { href: "/risks", label: "Stockout Risks", icon: ShieldAlert },
  { href: "/expiry-rescue", label: "Expiry Rescue", icon: Clock },
  { href: "/redistribution", label: "Redistribution", icon: Zap },
  { href: "/transfers", label: "Stock Transfers", icon: Truck },
  { href: "/inventory", label: "Medicine Inventory", icon: Boxes },
  { href: "/consumption", label: "Patient Records", icon: FileSpreadsheet },
  { href: "/copilot", label: "AI Copilot", icon: Bot },
  { href: "/voice-reporting", label: "Voice Reports", icon: Mic },
  { href: "/register-digitisation", label: "Register OCR", icon: ScanLine },
  { href: "/map", label: "Geo Network", icon: MapPin },
  { href: "/stress-simulator", label: "Simulator", icon: Activity },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/forecasts", label: "Forecasts", icon: TrendingUp },
  { href: "/consumption-intelligence", label: "Analytics", icon: BarChart3 },
];

const roleBadge: Record<string, { label: string; color: string }> = {
  DISTRICT_ADMIN: { label: "District Officer", color: "bg-teal-50 text-teal-700 border-teal-200" },
  FACILITY_ADMIN: { label: "Facility Officer", color: "bg-blue-50 text-blue-700 border-blue-200" },
  HEALTHCARE_STAFF: { label: "Health Staff", color: "bg-purple-50 text-purple-700 border-purple-200" },
  WAREHOUSE_MANAGER: { label: "Warehouse Mgr", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const badge = user?.role ? roleBadge[user.role] : null;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Header Bar */}
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 border-b border-slate-100 py-2.5">
        <div className="flex items-center justify-between gap-4">
          {/* Brand & Subtitle */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white shadow-xs group-hover:bg-teal-800 transition-colors">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold tracking-tight text-slate-900">
                    DHOP <span className="text-teal-700 font-semibold text-xs ml-1">· District Health Operations Platform</span>
                  </span>
                  <span className="hidden md:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    AarogyaGrid Edition
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                  National Health Mission Jurisdiction • Real-Time Operations
                </p>
              </div>
            </Link>
          </div>

          {/* Quick Search & Status Indicators */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>District Jurisdiction: <strong className="text-slate-800">Ahmedabad Central</strong></span>
            </div>

            {/* User Profile */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-bold">
                  {user?.name ? user.name[0] : "A"}
                </div>
                <span className="hidden sm:block truncate max-w-[130px]">
                  {user?.name || "District Admin"}
                </span>
                {badge && (
                  <span className={`hidden lg:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                    {badge.label}
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden text-xs">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <p className="font-bold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-slate-500 truncate">{user?.email}</p>
                    {badge && (
                      <span className={`mt-2 inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full border ${badge.color}`}>
                        <ShieldCheck className="h-3 w-3" /> {badge.label}
                      </span>
                    )}
                  </div>
                  <div className="p-1.5">
                    <Link
                      href="/login"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold"
                    >
                      <User className="h-3.5 w-3.5 text-slate-500" /> Switch Role / Login
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Module Navigation Row */}
      <div className="bg-slate-50/80 px-4 sm:px-6 lg:px-8 border-t border-slate-100">
        <div className="mx-auto max-w-screen-2xl">
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? "bg-teal-700 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-white" : "text-slate-500"}`} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 shadow-lg">
          <div className="grid grid-cols-2 gap-1.5">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    active
                      ? "bg-teal-700 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
