"use client";

import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center space-y-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 mx-auto border border-rose-200">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900">Access Restricted</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your assigned role does not permit access to this module or operational action.
          </p>
        </div>
        <div className="pt-4 border-t border-slate-100">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Command Centre
          </Link>
        </div>
      </div>
    </div>
  );
}
