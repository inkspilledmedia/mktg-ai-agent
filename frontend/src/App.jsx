import React, { useState, useEffect } from "react";
import axios from "axios";
import InputPanel from "./components/InputPanel";
import Result from "./components/Result";
import {
  Sparkles, AlertCircle, RotateCcw, History, X, Clock, ChevronRight, Loader2,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8001";

const STEPS = [
  "Uploading & preparing...",
  "Transcribing with Whisper...",
  "Chain 1: Cleaning transcript...",
  "Chain 2: Building marketing strategy...",
  "Chain 3: Crafting design direction...",
  "Chain 4: Generating follow-ups...",
  "Assembling final report...",
];

function ProcessingOverlay({ step }) {
  return (
    <div className="w-full max-w-md mx-auto text-center py-16 space-y-8 animate-fade">
      <div className="relative mx-auto w-24 h-24">
        <div className="absolute inset-0 rounded-full bg-rose-500/15 animate-ping" />
        <div className="absolute inset-3 rounded-full bg-rose-500/10 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-rose-400" />
        </div>
      </div>
      <div className="space-y-2">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm transition-all duration-500 ${
              done ? "text-emerald-400/70" : active ? "text-zinc-100 bg-zinc-800/50" : "text-zinc-700"
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                done ? "bg-emerald-500/15 text-emerald-400" : active ? "bg-rose-500/15 text-rose-400" : "bg-zinc-800 text-zinc-700"
              }`}>{done ? "✓" : i + 1}</span>
              {s}
              {active && <Loader2 size={11} className="animate-spin ml-auto text-rose-400/50" />}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-600">
        Running 4 chained analysis passes — this takes 3-10 minutes depending on file size
      </p>
    </div>
  );
}

export default function App() {
  const [result, setResult] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState([]);

  // Load history
  useEffect(() => {
    axios.get(`${API}/sessions`).then((r) => setSessions(r.data)).catch(() => {});
  }, [result]);

  const handleSubmit = async (input) => {
    setError("");
    setResult(null);
    setSessionId(null);
    setProcessing(true);
    setStep(0);

    const stepInterval = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 12000);

    try {
      let response;

      if (input.mode === "audio") {
        const formData = new FormData();
        formData.append("file", input.file);
        formData.append("client_type", input.clientType || "company");
        formData.append("company_name", input.companyName);
        formData.append("niche", input.niche);
        formData.append("target_audience", input.targetAudience);
        formData.append("website_url", input.websiteUrl);
        formData.append("instagram_url", input.instagramUrl);
        formData.append("extra_context", input.extraContext);

        response = await axios.post(`${API}/process-audio/`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 1800000,
        });
      } else {
        response = await axios.post(`${API}/process-text/`, {
          transcript: input.text,
          client_type: input.clientType || "company",
          company_name: input.companyName,
          niche: input.niche,
          target_audience: input.targetAudience,
          website_url: input.websiteUrl,
          instagram_url: input.instagramUrl,
          extra_context: input.extraContext,
          llm_model: "llama3",
        }, { timeout: 1800000 });
      }

      clearInterval(stepInterval);
      setStep(STEPS.length);
      setResult(response.data);
      setSessionId(response.data.session_id);
    } catch (err) {
      clearInterval(stepInterval);
      setError(err.response?.data?.detail || err.message || "Something went wrong.");
    } finally {
      setProcessing(false);
    }
  };

  const loadSession = async (id) => {
    try {
      const { data } = await axios.get(`${API}/sessions/${id}`);
      setResult(data.result);
      setSessionId(data.id);
      setShowHistory(false);
    } catch (e) {
      setError("Could not load session");
    }
  };

  const handleReset = () => {
    setResult(null);
    setSessionId(null);
    setError("");
    setStep(0);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-200 font-body flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#09090b]/80 border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Sparkles size={17} className="text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl text-zinc-100 italic leading-none">Mktg.AI</h1>
              <p className="text-[9px] text-zinc-600 tracking-[0.2em] uppercase mt-0.5">Marketing Intelligence Agent v2</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-500 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all">
              <History size={14} />
              <span className="hidden sm:inline">History</span>
              {sessions.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] flex items-center justify-center">{sessions.length}</span>
              )}
            </button>
            {result && (
              <button onClick={handleReset}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-500 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all">
                <RotateCcw size={14} /> New
              </button>
            )}
          </div>
        </div>
      </header>

      {/* History sidebar */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowHistory(false)} />
          <div className="relative ml-auto w-80 bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto animate-fade">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="font-display text-lg text-zinc-100 italic">History</h2>
              <button onClick={() => setShowHistory(false)} className="text-zinc-500 hover:text-zinc-200"><X size={18} /></button>
            </div>
            {sessions.length === 0 ? (
              <p className="p-5 text-sm text-zinc-600">No sessions yet. Run your first analysis!</p>
            ) : (
              <div className="p-3 space-y-2">
                {sessions.map((s) => (
                  <button key={s.id} onClick={() => loadSession(s.id)}
                    className="w-full text-left p-3 rounded-xl hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-zinc-200">{s.company_name || "Untitled"}</span>
                      <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400" />
                    </div>
                    {s.niche && <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{s.niche}</span>}
                    <p className="text-xs text-zinc-600 mt-1.5 line-clamp-2">{s.summary_preview}</p>
                    <p className="text-[10px] text-zinc-700 mt-1 flex items-center gap-1"><Clock size={9} />{s.created_at}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        {!result && !processing && (
          <div className="animate-fade space-y-10">
            <div className="text-center max-w-xl mx-auto">
              <h2 className="font-display text-4xl md:text-5xl text-zinc-100 italic leading-tight">
                Audio → Marketing<br /><span className="text-rose-400">Intelligence</span>
              </h2>
              <p className="text-zinc-500 text-lg leading-relaxed mt-4">
                Upload audio or paste text. Add company context for sharper results.
                Get back structured strategy, content concepts, design specs, and visual inspiration.
              </p>
            </div>
            <InputPanel onSubmit={handleSubmit} isProcessing={processing} />
            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {["4-Chain Analysis", "Content Concepts", "Color Palettes", "Typography Specs", "Template Previews", "Session History", "100% Local"].map((f) => (
                <span key={f} className="px-3 py-1 rounded-full text-xs text-zinc-600 bg-zinc-900 border border-zinc-800">{f}</span>
              ))}
            </div>
          </div>
        )}

        {processing && <ProcessingOverlay step={step} />}

        {error && (
          <div className="max-w-lg mx-auto animate-fade">
            <div className="rounded-2xl bg-red-500/5 border border-red-500/15 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-300">Processing Failed</h3>
                  <p className="text-sm text-red-400/70 mt-1">{error}</p>
                </div>
              </div>
              <button onClick={handleReset}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors">
                Try Again
              </button>
            </div>
          </div>
        )}

        {result && <Result data={result} sessionId={sessionId} />}
      </main>

      <footer className="border-t border-zinc-800/50 py-5 text-center">
        <p className="text-xs text-zinc-700">Mktg.AI v2 — 4-Chain Analysis · Whisper + Ollama · 100% Local · No data leaves your machine</p>
      </footer>
    </div>
  );
}
