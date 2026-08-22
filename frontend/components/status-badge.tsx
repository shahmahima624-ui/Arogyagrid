"use client";

import React from "react";

export type StatusType =
  | "HEALTHY"
  | "AT_RISK"
  | "HIGH_RISK"
  | "CRITICAL"
  | "RECOMMENDED"
  | "PENDING"
  | "APPROVED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "REJECTED"
  | "CANCELLED"
  | "ACTIVE"
  | "INACTIVE"
  | string;

const statusStyles: Record<string, { label: string; bg: string; text: string; border: string }> = {
  // Risk Levels
  HEALTHY: { label: "Healthy", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  AT_RISK: { label: "At Risk", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  HIGH_RISK: { label: "High Risk", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  CRITICAL: { label: "Critical", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },

  // Transfer & Recommendation Lifecycle
  RECOMMENDED: { label: "Recommended", bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  PENDING: { label: "Pending", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  APPROVED: { label: "Approved", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  IN_TRANSIT: { label: "In Transit", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  RECEIVED: { label: "Received", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  REJECTED: { label: "Rejected", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  CANCELLED: { label: "Cancelled", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },

  // Facility & User Status
  ACTIVE: { label: "Active", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  INACTIVE: { label: "Inactive", bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200" },
};

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, label, size = "md" }: StatusBadgeProps) {
  const normalizedKey = (status || "").toString().toUpperCase();
  const config = statusStyles[normalizedKey] || {
    label: label || status || "Unknown",
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
  };

  const textLabel = label || config.label;
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-md border ${padding} ${config.bg} ${config.text} ${config.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.text.replace("text-", "bg-")}`} />
      {textLabel}
    </span>
  );
}
