"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getAuthToken, setAuthToken } from "./api";

export type UserRole =
  | "DISTRICT_ADMIN"
  | "FACILITY_ADMIN"
  | "HEALTHCARE_STAFF"
  | "WAREHOUSE_MANAGER";

export interface UserProfile {
  id: string;
  firebase_uid: string;
  name: string;
  email: string;
  role: UserRole;
  district_id?: string | null;
  facility_id?: string | null;
  warehouse_id?: string | null;
  status: string;
}

export interface MockUserPreset {
  token: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  facilityName: string;
  description: string;
}

export const MOCK_USERS: MockUserPreset[] = [
  {
    token: "mock-district-admin",
    name: "Dr. Amit Patel",
    email: "district.admin@aarogyagrid.org",
    role: "DISTRICT_ADMIN",
    roleLabel: "District Health Officer",
    facilityName: "District Command (All Facilities)",
    description: "Full district-wide visibility, risk analytics, and stock transfer approvals.",
  },
  {
    token: "mock-facility-admin-sanand",
    name: "Dr. Priya Shah",
    email: "sanand.admin@aarogyagrid.org",
    role: "FACILITY_ADMIN",
    roleLabel: "Medical Officer In-Charge",
    facilityName: "PHC Sanand",
    description: "Manages PHC Sanand inventory, views local stockouts, and requests transfers.",
  },
  {
    token: "mock-staff-sanand",
    name: "Staff Nurse Anita",
    email: "sanand.staff@aarogyagrid.org",
    role: "HEALTHCARE_STAFF",
    roleLabel: "Frontline Healthcare Staff",
    facilityName: "PHC Sanand",
    description: "Records daily medicine consumption and patient dispensing logs.",
  },
  {
    token: "mock-warehouse-manager",
    name: "Ramesh Kumar",
    email: "warehouse.manager@aarogyagrid.org",
    role: "WAREHOUSE_MANAGER",
    roleLabel: "Warehouse Manager",
    facilityName: "Ahmedabad District Drug Warehouse",
    description: "Dispatches replenishment orders and oversees central stock reserves.",
  },
];

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  loginAsMock: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (currentToken: string) => {
    try {
      const profile = await api<UserProfile>("/users/me");
      setUser(profile);
    } catch {
      // Fallback synthetic user based on preset if backend is launching or offline
      const mock = MOCK_USERS.find((m) => m.token === currentToken);
      if (mock) {
        setUser({
          id: "mock-user-id",
          firebase_uid: mock.token,
          name: mock.name,
          email: mock.email,
          role: mock.role,
          status: "ACTIVE",
        });
      } else {
        setUser(null);
      }
    }
  };

  useEffect(() => {
    const savedToken = getAuthToken();
    if (savedToken) {
      setTokenState(savedToken);
      fetchProfile(savedToken).finally(() => setIsLoading(false));
    } else {
      // Default to district admin for seamless developer experience
      const defaultToken = "mock-district-admin";
      setAuthToken(defaultToken);
      setTokenState(defaultToken);
      fetchProfile(defaultToken).finally(() => setIsLoading(false));
    }
  }, []);

  const loginAsMock = async (newToken: string) => {
    setIsLoading(true);
    setAuthToken(newToken);
    setTokenState(newToken);
    await fetchProfile(newToken);
    setIsLoading(false);
  };

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (token) {
      await fetchProfile(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        loginAsMock,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
