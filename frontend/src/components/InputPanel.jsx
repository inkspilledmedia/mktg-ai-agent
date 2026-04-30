import React, { useRef, useState } from "react";
import {
  Upload, Mic, FileAudio, Type, X, ChevronDown, ChevronUp,
  Globe, Instagram, Building2, Users, Briefcase, MessageSquare, User,
} from "lucide-react";

const ALLOWED = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm", ".mp4"];

export default function InputPanel({ onSubmit, isProcessing }) {
  const inputRef = useRef(null);
  const [mode, setMode] = useState("audio"); // audio | text
  const [clientType, setClientType] = useState("company"); // company | influencer
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [showContext, setShowContext] = useState(true);
  const [error, setError] = useState("");

  // Context fields
  const [companyName, setCompanyName] = useState("");
  const [niche, setNiche] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [extraContext, setExtraContext] = useState("");

  const validateFile = (f) => {
    setError("");
    if (!f) return false;
    const ext = "." + f.name.split(".").pop().toLowerCase();
    if (!ALLOWED.includes(ext)) { setError(`Unsupported format.`); return false; }
    if (f.size > 100 * 1024 * 1024) { setError("Max 100 MB."); return false; }
    return true;
  };

  const handleFile = (f) => { if (validateFile(f)) setFile(f); };

  const handleSubmit = () => {
    if (isProcessing) return;
    if (mode === "audio" && !file) { setError("Select an audio file"); return; }
    if (mode === "text" && !text.trim()) { setError("Paste some text"); return; }
    setError("");
    onSubmit({
      mode,
      file: mode === "audio" ? file : null,
      text: mode === "text" ? text : "",
      clientType, companyName, niche, targetAudience, websiteUrl, instagramUrl, extraContext,
    });
  };

  const formatSize = (b) => b < 1024 * 1024 ? (b / 1024).toFixed(1) + " KB" : (b / (1024 * 1024)).toFixed(1) + " MB";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      {/* Mode tabs */}
      <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
        {[
          { id: "audio", icon: Mic, label: "Upload Audio" },
          { id: "text", icon: Type, label: "Paste Text" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => { setMode(t.id); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === t.id
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Audio upload */}
      {mode === "audio" && (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            dragActive ? "border-rose-500 bg-rose-500/5" : "border-zinc-700/50 hover:border-zinc-600"
          } ${isProcessing ? "opacity-40 pointer-events-none" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files?.[0]); }}
        >
          <input ref={inputRef} type="file" accept={ALLOWED.join(",")} className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])} />
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              file ? "bg-rose-500/10 text-rose-400" : "bg-zinc-800 text-zinc-400"
            }`}>
              {file ? <FileAudio size={26} /> : <Upload size={26} />}
            </div>
            {file ? (
              <div>
                <p className="font-medium text-zinc-200">{file.name}</p>
                <p className="text-sm text-zinc-500">{formatSize(file.size)}</p>
              </div>
            ) : (
              <div>
                <p className="text-zinc-300 font-medium">Drop audio file here</p>
                <p className="text-sm text-zinc-500 mt-1">MP3, WAV, M4A, OGG, FLAC, WebM, MP4</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Text paste */}
      {mode === "text" && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the client's message, meeting notes, brief, or any text here..."
          rows={6}
          className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 px-5 py-4 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600 transition-colors"
          disabled={isProcessing}
        />
      )}

      {/* Context form (collapsible) */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <button
          onClick={() => setShowContext(!showContext)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Building2 size={15} />
            Client Context <span className="text-zinc-600 font-normal">(recommended for better results)</span>
          </span>
          {showContext ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showContext && (
          <div className="px-5 pb-5 space-y-3">
            {/* Client type toggle */}
            <div className="flex bg-zinc-800/50 rounded-xl p-1 border border-zinc-700/30">
              {[
                { id: "company", icon: Building2, label: "Company / Brand" },
                { id: "influencer", icon: User, label: "Influencer / Creator" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setClientType(t.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    clientType === t.id
                      ? "bg-zinc-700 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <t.icon size={13} />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block flex items-center gap-1.5">
                  {clientType === "influencer" ? <User size={11} /> : <Building2 size={11} />}
                  {clientType === "influencer" ? "Influencer / Creator Name" : "Company / Brand Name"}
                </label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={clientType === "influencer" ? "e.g. Ranveer Allahbadia, MrBeast" : "e.g. FitLife Gym, Zomato"}
                  className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block flex items-center gap-1.5">
                  <Briefcase size={11} /> {clientType === "influencer" ? "Content Niche" : "Industry / Niche"}
                </label>
                <input value={niche} onChange={(e) => setNiche(e.target.value)}
                  placeholder={clientType === "influencer" ? "e.g. Fitness, Tech, Lifestyle, Comedy" : "e.g. Fitness, Real Estate, SaaS"}
                  className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600" />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block flex items-center gap-1.5">
                <Users size={11} /> {clientType === "influencer" ? "Audience / Followers" : "Target Audience"}
              </label>
              <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
                placeholder={clientType === "influencer" ? "e.g. Gen Z 18-25, aspiring entrepreneurs, fitness beginners" : "e.g. Men 25-40, working professionals interested in fitness"}
                className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block flex items-center gap-1.5">
                  <Globe size={11} /> {clientType === "influencer" ? "Website / Linktree" : "Website URL"}
                </label>
                <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder={clientType === "influencer" ? "https://linktr.ee/handle" : "https://example.com"}
                  className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block flex items-center gap-1.5">
                  <Instagram size={11} /> Instagram Handle
                </label>
                <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/handle"
                  className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600" />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block flex items-center gap-1.5">
                <MessageSquare size={11} /> Additional Context
              </label>
              <textarea value={extraContext} onChange={(e) => setExtraContext(e.target.value)}
                placeholder={clientType === "influencer"
                  ? "Follower count, content style, collab history, personal brand tone, specific goals..."
                  : "Budget, deadline, past campaigns, specific requirements..."}
                rows={2}
                className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600" />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <X size={14} /> {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-3">
        {mode === "audio" && file && (
          <button onClick={() => setFile(null)}
            className="px-4 py-2.5 rounded-xl text-sm text-zinc-400 bg-zinc-800 border border-zinc-700/50 hover:text-zinc-200 transition-colors"
            disabled={isProcessing}>
            Clear
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={isProcessing || (mode === "audio" && !file) || (mode === "text" && !text.trim())}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            isProcessing
              ? "bg-rose-500/30 text-white/50 cursor-wait"
              : "bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 active:scale-[0.98]"
          } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
              Analyzing...
            </>
          ) : (
            <>
              <Mic size={16} />
              Analyze {mode === "audio" ? "Audio" : "Text"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
