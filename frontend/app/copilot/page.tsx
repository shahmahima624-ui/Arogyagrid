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
} from "lucide-react";
import Link from "next/link";

interface CopilotResponse {
  answer: string;
  suggested_actions: string[];
  data_context_summary: string;
  model_used: string;
  as_of: string;
}


interface Message {
  sender: "user" | "copilot";
  text: string;
  suggested_actions?: string[];
  model_used?: string;
}

export default function CopilotPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "copilot",
      text: "Hello! I am AarogyaGrid AI Copilot. Ask me any question regarding stockout risks, excess expiry rescue candidates, or inter-facility medicine redistribution recommendations.",
      suggested_actions: [
        "Review CRITICAL stockout risks in Risk Engine (/risks)",
        "Check expiry rescue candidates (/expiry-rescue)",
      ],
    },
  ]);

  const quickQueries = [
    "What facilities have CRITICAL stockout risk within 3 days?",
    "How many excess insulin vials can be rescued from PHC Rampura?",
    "Give me an executive summary of current network resilience.",
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
      <main className="min-h-screen bg-slate-900 text-slate-100 pb-16">
        {/* Banner */}
        <div className="border-b border-slate-800 bg-slate-950/60 backdrop-blur px-4 sm:px-6 lg:px-8 py-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-purple-400 animate-ping" />
              <p className="text-xs font-bold uppercase tracking-widest text-purple-400">
                Phase 10 — Generative AI Network Copilot
              </p>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Bot className="h-7 w-7 text-purple-400" />
              AarogyaGrid AI Copilot
            </h1>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-8">
          {/* Quick Query Suggestions */}
          <div className="mb-6 bg-slate-800/40 p-4 rounded-2xl border border-slate-800 backdrop-blur">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              Suggested Network Queries
            </div>
            <div className="flex flex-wrap gap-2">
              {quickQueries.map((qq) => (
                <button
                  key={qq}
                  onClick={() => handleSend(qq)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-purple-950/80 border border-slate-700 hover:border-purple-600 text-xs font-medium text-slate-300 transition-all text-left"
                >
                  &quot;{qq}&quot;
                </button>

              ))}
            </div>
          </div>

          {/* Chat Messages Window */}
          <div className="space-y-4 mb-6 min-h-[400px] max-h-[600px] overflow-y-auto p-4 rounded-2xl border border-slate-800 bg-slate-950/50 backdrop-blur">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.sender === "copilot" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-xl rounded-2xl p-4 text-sm leading-relaxed ${
                    m.sender === "user"
                      ? "bg-emerald-600 text-white font-medium"
                      : "bg-slate-800 text-slate-200 border border-slate-700"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>

                  {m.suggested_actions && m.suggested_actions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/60 text-xs">
                      <span className="text-slate-400 font-bold block mb-1">Recommended Actions:</span>
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
                    <div className="mt-2 text-[10px] text-slate-400 font-mono">
                      Engine: {m.model_used}
                    </div>
                  )}
                </div>

                {m.sender === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-3 text-slate-400 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white animate-pulse">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-700 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-purple-400" />
                  Analyzing database context...
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-3 bg-slate-800/80 p-2 rounded-2xl border border-slate-700 shadow-lg"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask Copilot a question about medicine supply resilience..."
              className="flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center gap-1.5 shrink-0"
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
