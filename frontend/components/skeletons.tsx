"use client";

import React from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs animate-pulse">
      <div className="h-11 bg-slate-100/80 border-b border-slate-200" />
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4 flex items-center gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 bg-slate-200/70 rounded"
                style={{ width: `${Math.max(40, (c + 1) * 15)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs animate-pulse space-y-3">
          <div className="h-4 w-1/2 bg-slate-200 rounded" />
          <div className="h-8 w-3/4 bg-slate-200/80 rounded" />
          <div className="h-3 w-1/3 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title = "No data available",
  description = "No records match your criteria or none have been recorded yet.",
  icon: Icon = Inbox,
  action,
}: {
  title?: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 my-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mt-1 mb-4 leading-relaxed">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Failed to load supply data",
  description = "An error occurred while fetching information from the network server.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-rose-200 bg-rose-50/30 text-rose-900 my-4">
      <AlertCircle className="h-8 w-8 text-rose-600 mb-2" />
      <h3 className="text-base font-semibold text-rose-900">{title}</h3>
      <p className="text-sm text-rose-700 max-w-md mt-1 mb-4">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition-colors shadow-2xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Connection
        </button>
      )}
    </div>
  );
}
