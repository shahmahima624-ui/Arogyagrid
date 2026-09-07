"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Warehouse as WarehouseIcon,
  Bell,
  ScrollText,
  Users,
  Settings,
} from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { canAccessRoute } from "../lib/permissions";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    section: "Overview",
    items: [
      {
        label: "Command Centre",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    section: "Supply Operations",
    items: [
      {
        label: "Medicine Inventory",
        href: "/inventory",
        icon: Boxes,
      },
      {
        label: "Patient Consumption",
        href: "/consumption",
        icon: FileSpreadsheet,
      },
      {
        label: "Demand Forecasts",
        href: "/forecasts",
        icon: TrendingUp,
      },
      {
        label: "Stockout Risks",
        href: "/risks",
        icon: ShieldAlert,
      },
      {
        label: "Expiry Rescue",
        href: "/expiry-rescue",
        icon: Clock,
      },
      {
        label: "Redistribution Engine",
        href: "/redistribution",
        icon: Zap,
      },
      {
        label: "Stock Transfers",
        href: "/transfers",
        icon: Truck,
      },
      {
        label: "Warehouses",
        href: "/warehouses",
        icon: WarehouseIcon,
      },
    ],
  },
  {
    section: "Intelligence",
    items: [
      {
        label: "Supply Network Map",
        href: "/map",
        icon: MapPin,
      },
      {
        label: "AI Supply Copilot",
        href: "/copilot",
        icon: Bot,
      },
      {
        label: "Voice Reporting",
        href: "/voice-reporting",
        icon: Mic,
      },
      {
        label: "Register Digitisation",
        href: "/register-digitisation",
        icon: ScanLine,
      },
      {
        label: "Stress Simulator",
        href: "/stress-simulator",
        icon: Activity,
      },
    ],
  },
  {
    section: "Administration",
    items: [
      {
        label: "Health Facilities",
        href: "/facilities",
        icon: Building2,
      },
      {
        label: "Reports & Exports",
        href: "/reports",
        icon: FileText,
      },
      {
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
      },
      {
        label: "Audit Logs",
        href: "/audit-logs",
        icon: ScrollText,
      },
      {
        label: "User Management",
        href: "/users",
        icon: Users,
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const currentRole = user?.role;

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {navGroups.map((group) => {
        // Filter items in group strictly based on centralized permission matrix
        const filteredItems = group.items.filter((item) => canAccessRoute(currentRole, item.href));

        if (filteredItems.length === 0) return null;

        return (
          <div key={group.section} className="flex flex-col gap-1">
            <span className="px-2.5 pb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {group.section}
            </span>
            {filteredItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-teal-600 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto rounded bg-teal-100 text-teal-800 text-[10px] font-bold px-1.5 py-0.5">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
