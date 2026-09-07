import { UserRole } from "./auth-context";

export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  "/dashboard": ["DISTRICT_ADMIN", "FACILITY_ADMIN", "WAREHOUSE_MANAGER", "HEALTHCARE_STAFF"],
  "/facilities": ["DISTRICT_ADMIN"],
  "/warehouses": ["DISTRICT_ADMIN", "WAREHOUSE_MANAGER"],
  "/inventory": ["DISTRICT_ADMIN", "FACILITY_ADMIN", "HEALTHCARE_STAFF", "WAREHOUSE_MANAGER"],
  "/consumption": ["DISTRICT_ADMIN", "FACILITY_ADMIN", "HEALTHCARE_STAFF"],
  "/consumption-intelligence": ["DISTRICT_ADMIN", "FACILITY_ADMIN", "WAREHOUSE_MANAGER"],
  "/forecasts": ["DISTRICT_ADMIN", "FACILITY_ADMIN"],
  "/risks": ["DISTRICT_ADMIN", "FACILITY_ADMIN", "WAREHOUSE_MANAGER"],
  "/expiry-rescue": ["DISTRICT_ADMIN", "FACILITY_ADMIN"],
  "/redistribution": ["DISTRICT_ADMIN", "FACILITY_ADMIN", "WAREHOUSE_MANAGER"],
  "/transfers": ["DISTRICT_ADMIN", "FACILITY_ADMIN", "WAREHOUSE_MANAGER"],
  "/map": ["DISTRICT_ADMIN", "FACILITY_ADMIN", "WAREHOUSE_MANAGER"],
  "/copilot": ["DISTRICT_ADMIN", "FACILITY_ADMIN", "HEALTHCARE_STAFF", "WAREHOUSE_MANAGER"],
  "/voice-reporting": ["HEALTHCARE_STAFF", "FACILITY_ADMIN", "DISTRICT_ADMIN"],
  "/register-digitisation": ["HEALTHCARE_STAFF", "FACILITY_ADMIN", "DISTRICT_ADMIN"],
  "/stress-simulator": ["DISTRICT_ADMIN"],
  "/reports": ["DISTRICT_ADMIN", "FACILITY_ADMIN", "WAREHOUSE_MANAGER"],
  "/notifications": ["DISTRICT_ADMIN", "FACILITY_ADMIN", "HEALTHCARE_STAFF", "WAREHOUSE_MANAGER"],
  "/audit-logs": ["DISTRICT_ADMIN"],
  "/users": ["DISTRICT_ADMIN"],
  "/settings": ["DISTRICT_ADMIN", "FACILITY_ADMIN", "HEALTHCARE_STAFF", "WAREHOUSE_MANAGER"],
};

export function canAccessRoute(role: UserRole | undefined | null, pathname: string): boolean {
  if (!role) return false;
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  if (!matchedRoute) return true;
  return ROUTE_PERMISSIONS[matchedRoute].includes(role);
}
