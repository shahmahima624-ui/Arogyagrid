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
} from "lucide-react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/risks", label: "Risks", icon: ShieldAlert },
  { href: "/expiry-rescue", label: "Expiry Rescue", icon: Clock },
  { href: "/redistribution", label: "Redistribution", icon: Zap },
  { href: "/transfers", label: "Transfers", icon: Truck },
  { href: "/forecasts", label: "Forecasts", icon: TrendingUp },
  { href: "/copilot", label: "AI Copilot", icon: Bot },
  { href: "/voice-reporting", label: "Voice", icon: Mic },
  { href: "/register-digitisation", label: "Register Scan", icon: ScanLine },
  { href: "/map", label: "Geo Map", icon: MapPin },
  { href: "/stress-simulator", label: "Simulator", icon: Activity },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/facilities", label: "Facilities", icon: Building2 },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/consumption", label: "Consumption", icon: FileSpreadsheet },
  { href: "/consumption-intelligence", label: "Insights", icon: BarChart3 },
];

const roleBadge: Record<string, { label: string; color: string }> = {
  DISTRICT_ADMIN: { label: "District Admin", color: "bg-emerald-100 text-emerald-700" },
  FACILITY_ADMIN: { label: "Facility Admin", color: "bg-blue-100 text-blue-700" },
  HEALTHCARE_STAFF: { label: "Health Staff", color: "bg-purple-100 text-purple-700" },
  WAREHOUSE_MANAGER: { label: "Warehouse Mgr", color: "bg-amber-100 text-amber-700" },
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
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-black tracking-tight text-slate-900">
              Aarogya<span className="text-emerald-600">Grid</span>
            </span>
          </Link>

          {/* Desktop nav — scrollable */}
          <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto flex-1 mx-4">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-emerald-50 text-emerald-700 font-semibold"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-emerald-600" : "text-slate-400"}`} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right: User + Mobile toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm transition-colors"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                  <User className="h-3.5 w-3.5 text-emerald-700" />
                </div>
                <span className="hidden sm:block text-xs font-semibold text-slate-700 max-w-[120px] truncate">
                  {user?.name || "Admin"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-60 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    {badge && (
                      <span className={`mt-1.5 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <div className="p-1.5">
                    <Link
                      href="/login"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-50 font-medium"
                    >
                      <User className="h-3.5 w-3.5" /> Switch Account / Role
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-rose-600 hover:bg-rose-50 font-medium"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3">
          <div className="grid grid-cols-2 gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-600 hover:bg-slate-50"
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
