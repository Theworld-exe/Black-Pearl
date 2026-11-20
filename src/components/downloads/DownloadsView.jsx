import { useState, useEffect } from "react";
import {
  Download,
  CheckCircle,
  Play,
  Pause,
  X,
  ChevronDown,
  ChevronUp,
  Archive,
  FolderOpen,
  Loader2,
  Gauge,
  Users,
  UploadCloud,
  Activity,
  Radio,
} from "lucide-react";
import { formatBytes } from "../../utils/helpers";

export default function DownloadsView({
  activeDownloads,
  completedDownloads,
  setCompletedDownloads,
  currentTheme,
}) {
  const [expandedGids, setExpandedGids] = useState(new Set());
  const [extractingMap, setExtractingMap] = useState({});
  const [extractedMap, setExtractedMap] = useState({});
  const [currentSpeedLimit, setCurrentSpeedLimit] = useState("0");
  const [customLimitInput, setCustomLimitInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  useEffect(() => {
    if (window.api?.getSpeedLimits) {
      window.api.getSpeedLimits().then((res) => {
        if (res && res.downloadLimit) {
          setCurrentSpeedLimit(res.downloadLimit);
        }
      });
    }
  }, []);

  const handleApplySpeedLimit = async (limit) => {
    setCurrentSpeedLimit(limit);
    if (window.api?.setSpeedLimits) {
      await window.api.setSpeedLimits(limit, "0");
    }
  };

  const toggleExpand = (gid) => {
    setExpandedGids((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(gid)) newSet.delete(gid);
      else newSet.add(gid);
      return newSet;
    });
  };

  const isArchiveFile = (fileName = "") => {
    const lower = fileName.toLowerCase();
    return [".zip", ".rar", ".7z", ".tar", ".gz", ".iso", ".001", ".bin"].some((ext) =>
      lower.endsWith(ext),
    ) || /\.part\d+(\.rar)?$/i.test(lower) || /\.\d{3}$/i.test(lower);
  };

  const handleExtract = async (c) => {
    const key = c.gid || c.name;
    setExtractingMap((prev) => ({ ...prev, [key]: true }));

    try {
      const db = await window.api.getDB();
      const dlPath = db.profile?.downloadPath || "";
      const rawName = c.name || "";
      const fileName = rawName.startsWith("[BlackPearl]")
        ? rawName
        : `[BlackPearl] ${rawName}`;
      const fullPath = dlPath ? `${dlPath}/${fileName}` : fileName;
      const gameName = c.gameName || c.name || "";

      const res = await window.api.extractArchive({
        filePath: fullPath,
        gameName,
        autoDelete: true,
      });

      if (res.success) {
        setExtractedMap((prev) => ({
          ...prev,
          [key]: res.extractedPath,
        }));
      }
    } catch (err) {
      console.error("Extraction error:", err);
    } finally {
      setExtractingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="p-8 w-full max-w-5xl mx-auto flex flex-col gap-10">
      <div>
        {/* Header & Speed Limiter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2
            className={`text-3xl font-black flex items-center gap-3 bg-clip-text text-transparent bg-linear-to-r ${currentTheme.textGradient}`}
          >
            <Download className={currentTheme.iconColor} /> Active Downloads
          </h2>

          {/* Speed Limiter Controls */}
          <div className="flex items-center gap-2 bg-black/50 border border-white/10 p-1.5 rounded-2xl backdrop-blur-xl shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 pl-2 pr-1 flex items-center gap-1.5">
              <Gauge size={14} className={currentTheme.iconColor} /> Cap:
            </span>

            {[
              { label: "Unlimited", value: "0" },
              { label: "5 MB/s", value: "5M" },
              { label: "10 MB/s", value: "10M" },
              { label: "20 MB/s", value: "20M" },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  setShowCustomInput(false);
                  handleApplySpeedLimit(p.value);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  currentSpeedLimit === p.value && !showCustomInput
                    ? `${currentTheme.activeBg} text-white shadow-md`
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {p.label}
              </button>
            ))}

            {showCustomInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="e.g. 15M"
                  value={customLimitInput}
                  onChange={(e) => setCustomLimitInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customLimitInput.trim()) {
                      handleApplySpeedLimit(customLimitInput.trim());
                    }
                  }}
                  className="w-16 bg-black/60 border border-white/20 rounded-lg px-2 py-0.5 text-xs text-white font-mono focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (customLimitInput.trim()) {
                      handleApplySpeedLimit(customLimitInput.trim());
                    }
                  }}
                  className="px-2 py-0.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white"
                >
                  OK
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustomInput(true)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                  !["0", "5M", "10M", "20M"].includes(currentSpeedLimit)
                    ? `${currentTheme.activeBg} text-white shadow-md`
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {!["0", "5M", "10M", "20M"].includes(currentSpeedLimit)
                  ? `${currentSpeedLimit}`
                  : "Custom"}
              </button>
            )}
          </div>
        </div>

        {activeDownloads.length === 0 ? (
          <p className="text-gray-400 italic bg-black/40 backdrop-blur-3xl border border-white/10 p-6 rounded-2xl">
            No active downloads.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {activeDownloads.map((d) => {
              const progress = d.total > 0 ? (d.completed / d.total) * 100 : 0;
              const isPreparing = d.completed === 0 && d.speed === 0;
              const isExpanded = expandedGids.has(d.gid);
              const hasFiles = d.files && d.files.length > 1;
              const isTorrent = d.isTorrent;
              const shareRatio = d.total > 0 && d.uploadLength ? (d.uploadLength / d.total).toFixed(2) : "0.00";

              return (
                <div
                  key={d.gid}
                  className="bg-black/60 backdrop-blur-3xl p-6 rounded-2xl relative overflow-hidden shadow-lg border border-white/10 flex flex-col"
                >
                  {isPreparing ? (
                    <div className="absolute top-0 left-0 h-1 w-full bg-blue-500/50 animate-pulse" />
                  ) : (
                    <div
                      className={`absolute top-0 left-0 h-1 ${currentTheme.color} transition-all duration-500`}
                      style={{ width: `${progress}%` }}
                    />
                  )}

                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2.5 truncate pr-4">
                      <h4 className="font-bold truncate text-lg text-white">
                        {d.gameName || d.name}
                      </h4>
                      {isTorrent && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 shrink-0 flex items-center gap-1">
                          <Radio size={10} /> Torrent Swarm
                        </span>
                      )}
                    </div>

                    {isPreparing ? (
                      <span className={`font-mono text-xs font-black animate-pulse shrink-0 uppercase tracking-widest ${currentTheme.iconColor}`}>
                        Preparing...
                      </span>
                    ) : (
                      <div className="flex items-center gap-3 shrink-0 font-mono">
                        <span className="text-sm font-bold text-gray-200">
                          {formatBytes(d.speed)}/s
                        </span>
                        {isTorrent && d.uploadSpeed > 0 && (
                          <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                            <UploadCloud size={12} className="text-blue-400" /> {formatBytes(d.uploadSpeed)}/s
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Torrent Telemetry Badges */}
                  {isTorrent && (
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] font-medium text-gray-300">
                        <div className={`w-1.5 h-1.5 rounded-full ${d.numSeeders > 0 ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
                        <span className="font-bold text-white">{d.numSeeders || 0}</span> Seeds
                      </div>

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] font-medium text-gray-300">
                        <Users size={12} className="text-blue-400" />
                        <span className="font-bold text-white">{d.connections || 0}</span> Peers
                      </div>

                      {d.uploadLength > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] font-medium text-gray-300">
                          <Activity size={12} className="text-purple-400" />
                          Ratio: <span className="font-bold text-white">{shareRatio}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] font-medium">
                        <span className="text-gray-400">Swarm:</span>
                        <span
                          className={`font-bold ${
                            d.numSeeders >= 10
                              ? "text-green-400"
                              : d.numSeeders >= 1
                              ? "text-yellow-400"
                              : d.connections > 0
                              ? "text-blue-400"
                              : "text-red-400"
                          }`}
                        >
                          {d.numSeeders >= 10
                            ? "Healthy"
                            : d.numSeeders >= 1
                            ? "Active"
                            : d.connections > 0
                            ? "Connecting"
                            : "Stalled"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm text-gray-300 mb-4 font-mono">
                    {isPreparing ? (
                      <span className="text-gray-500 italic">
                        Resolving links & allocating metadata...
                      </span>
                    ) : (
                      <span>
                        {formatBytes(d.completed)} / {formatBytes(d.total)}
                      </span>
                    )}
                    <span>
                      {isPreparing ? "0.0%" : `${progress.toFixed(1)}%`}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {d.status === "paused" ? (
                      <button
                        onClick={() => window.api.resumeDownload(d.gid)}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
                      >
                        <Play size={18} className="text-green-400" />
                      </button>
                    ) : (
                      <button
                        onClick={() => window.api.pauseDownload(d.gid)}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
                      >
                        <Pause size={18} className="text-yellow-400" />
                      </button>
                    )}
                    <button
                      onClick={() => window.api.cancelDownload(d.gid)}
                      className="bg-white/10 hover:bg-red-500/50 p-2 rounded-lg transition-colors"
                    >
                      <X size={18} className="text-red-400" />
                    </button>
                  </div>

                  {/* SUB-FILES RENDERING (Torrent Tree) */}
                  {hasFiles && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <button
                        onClick={() => toggleExpand(d.gid)}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                        {isExpanded
                          ? "Hide Files"
                          : `View Tracked Files (${d.files.length})`}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 max-h-48 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                          {d.files.map((file, idx) => {
                            const fileProgress =
                              file.total > 0
                                ? (file.completed / file.total) * 100
                                : 0;
                            return (
                              <div
                                key={idx}
                                className="bg-white/5 rounded-lg p-2 text-xs"
                              >
                                <div className="flex justify-between text-gray-300 mb-1">
                                  <span
                                    className="truncate pr-2"
                                    title={file.path}
                                  >
                                    {file.path || "Resolving..."}
                                  </span>
                                  <span className="shrink-0">
                                    {fileProgress.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-full bg-black/50 h-1 rounded-full overflow-hidden">
                                  <div
                                    className={`${currentTheme.color} h-full opacity-70`}
                                    style={{ width: `${fileProgress}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2
            className={`text-2xl font-black flex items-center gap-3 bg-clip-text text-transparent bg-linear-to-r ${currentTheme.textGradient}`}
          >
            <CheckCircle className={currentTheme.iconColor} /> Completed Downloads
          </h2>
          {completedDownloads.length > 0 && (
            <button
              onClick={() =>
                window.api.clearCompleted().then(() => setCompletedDownloads([]))
              }
              className="text-xs bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg font-bold text-gray-300 transition-colors border border-white/5"
            >
              Clear History
            </button>
          )}
        </div>
        {completedDownloads.length === 0 ? (
          <p className="text-gray-400 italic bg-black/40 backdrop-blur-3xl border border-white/10 p-6 rounded-2xl">
            No completed downloads yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {completedDownloads.map((c, i) => {
              const key = c.gid || c.name || i;
              const isArchive = isArchiveFile(c.name);
              const isExtracting = extractingMap[key];
              const extractedPath = extractedMap[key] || c.extractedPath;

              return (
                <div
                  key={key}
                  className="bg-black/40 backdrop-blur-3xl border border-white/10 p-5 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-black/60 transition-colors"
                >
                  <div className="flex flex-col gap-1 truncate pr-4">
                    <span className="truncate font-bold text-gray-100">
                      {c.gameName || c.name}
                    </span>
                    {c.name && c.gameName && (
                      <span className="text-xs text-gray-400 truncate font-mono">
                        {c.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {extractedPath ? (
                      <button
                        onClick={() => window.api.openGameFolder(extractedPath)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-bold rounded-lg border border-green-500/30 transition-all"
                      >
                        <FolderOpen size={14} /> Open Extracted
                      </button>
                    ) : isArchive ? (
                      <button
                        onClick={() => handleExtract(c)}
                        disabled={isExtracting}
                        className={`flex items-center gap-1.5 px-3 py-1.5 ${currentTheme.activeBg} hover:brightness-110 text-xs font-bold rounded-lg border border-white/10 transition-all disabled:opacity-50`}
                      >
                        {isExtracting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Extracting...
                          </>
                        ) : (
                          <>
                            <Archive size={14} /> Extract
                          </>
                        )}
                      </button>
                    ) : null}

                    <button
                      onClick={async () => {
                        const db = await window.api.getDB();
                        const dlPath = db.profile?.downloadPath || "";
                        window.api.openGameFolder(dlPath);
                      }}
                      className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg border border-white/5 transition-all"
                      title="Open Downloads Folder"
                    >
                      <FolderOpen size={15} />
                    </button>

                    <span className="text-xs text-green-400 font-black tracking-widest uppercase bg-green-400/10 px-3 py-1.5 rounded-md border border-green-400/20">
                      Completed
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
