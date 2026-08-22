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
import { useAuth, UserRole } from "../lib/auth-context";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
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
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN"],
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
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN", "HEALTHCARE_STAFF", "WAREHOUSE_MANAGER"],
      },
      {
        label: "Patient Consumption",
        href: "/consumption",
        icon: FileSpreadsheet,
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN", "HEALTHCARE_STAFF"],
      },
      {
        label: "Demand Forecasts",
        href: "/forecasts",
        icon: TrendingUp,
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN"],
      },
      {
        label: "Stockout Risks",
        href: "/risks",
        icon: ShieldAlert,
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN", "WAREHOUSE_MANAGER"],
      },
      {
        label: "Expiry Rescue",
        href: "/expiry-rescue",
        icon: Clock,
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN"],
      },
      {
        label: "Redistribution Engine",
        href: "/redistribution",
        icon: Zap,
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN", "WAREHOUSE_MANAGER"],
      },
      {
        label: "Stock Transfers",
        href: "/transfers",
        icon: Truck,
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN", "WAREHOUSE_MANAGER"],
      },
      {
        label: "Warehouses",
        href: "/warehouses",
        icon: WarehouseIcon,
        roles: ["DISTRICT_ADMIN", "WAREHOUSE_MANAGER"],
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
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN", "WAREHOUSE_MANAGER"],
      },
      {
        label: "AI Supply Copilot",
        href: "/copilot",
        icon: Bot,
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN", "HEALTHCARE_STAFF", "WAREHOUSE_MANAGER"],
      },
      {
        label: "Voice Reporting",
        href: "/voice-reporting",
        icon: Mic,
        roles: ["HEALTHCARE_STAFF", "FACILITY_ADMIN"],
      },
      {
        label: "Register Digitisation",
        href: "/register-digitisation",
        icon: ScanLine,
        roles: ["HEALTHCARE_STAFF", "FACILITY_ADMIN"],
      },
      {
        label: "Stress Simulator",
        href: "/stress-simulator",
        icon: Activity,
        roles: ["DISTRICT_ADMIN"],
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
        roles: ["DISTRICT_ADMIN"],
      },
      {
        label: "Reports & Exports",
        href: "/reports",
        icon: FileText,
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN", "WAREHOUSE_MANAGER"],
      },
      {
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN", "HEALTHCARE_STAFF", "WAREHOUSE_MANAGER"],
      },
      {
        label: "Audit Logs",
        href: "/audit-logs",
        icon: ScrollText,
        roles: ["DISTRICT_ADMIN"],
      },
      {
        label: "User Management",
        href: "/users",
        icon: Users,
        roles: ["DISTRICT_ADMIN"],
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["DISTRICT_ADMIN", "FACILITY_ADMIN"],
      },
    ],
  },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const currentRole = user?.role || "DISTRICT_ADMIN";

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {navGroups.map((group) => {
        // Filter items in group based on user role
        const filteredItems = group.items.filter((item) => {
          if (!item.roles) return true;
          return item.roles.includes(currentRole);
        });

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
