"use client";

import React, { useState } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  Building2,
  Boxes,
  ShieldCheck,
  TrendingDown,
  Clock,
  ArrowRight,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Database,
} from "lucide-react";
import Link from "next/link";

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
      text: "Hello! I am AarogyaGrid AI Copilot. I analyze live database context across inventory, demand forecasts, stockout risks, and FEFO expiry candidates to answer supply chain questions.",
      suggested_actions: [
        "Review CRITICAL stockout risks in Risk Engine (/risks)",
        "Check expiry rescue candidates (/expiry-rescue)",
        "Approve pending inter-facility transfers (/transfers)",
      ],
    },
  ]);

  const masterQueries = [
    "Which facilities are critical this week?",
    "Which medicines are likely to expire?",
    "What transfers should I approve today?",
    "Can current district surplus solve all ORS shortages?",
    "Which facility has the highest medicine risk?",
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
      setMessages((prev) => [
        ...prev,
        {
          sender: "copilot",
          text: `Error connecting to Copilot service: ${err.message || "Unknown error"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-white text-slate-900 pb-16">
        {/* Banner */}
        <div className="border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-8 py-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-purple-400 animate-ping" />
              <p className="text-xs font-bold uppercase tracking-widest text-purple-400">
                Phase 11 — AI Supply Copilot & Factual Tool Retrieval
              </p>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <Bot className="h-7 w-7 text-purple-400" />
              AarogyaGrid AI Copilot
            </h1>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-8">
          {/* Master Prompt Example Query Chips */}
          <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200 backdrop-blur">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              Master Prompt Recommended Queries
            </div>
            <div className="flex flex-wrap gap-2">
              {masterQueries.map((qq) => (
                <button
                  key={qq}
                  onClick={() => handleSend(qq)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-purple-950/80 border border-slate-200 hover:border-purple-600 text-xs font-medium text-slate-700 transition-all text-left"
                >
                  &quot;{qq}&quot;
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="space-y-4 mb-6 min-h-[420px] max-h-[650px] overflow-y-auto p-4 rounded-2xl border border-slate-200 bg-slate-50/50 backdrop-blur">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.sender === "copilot" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-slate-900 shadow-xs">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-xl rounded-2xl p-4 text-sm leading-relaxed ${
                    m.sender === "user"
                      ? "bg-emerald-600 text-slate-900 font-medium"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {m.intent_detected && (
                    <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                      <Database className="h-3 w-3 text-purple-400" />
                      Intent: {m.intent_detected}
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">{m.text}</div>

                  {/* Factual Database Details Drawer */}
                  {m.retrieved_facts && Object.keys(m.retrieved_facts).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <button
                        onClick={() => setShowFactsIdx(showFactsIdx === idx ? null : idx)}
                        className="text-xs text-purple-300 hover:text-purple-200 font-mono font-bold flex items-center gap-1"
                      >
                        {showFactsIdx === idx ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {showFactsIdx === idx ? "Hide Retrieved DB Facts" : "View Factual DB Payload"}
                      </button>

                      {showFactsIdx === idx && (
                        <pre className="mt-2 p-3 rounded-xl bg-white border border-slate-200 text-[11px] text-emerald-400 font-mono overflow-x-auto max-h-48">
                          {JSON.stringify(m.retrieved_facts, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Suggested Actions */}
                  {m.suggested_actions && m.suggested_actions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs">
                      <span className="text-slate-500 font-bold block mb-1">Recommended Actions:</span>
                      <ul className="space-y-1">
                        {m.suggested_actions.map((act, i) => (
                          <li key={i} className="text-purple-300 flex items-center gap-1.5">
                            <ArrowRight className="h-3 w-3 text-purple-400 shrink-0" />
                            {act}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {m.model_used && (
                    <div className="mt-2 text-[10px] text-slate-500 font-mono">
                      Engine: {m.model_used}
                    </div>
                  )}
                </div>

                {m.sender === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-3 text-slate-500 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-slate-900 animate-pulse">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-slate-100 px-4 py-2.5 rounded-2xl border border-slate-200 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-purple-400" />
                  Detecting intent & querying database tools...
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-lg"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask Copilot a natural language supply question..."
              className="flex-1 bg-transparent px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-slate-900 font-bold text-xs transition-all flex items-center gap-1.5 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              Ask AI
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
