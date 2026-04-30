import React, { useState } from "react";
import {
  FileText, Sparkles, CheckSquare, Lightbulb, Palette, Zap, HelpCircle,
  Search, ExternalLink, Copy, Check, Clock, Globe, RefreshCw, ChevronDown,
  ChevronUp, Eye, Users, Instagram, MessageCircle, Layout, Type as TypeIcon,
  Download, Clipboard,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8001";

/* ─── Safe text helper — converts any value to a displayable string ── */
function toText(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return val.map(toText).join(", ");
  if (typeof val === "object") {
    return Object.entries(val)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(" | ");
  }
  return String(val);
}

/* ─── Normalize a list: ensure every item is a string ──────────── */
function normalizeList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    if (typeof item === "string") return item;
    if (typeof item === "object" && item !== null) {
      // Try to find the most useful text field
      const textKeys = Object.keys(item);
      if (textKeys.length === 0) return "";
      // Join all values as a readable string
      return Object.entries(item)
        .filter(([_, v]) => v && typeof v !== "object")
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ");
    }
    return String(item);
  }).filter(Boolean);
}

/* ─── Copy button ────────────────────────────────────────────────── */
function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  const copyText = toText(text);
  return (
    <button onClick={() => { navigator.clipboard.writeText(copyText); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className="ml-2 p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all shrink-0 opacity-0 group-hover:opacity-100"
      title="Copy">
      {ok ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

/* ─── Section card ───────────────────────────────────────────────── */
function Section({ icon: Icon, title, accent = "rose", delay = 0, children, collapsible = false, actions }) {
  const [open, setOpen] = useState(true);
  const accentMap = {
    rose: "border-rose-500/10 text-rose-400", amber: "border-amber-500/10 text-amber-400",
    emerald: "border-emerald-500/10 text-emerald-400", sky: "border-sky-500/10 text-sky-400",
    violet: "border-violet-500/10 text-violet-400", orange: "border-orange-500/10 text-orange-400",
    pink: "border-pink-500/10 text-pink-400", teal: "border-teal-500/10 text-teal-400",
    indigo: "border-indigo-500/10 text-indigo-400", cyan: "border-cyan-500/10 text-cyan-400",
  };
  return (
    <div className={`animate-slide rounded-2xl border bg-zinc-900/60 ${accentMap[accent]?.split(" ")[0] || "border-zinc-800"}`}
      style={{ animationDelay: `${delay}ms` }}>
      <div className={`flex items-center justify-between px-5 py-4 ${collapsible ? "cursor-pointer" : ""}`}
        onClick={() => collapsible && setOpen(!open)}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-zinc-800 ${accentMap[accent]?.split(" ")[1] || "text-zinc-400"}`}>
            <Icon size={17} />
          </div>
          <h3 className="font-display text-lg text-zinc-100 italic">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {collapsible && <span className="text-zinc-600">{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>}
        </div>
      </div>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

/* ─── List item ──────────────────────────────────────────────────── */
function ListItem({ text, index }) {
  const displayText = toText(text);
  return (
    <div className="flex items-start gap-3 py-2.5 group border-b border-zinc-800/50 last:border-0">
      <span className="shrink-0 w-6 h-6 rounded-lg bg-zinc-800 text-zinc-500 text-[11px] font-mono flex items-center justify-center mt-0.5">
        {index + 1}
      </span>
      <p className="text-zinc-300 text-sm leading-relaxed flex-1">{displayText}</p>
      <CopyBtn text={displayText} />
    </div>
  );
}

/* ─── Content Concept Card ───────────────────────────────────────── */
function ContentCard({ concept, index }) {
  const [expanded, setExpanded] = useState(false);
  // Safely convert all fields
  const c = {};
  for (const [k, v] of Object.entries(concept || {})) {
    c[k] = toText(v);
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-800/30 overflow-hidden animate-slide"
      style={{ animationDelay: `${300 + index * 60}ms` }}>
      <div className="px-5 py-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/15">
                {c.post_type || "Post"}
              </span>
              {c.best_platform && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                  {c.best_platform}
                </span>
              )}
              {c.content_format && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                  {c.content_format}
                </span>
              )}
            </div>
            <h4 className="text-zinc-100 font-semibold text-[15px]">{c.title || "Untitled"}</h4>
            {c.subtitle && <p className="text-zinc-400 text-sm mt-0.5">{c.subtitle}</p>}
          </div>
          <span className="text-zinc-600 mt-1">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 pt-0 space-y-3 border-t border-zinc-800/50">
          {c.hook_line && (
            <div className="group flex items-start gap-2">
              <Zap size={13} className="text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-0.5">Hook Line</p>
                <p className="text-zinc-200 text-sm font-medium italic">"{c.hook_line}"</p>
              </div>
              <CopyBtn text={c.hook_line} />
            </div>
          )}
          {c.caption && (
            <div className="group flex items-start gap-2">
              <MessageCircle size={13} className="text-sky-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-0.5">Caption</p>
                <p className="text-zinc-300 text-sm leading-relaxed">{c.caption}</p>
              </div>
              <CopyBtn text={c.caption} />
            </div>
          )}
          {c.cta && (
            <div className="group flex items-start gap-2">
              <Zap size={13} className="text-emerald-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-0.5">Call to Action</p>
                <p className="text-zinc-200 text-sm font-semibold">{c.cta}</p>
              </div>
              <CopyBtn text={c.cta} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Color Palette Display ──────────────────────────────────────── */
function ColorPalette({ palette }) {
  if (!palette || typeof palette !== "object") return null;
  const entries = Object.entries(palette).filter(([_, v]) => v && typeof v === "object" && v.hex);
  if (!entries.length) return null;

  return (
    <div className="grid grid-cols-5 gap-3 mb-4">
      {entries.map(([key, val]) => (
        <div key={key} className="group text-center">
          <div className="w-full aspect-square rounded-xl border border-zinc-700/50 mb-2 relative overflow-hidden cursor-pointer"
            style={{ backgroundColor: val.hex }}
            onClick={() => navigator.clipboard.writeText(val.hex)}>
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-mono">{val.hex}</span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-400 font-medium capitalize">{key}</p>
          <p className="text-[10px] text-zinc-600 font-mono">{val.hex}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Typography Display ─────────────────────────────────────────── */
function TypographyDisplay({ typo }) {
  if (!typo || typeof typo !== "object") return null;
  const entries = Object.entries(typo).filter(([_, v]) => v && typeof v === "object" && v.name);

  return (
    <div className="space-y-3 mb-4">
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center gap-4 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
            <TypeIcon size={16} />
          </div>
          <div className="flex-1">
            <p className="text-zinc-200 text-sm font-semibold">{val.name}</p>
            <p className="text-zinc-500 text-xs capitalize">{key.replace("_", " ")} · {val.weight} · {val.style}</p>
          </div>
          <span className="text-[10px] text-zinc-600 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">{val.source}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Inspiration Panel (Freepik + Pinterest iframes) ────────────── */
function InspirationPanel({ queries }) {
  const [activePreview, setActivePreview] = useState(null);

  if (!queries?.length) return null;

  return (
    <Section icon={Eye} title="Design Inspiration" accent="violet" delay={600}>
      {/* Query tags */}
      <div className="flex flex-wrap gap-2 mb-5">
        {queries.map((q, i) => (
          <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-300 border border-violet-500/15">
            <Search size={10} className="inline mr-1.5 -mt-0.5" />{q}
          </span>
        ))}
      </div>

      {/* Preview tabs */}
      <div className="space-y-4 mb-6">
        <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
          <Layout size={14} /> Template Previews
        </h4>
        <div className="flex gap-2 flex-wrap">
          {queries.slice(0, 4).map((q, i) => (
            <button key={i} onClick={() => setActivePreview(activePreview === i ? null : i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePreview === i
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200"
              }`}>
              {q.length > 30 ? q.slice(0, 30) + "..." : q}
            </button>
          ))}
        </div>

        {activePreview !== null && queries[activePreview] && (
          <div className="space-y-3 animate-fade">
            {/* Freepik Preview */}
            <div className="preview-frame">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 border-b border-zinc-700/50">
                <span className="text-xs text-zinc-400 font-medium">Freepik Templates</span>
                <a href={`https://www.freepik.com/search?query=${encodeURIComponent(queries[activePreview])}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                  Open full site <ExternalLink size={10} />
                </a>
              </div>
              <iframe
                src={`https://www.freepik.com/search?query=${encodeURIComponent(queries[activePreview])}`}
                className="w-full h-[400px] border-0"
                title="Freepik Preview"
                sandbox="allow-scripts allow-same-origin"
                loading="lazy"
              />
            </div>

            {/* Pinterest Preview */}
            <div className="preview-frame">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 border-b border-zinc-700/50">
                <span className="text-xs text-zinc-400 font-medium">Pinterest Ideas</span>
                <a href={`https://pinterest.com/search/pins/?q=${encodeURIComponent(queries[activePreview])}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1">
                  Open full site <ExternalLink size={10} />
                </a>
              </div>
              <iframe
                src={`https://pinterest.com/search/pins/?q=${encodeURIComponent(queries[activePreview])}`}
                className="w-full h-[400px] border-0"
                title="Pinterest Preview"
                sandbox="allow-scripts allow-same-origin"
                loading="lazy"
              />
            </div>
          </div>
        )}
      </div>

      {/* Quick-link buttons per query */}
      <div className="space-y-3">
        {queries.map((q, i) => (
          <div key={i} className="rounded-xl bg-zinc-800/30 border border-zinc-800 p-4">
            <p className="text-sm text-zinc-300 font-medium mb-3 truncate">{q}</p>
            <div className="flex flex-wrap gap-2">
              <a href={`https://www.freepik.com/search?query=${encodeURIComponent(q)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 hover:bg-emerald-500/20 transition-colors">
                <ExternalLink size={10} /> Freepik Templates
              </a>
              <a href={`https://www.canva.com/templates/?query=${encodeURIComponent(q)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/10 text-sky-300 border border-sky-500/15 hover:bg-sky-500/20 transition-colors">
                <ExternalLink size={10} /> Open in Canva
              </a>
              <a href={`https://pinterest.com/search/pins/?q=${encodeURIComponent(q)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/15 hover:bg-rose-500/20 transition-colors">
                <ExternalLink size={10} /> Pinterest
              </a>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ─── Follow-up Questions ────────────────────────────────────────── */
function FollowUpQuestions({ questions, sessionId, onRegenerate }) {
  const [answers, setAnswers] = useState({});
  const [customInputs, setCustomInputs] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!questions?.length) return null;

  const handleSelect = (question, option) => {
    setAnswers((prev) => ({ ...prev, [question]: option }));
  };

  const handleCustomInput = (question, value) => {
    setCustomInputs((prev) => ({ ...prev, [question]: value }));
  };

  const handleUseCustom = (question) => {
    const val = customInputs[question]?.trim();
    if (val) {
      setAnswers((prev) => ({ ...prev, [question]: val }));
      setCustomInputs((prev) => ({ ...prev, [question]: "" }));
    }
  };

  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;

  const handleSubmitAnswers = async () => {
    if (answeredCount === 0 || !sessionId) return;
    setSubmitting(true);

    const extraContext = Object.entries(answers)
      .map(([q, a]) => `Q: ${q}\nA: ${a}`)
      .join("\n\n");

    let success = false;
    try {
      // Re-run both content and design with the new context
      const r1 = await fetch(`${API}/regenerate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, section: "content", extra_context: extraContext }),
      });
      const r2 = await fetch(`${API}/regenerate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, section: "design", extra_context: extraContext }),
      });
      success = r1.ok || r2.ok; // At least one succeeded
      if (success) {
        setSubmitted(true);
        if (onRegenerate) onRegenerate();
      }
    } catch (e) {
      console.error("Follow-up submission failed:", e);
    }
    setSubmitting(false);
  };

  return (
    <Section icon={MessageCircle} title="Follow-up Questions" accent="teal" delay={650}>
      <p className="text-sm text-zinc-500 mb-1">Answer these to refine the strategy further.</p>
      <p className="text-xs text-zinc-600 mb-4">
        {answeredCount}/{totalCount} answered — click an option or type your own answer
      </p>

      {submitted && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
          <Check size={14} /> Answers submitted! Sections are being re-generated with your context.
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q, i) => {
          const qText = toText(q.question || q);
          const whyText = toText(q.why);
          const isAnswered = answers[qText] !== undefined;
          return (
            <div key={i} className={`rounded-xl border p-4 transition-all ${
              isAnswered ? "bg-teal-500/5 border-teal-500/20" : "bg-zinc-800/30 border-zinc-800"
            }`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm text-zinc-200 font-medium">{qText}</p>
                {isAnswered && (
                  <span className="shrink-0 w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center">
                    <Check size={11} />
                  </span>
                )}
              </div>
              {whyText && <p className="text-xs text-zinc-500 mb-3">{whyText}</p>}

              {/* Selected answer display */}
              {isAnswered && (
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Your answer:</span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-500/20 text-teal-200 border border-teal-500/25">
                    {toText(answers[qText])}
                  </span>
                  <button onClick={() => setAnswers((prev) => { const n = {...prev}; delete n[qText]; return n; })}
                    className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                    Change
                  </button>
                </div>
              )}

              {/* Option buttons */}
              {!isAnswered && q.options?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {q.options.map((opt, oi) => (
                    <button key={oi}
                      onClick={() => handleSelect(qText, toText(opt))}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-500/10 text-teal-300 border border-teal-500/15 hover:bg-teal-500/25 hover:border-teal-500/30 transition-all active:scale-95">
                      {toText(opt)}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom answer input */}
              {!isAnswered && (
                <div className="flex gap-2">
                  <input
                    value={customInputs[qText] || ""}
                    onChange={(e) => handleCustomInput(qText, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUseCustom(qText)}
                    placeholder="Type your own answer..."
                    className="flex-1 rounded-lg bg-zinc-800/50 border border-zinc-700/50 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                  />
                  {customInputs[qText]?.trim() && (
                    <button onClick={() => handleUseCustom(qText)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors">
                      Use
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit button */}
      {answeredCount > 0 && !submitted && (
        <button
          onClick={handleSubmitAnswers}
          disabled={submitting}
          className={`mt-5 w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            submitting
              ? "bg-teal-500/20 text-teal-300/50 cursor-wait"
              : "bg-teal-500 hover:bg-teal-600 text-white shadow-lg shadow-teal-500/20 active:scale-[0.98]"
          }`}>
          {submitting ? (
            <>
              <RefreshCw size={14} className="animate-spin-slow" />
              Re-analyzing with your answers...
            </>
          ) : (
            <>
              <Zap size={14} />
              Re-analyze with {answeredCount} answer{answeredCount > 1 ? "s" : ""} ({answeredCount}/{totalCount})
            </>
          )}
        </button>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  MAIN RESULT COMPONENT                                           */
/* ═══════════════════════════════════════════════════════════════════ */
export default function Result({ data, sessionId }) {
  const [regenerating, setRegenerating] = useState(null);
  const [localData, setLocalData] = useState(data);
  const d = localData;

  const handleRegenerate = async (section) => {
    if (regenerating) return;
    setRegenerating(section);
    try {
      const resp = await fetch(`${API}/regenerate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, section }),
      });
      const newData = await resp.json();

      // Check if the API returned an error
      if (!resp.ok || newData.detail) {
        console.error("Regenerate failed:", newData.detail || resp.statusText);
        setRegenerating(null);
        return;
      }

      if (section === "design") {
        setLocalData((prev) => ({
          ...prev,
          design_direction: newData.design_direction || prev.design_direction,
          color_palette: newData.color_palette || prev.color_palette,
          typography: newData.typography || prev.typography,
          visual_style: newData.visual_style || prev.visual_style,
          design_search_queries: newData.design_search_queries || prev.design_search_queries,
          reference_accounts: newData.reference_accounts || prev.reference_accounts,
        }));
      } else if (section === "content") {
        setLocalData((prev) => ({
          ...prev,
          tasks: newData.tasks || prev.tasks,
          marketing_ideas: newData.marketing_ideas || prev.marketing_ideas,
          content_concepts: newData.content_concepts || prev.content_concepts,
        }));
      }
    } catch (e) {
      console.error("Regeneration failed:", e);
    }
    setRegenerating(null);
  };

  const handleCopyAll = () => {
    const text = JSON.stringify(d, null, 2);
    navigator.clipboard.writeText(text);
  };

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mktg-ai-${sessionId || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const meta = d.metadata || {};
  const regenBtn = (section) => (
    <button
      onClick={(e) => { e.stopPropagation(); handleRegenerate(section); }}
      disabled={!!regenerating}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
        regenerating === section
          ? "bg-zinc-800 text-zinc-500"
          : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
      }`}>
      <RefreshCw size={11} className={regenerating === section ? "animate-spin-slow" : ""} />
      {regenerating === section ? "Regenerating..." : "Regenerate"}
    </button>
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 pb-20">
      {/* Export bar */}
      <div className="animate-fade flex items-center justify-between px-5 py-3 rounded-xl bg-zinc-900 border border-zinc-800">
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
          {meta.file_name && <span className="flex items-center gap-1.5"><FileText size={11} />{meta.file_name}</span>}
          {meta.processing_time_seconds && <span className="flex items-center gap-1.5"><Clock size={11} />{meta.processing_time_seconds}s</span>}
          {meta.language && <span className="flex items-center gap-1.5"><Globe size={11} />{meta.language}</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={handleCopyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50 transition-colors">
            <Clipboard size={12} /> Copy All
          </button>
          <button onClick={handleDownloadJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50 transition-colors">
            <Download size={12} /> Export JSON
          </button>
        </div>
      </div>

      {/* Transcript */}
      <Section icon={FileText} title="Transcript" accent="rose" delay={50} collapsible>
        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap bg-zinc-800/30 rounded-xl p-4 max-h-60 overflow-y-auto">
          {toText(d.clean_transcript) || "—"}
        </div>
      </Section>

      {/* Summary */}
      <Section icon={Sparkles} title="Summary" accent="amber" delay={100}>
        {normalizeList(d.summary).map((s, i) => <ListItem key={i} text={s} index={i} />)}
      </Section>

      {/* Tasks + Marketing Ideas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section icon={CheckSquare} title="Action Items" accent="emerald" delay={150}
          actions={regenBtn("content")}>
          {normalizeList(d.tasks).map((t, i) => <ListItem key={i} text={t} index={i} />)}
        </Section>
        <Section icon={Lightbulb} title="Marketing Ideas" accent="sky" delay={200}>
          {normalizeList(d.marketing_ideas).map((m, i) => <ListItem key={i} text={m} index={i} />)}
        </Section>
      </div>

      {/* Content Concepts — the new ChatGPT-style post ideas */}
      {d.content_concepts?.length > 0 && (
        <Section icon={Layout} title="Content Concepts" accent="pink" delay={250}
          actions={regenBtn("content")}>
          <p className="text-xs text-zinc-500 mb-4">
            Each concept is a complete, ready-to-brief post idea. Click to expand.
          </p>
          <div className="space-y-3">
            {d.content_concepts.map((c, i) => {
              // Handle case where content_concepts contains strings instead of objects
              if (typeof c === "string") return <ListItem key={i} text={c} index={i} />;
              return <ContentCard key={i} concept={c} index={i} />;
            })}
          </div>
        </Section>
      )}

      {/* Design Direction with Color Palette + Typography */}
      <Section icon={Palette} title="Design Direction" accent="orange" delay={350}
        actions={regenBtn("design")}>
        <p className="text-sm text-zinc-300 leading-relaxed mb-5">{toText(d.design_direction) || "—"}</p>
        <ColorPalette palette={d.color_palette} />
        <TypographyDisplay typo={d.typography} />

        {d.visual_style && typeof d.visual_style === "object" && (
          <div className="space-y-2 mt-3">
            {Object.entries(d.visual_style).map(([k, v]) => (
              <div key={k} className="flex gap-3 text-sm">
                <span className="text-zinc-500 capitalize shrink-0 w-36">{k.replace("_", " ")}:</span>
                <span className="text-zinc-300">{toText(v)}</span>
              </div>
            ))}
          </div>
        )}

        {d.reference_accounts?.length > 0 && (
          <div className="mt-5">
            <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Instagram size={12} /> Reference Accounts
            </h4>
            <div className="space-y-1.5">
              {d.reference_accounts.map((a, i) => (
                <p key={i} className="text-sm text-zinc-400">{toText(a)}</p>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Assumptions */}
      {d.assumptions?.length > 0 && (
        <Section icon={HelpCircle} title="Assumptions" accent="cyan" delay={500} collapsible>
          {normalizeList(d.assumptions).map((a, i) => <ListItem key={i} text={a} index={i} />)}
        </Section>
      )}

      {/* Inspiration Panel */}
      <InspirationPanel queries={d.design_search_queries} />

      {/* Follow-up Questions */}
      <FollowUpQuestions
        questions={d.follow_up_questions}
        sessionId={sessionId}
        onRegenerate={async () => {
          // Reload the session to get updated data
          try {
            const resp = await fetch(`${API}/sessions/${sessionId}`);
            const session = await resp.json();
            if (session?.result) setLocalData(session.result);
          } catch (e) { console.error(e); }
        }}
      />
    </div>
  );
}
