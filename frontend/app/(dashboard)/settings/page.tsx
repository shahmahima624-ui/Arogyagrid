"use client";

import React, { useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { StatusBadge } from "../../../components/status-badge";
import { Settings, ShieldCheck, Building2, Bell, Database, Check } from "lucide-react";
import { useAuth } from "../../../lib/auth-context";

export default function SettingsPage() {
  const { user } = useAuth();
  const [notifSaved, setNotifSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Account & System Settings"
        subtitle="Manage your profile preferences, district context, notification channels, and backend API connections."
        breadcrumbs={[{ label: "Settings" }]}
      />

      {/* User Profile Card */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-bold text-base">
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{user?.name || "Authenticated User"}</h3>
            <p className="text-xs text-slate-500">{user?.email || "user@aarogyagrid.org"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Assigned Role</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="h-4 w-4 text-teal-600" />
              {user?.role ? user.role.replace("_", " ") : "DISTRICT ADMIN"}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Jurisdiction Scope</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Building2 className="h-4 w-4 text-teal-600" />
              {user?.role === "DISTRICT_ADMIN" ? "Ahmedabad Rural District" : "Assigned Facility Scope"}
            </div>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <form onSubmit={handleSave} className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">Notification Alerts & Channels</h3>
          </div>
          {notifSaved && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <Check className="h-3.5 w-3.5" />
              Preferences Saved
            </span>
          )}
        </div>

        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
            <div>
              <p className="font-bold text-slate-900">Critical Stock-Out Alerts</p>
              <p className="text-slate-500">Receive instant push & SSE notifications when stockout is predicted &lt; 3 days.</p>
            </div>
            <input type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600 rounded" />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
            <div>
              <p className="font-bold text-slate-900">Expiry Rescue Opportunities</p>
              <p className="text-slate-500">Notify when batches have &lt; 60 days to expiry and rescueable surplus exists.</p>
            </div>
            <input type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600 rounded" />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
            <div>
              <p className="font-bold text-slate-900">Transfer Lifecycle Events</p>
              <p className="text-slate-500">Receive status updates when transfers are approved, dispatched, or received.</p>
            </div>
            <input type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600 rounded" />
          </label>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors shadow-2xs"
          >
            Save Preferences
          </button>
        </div>
      </form>

      {/* System Architecture Information */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3 text-xs">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Database className="h-5 w-5 text-teal-600" />
          <h3 className="text-sm font-bold text-slate-900">API & Database Infrastructure</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Backend Service</span>
            <p className="font-mono text-slate-800 font-semibold mt-0.5">FastAPI Python 3.14</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Database Layer</span>
            <p className="font-mono text-slate-800 font-semibold mt-0.5">Supabase PostgreSQL</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase">AI Copilot Model</span>
            <p className="font-mono text-slate-800 font-semibold mt-0.5">Google Gemini 3.6</p>
          </div>
        </div>
      </div>
    </div>
  );
}
