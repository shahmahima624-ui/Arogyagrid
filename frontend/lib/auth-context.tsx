"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { setAuthToken } from "./api";

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

// Default admin user — used when no session is active (all permissions open)
const DEFAULT_USER: UserProfile = {
  id: "default-admin",
  firebase_uid: "anon-default",
  name: "District Admin",
  email: "admin@aarogyagrid.org",
  role: "DISTRICT_ADMIN",
  status: "ACTIVE",
};

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  supabaseUser: any | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(DEFAULT_USER);
  const [supabaseUser, setSupabaseUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Build a UserProfile from Supabase session data
  function buildUserProfile(sbUser: any): UserProfile {
    return {
      id: sbUser.id,
      firebase_uid: sbUser.id,
      name:
        sbUser.user_metadata?.name ||
        sbUser.email?.split("@")[0] ||
        "AarogyaGrid User",
      email: sbUser.email || "user@aarogyagrid.org",
      // All Supabase users get DISTRICT_ADMIN by default (all permissions)
      role:
        (sbUser.user_metadata?.role as UserRole) || "DISTRICT_ADMIN",
      status: "ACTIVE",
    };
  }

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const profile = buildUserProfile(session.user);
        setUser(profile);
        setSupabaseUser(session.user);
        // Store Supabase access token so API calls carry auth header
        setAuthToken(session.access_token);
      } else {
        // No session — use default admin profile so all features are accessible
        setUser(DEFAULT_USER);
        setAuthToken("mock-district-admin");
      }
      setIsLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const profile = buildUserProfile(session.user);
        setUser(profile);
        setSupabaseUser(session.user);
        setAuthToken(session.access_token);
      } else {
        setUser(DEFAULT_USER);
        setSupabaseUser(null);
        setAuthToken("mock-district-admin");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    return { error: error?.message ?? null };
  };

  const signUp = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ error: string | null }> => {
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: "DISTRICT_ADMIN" },
      },
    });
    setIsLoading(false);
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(DEFAULT_USER);
    setSupabaseUser(null);
    setAuthToken("mock-district-admin");
  };

  // Allow quick role switching without re-auth (for demo/testing)
  const switchRole = (role: UserRole) => {
    if (user) {
      setUser({ ...user, role });
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, supabaseUser, signIn, signUp, signOut, switchRole }}
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
