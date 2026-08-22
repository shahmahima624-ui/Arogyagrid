"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
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
  LogOut,
  User,
  ShieldCheck,
} from "lucide-react";

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const navLinks = [
    { href: "/dashboard", label: "Command Centre", icon: LayoutDashboard },
    { href: "/risks", label: "Risk Engine", icon: ShieldAlert },
    { href: "/expiry-rescue", label: "Expiry Rescue", icon: Clock },
    { href: "/redistribution", label: "Redistribution", icon: Zap },
    { href: "/transfers", label: "Transfers", icon: Truck },
    { href: "/copilot", label: "AI Copilot", icon: Bot },
    { href: "/voice-reporting", label: "Voice Reporting", icon: Mic },
    { href: "/register-digitisation", label: "Register Scan", icon: ScanLine },
    { href: "/forecasts", label: "Forecasts", icon: TrendingUp },
    { href: "/facilities", label: "Facilities", icon: Building2 },
    { href: "/inventory", label: "Inventory", icon: Boxes },
    { href: "/consumption", label: "Consumption", icon: FileSpreadsheet },
    { href: "/consumption-intelligence", label: "Insights", icon: BarChart3 },
  ];

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case "DISTRICT_ADMIN":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "FACILITY_ADMIN":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "HEALTHCARE_STAFF":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "WAREHOUSE_MANAGER":
        return "bg-amber-100 text-amber-800 border-amber-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs group-hover:bg-emerald-700 transition-colors">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                AAROGYA<span className="text-emerald-600">GRID</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                Resilience Network
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 font-semibold shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-emerald-600" : "text-slate-500"}`} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Role Profile & Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-900 leading-tight">
                  {user.name}
                </span>
                <span className="text-[11px] text-slate-500 font-medium truncate max-w-[180px]">
                  {user.email}
                </span>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${getRoleBadgeColor(
                  user.role
                )}`}
              >
                <ShieldCheck className="h-3 w-3" />
                {user.role.replace("_", " ")}
              </span>
              <Link
                href="/login"
                title="Switch User Role"
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
              >
                Switch Role
              </Link>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <User className="h-4 w-4" />
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
