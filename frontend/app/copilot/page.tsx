"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PageHeader } from "../../components/page-header";
import { StatusBadge } from "../../components/status-badge";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  Database,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";

interface CopilotResponse {
  answer: string;
  intent_detected?: string;
  retrieved_facts?: Record<string, any>;
  suggested_actions: string[];
  data_context_summary: string;
  model_used: string;
  as_of: string;
}

interface Message {
  sender: "user" | "copilot";
  text: string;
  intent_detected?: string;
  retrieved_facts?: Record<string, any>;
  suggested_actions?: string[];
  model_used?: string;
}

export default function CopilotPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFactsIdx, setShowFactsIdx] = useState<number | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "copilot",
      text: "Hello! I am the AarogyaGrid Supply Intelligence Copilot. I analyze live database records across inventory balances, demand forecasts, stockout risks, and FEFO expiry candidates to provide grounded operational answers.",
      suggested_actions: [
        "Review CRITICAL stockout risks in Risk Engine (/risks)",
        "Check expiry rescue candidates (/expiry-rescue)",
        "Approve pending inter-facility transfers (/transfers)",
      ],
    },
  ]);

  const masterQueries = [
    "Which facilities require intervention today?",
    "Which medicines are most at risk of stockout?",
    "Which transfers are awaiting approval?",
    "Where can ORS shortages be resolved using district surplus?",
    "Which batches should be rescued before expiry?",
  ];

  const handleSend = async (qText?: string) => {
    const textToSend = qText || query;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { sender: "user", text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    if (!qText) setQuery("");
    setLoading(true);

    try {
      const res = await api<CopilotResponse>("/ai/copilot", {
        method: "POST",
        body: JSON.stringify({ query: textToSend }),
      });

      const copilotMsg: Message = {
        sender: "copilot",
        text: res.answer,
        intent_detected: res.intent_detected,
        retrieved_facts: res.retrieved_facts,
        suggested_actions: res.suggested_actions,
        model_used: res.model_used,
      };
      setMessages((prev) => [...prev, copilotMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        sender: "copilot",
        text: `Error connecting to Supply Copilot: ${err.message || "Unknown error"}.`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Supply Intelligence Copilot"
        subtitle="Natural language query engine grounded strictly in live district supply chain data and predictive models."
        breadcrumbs={[{ label: "AI Copilot" }]}
        badgeText="Gemini Grounded Intelligence"
      />

      {/* Suggested Quick Queries */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Suggested Operational Queries</span>
        <div className="flex flex-wrap gap-2">
          {masterQueries.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-teal-50 hover:text-teal-800 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4 min-h-[400px] flex flex-col justify-between">
        <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl text-xs space-y-2.5 ${
                m.sender === "user"
                  ? "bg-teal-600 text-white ml-auto max-w-xl shadow-2xs"
                  : "bg-slate-50 border border-slate-200 text-slate-800 mr-auto max-w-2xl"
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                <div className="flex items-center gap-2 font-bold">
                  {m.sender === "user" ? (
                    <span>You (Officer)</span>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 text-teal-600" />
                      <span>Supply Intelligence Copilot</span>
                    </>
                  )}
                </div>
                {m.model_used && (
                  <span className="text-[10px] opacity-75 font-mono">{m.model_used}</span>
                )}
              </div>

              <p className="leading-relaxed whitespace-pre-line">{m.text}</p>

              {/* Retrieved Facts Section */}
              {m.retrieved_facts && Object.keys(m.retrieved_facts).length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <button
                    onClick={() => setShowFactsIdx(showFactsIdx === idx ? null : idx)}
                    className="flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:underline"
                  >
                    <Database className="h-3.5 w-3.5" />
                    {showFactsIdx === idx ? "Hide Grounded Facts" : "Show Grounded System Facts"}
                    {showFactsIdx === idx ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {showFactsIdx === idx && (
                    <pre className="mt-2 p-3 rounded-lg bg-slate-900 text-teal-300 text-[11px] font-mono overflow-x-auto">
                      {JSON.stringify(m.retrieved_facts, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Suggested Actions */}
              {m.suggested_actions && m.suggested_actions.length > 0 && (
                <div className="pt-2 border-t border-slate-200/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Suggested Operational Actions</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.suggested_actions.map((act, aIdx) => (
                      <span key={aIdx} className="px-2.5 py-1 rounded bg-white text-slate-700 font-semibold border border-slate-200 text-[11px]">
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 animate-pulse flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-600 animate-spin" />
              <span>Analyzing live network records & forecasting models...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 pt-4 border-t border-slate-100"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask supply copilot about stockouts, expiry candidates, or transfers..."
            className="flex-1 h-10 px-4 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="h-10 px-4 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
