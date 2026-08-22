"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  badgeText?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  badgeText,
  primaryAction,
  secondaryAction,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 pb-5 mb-6 border-b border-slate-200">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Link href="/dashboard" className="hover:text-slate-800 transition-colors">
            District Overview
          </Link>
          {breadcrumbs.map((b, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              {b.href ? (
                <Link href={b.href} className="hover:text-slate-800 transition-colors">
                  {b.label}
                </Link>
              ) : (
                <span className="text-slate-800 font-semibold">{b.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Main Title Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {badgeText && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                {badgeText}
              </span>
            )}
          </div>
          {subtitle && <p className="text-sm text-slate-500 max-w-3xl leading-relaxed">{subtitle}</p>}
        </div>

        {/* Action Buttons */}
        {(primaryAction || secondaryAction) && (
          <div className="flex items-center gap-2.5 shrink-0">
            {secondaryAction}
            {primaryAction}
          </div>
        )}
      </div>
    </div>
  );
}
