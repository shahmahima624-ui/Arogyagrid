"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { setAuthToken, api } from "./api";

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

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  supabaseUser: any | null;
  unprovisionedError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unprovisionedError, setUnprovisionedError] = useState<string | null>(null);

  // Fetch backend application user profile via GET /api/users/me
  async function fetchBackendProfile(accessToken: string): Promise<UserProfile | null> {
    setAuthToken(accessToken);
    try {
      const profile = await api<UserProfile>("/users/me");
      setUnprovisionedError(null);
      return profile;
    } catch (err: any) {
      console.warn("Backend user profile lookup failed:", err.message);
      if (err.message && (err.message.includes("not provisioned") || err.message.includes("403"))) {
        setUnprovisionedError("Account not provisioned in district database. Contact Administrator.");
      }
      setAuthToken(null);
      return null;
    }
  }

  async function syncSession(session: any) {
    setIsLoading(true);
    if (session?.user && session?.access_token) {
      setSupabaseUser(session.user);
      const profile = await fetchBackendProfile(session.access_token);
      if (profile) {
        setUser(profile);
      } else {
        setUser(null);
      }
    } else {
      setUser(null);
      setSupabaseUser(null);
      setAuthToken(null);
      setUnprovisionedError(null);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncSession(session);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    setIsLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setIsLoading(false);
      return { error: error.message };
    }
    if (data.session) {
      await syncSession(data.session);
    }
    setIsLoading(false);
    return { error: null };
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
        data: { name },
      },
    });
    setIsLoading(false);
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
    setSupabaseUser(null);
    setAuthToken(null);
    setUnprovisionedError(null);
    setIsLoading(false);
  };

  const refreshProfile = async () => {
    const sessionRes = await supabase.auth.getSession();
    if (sessionRes.data.session) {
      await syncSession(sessionRes.data.session);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        supabaseUser,
        unprovisionedError,
        signIn,
        signUp,
        signOut,
        refreshProfile,
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
