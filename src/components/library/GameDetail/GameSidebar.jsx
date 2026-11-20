import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gamepad2,
  Play,
  Square,
  Loader2,
  RefreshCw,
  FolderOpen,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Magnet,
  Cloud,
  CloudUpload,
  CloudDownload,
  Terminal,
  Wrench,
  Sparkles,
} from "lucide-react";
import ModManagerModal from "./ModManagerModal";

export default function GameSidebar({
  selectedGame,
  libraryEntry,
  isRunning,
  hasExe,
  showControls,
  currentTheme,
  launching,
  fetchingLinks,
  downloadLinks,
  downloadedParts,
  handleChooseLauncher,
  handleLaunchGame,
  handleKillGame,
  handleDownload,
  setLibrary,
  setToast,
}) {
  const [localParams, setLocalParams] = useState(
    libraryEntry?.launchParams || "",
  );
  const [expandedSources, setExpandedSources] = useState({});
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [saveHistory, setSaveHistory] = useState([]);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showModModal, setShowModModal] = useState(false);
  const [patchLinks, setPatchLinks] = useState([]);
  const [isLinux, setIsLinux] = useState(false);

  useEffect(() => {
    setLocalParams(libraryEntry?.launchParams || "");
    if (window.api?.isLinuxPlatform) {
      window.api.isLinuxPlatform().then(setIsLinux);
    }
  }, [libraryEntry]);

  const loadSaveHistory = async () => {
    if (window.api?.getGameSaveHistory) {
      const history = await window.api.getGameSaveHistory(selectedGame.name);
      setSaveHistory(history);
    }
  };

  useEffect(() => {
    if (selectedGame?.name) {
      loadSaveHistory();
      if (window.api?.getPatchLinks) {
        window.api.getPatchLinks(selectedGame.name).then((patches) => {
          setPatchLinks(patches || []);
        }).catch(() => {});
      }
    }
  }, [selectedGame?.name]);

  const [syncLoading, setSyncLoading] = useState(false);

  const handleSyncWithCloud = async () => {
    setSyncLoading(true);
    try {
      if (window.api?.syncCloudSaves) {
        const res = await window.api.syncCloudSaves(selectedGame.name);
        if (res.synced) {
          if (setToast) setToast(`Cloud saves synced! (${res.syncedCount || 1} items) ☁️`);
          await loadSaveHistory();
        } else {
          if (setToast) setToast(res.message || "Cloud sync completed.");
        }
      }
    } catch (e) {
      if (setToast) setToast(`Cloud sync failed: ${e.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleManualBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await window.api.backupGameSaves(
        selectedGame.name,
        null,
        selectedGame.steamAppId || null,
      );
      if (res.success) {
        if (setToast) setToast("Save progress backed up successfully! ☁️");
        await loadSaveHistory();
      } else {
        if (setToast) setToast(`Backup notice: ${res.message}`);
      }
    } catch (e) {
      if (setToast) setToast(`Backup failed: ${e.message}`);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleManualRestore = async (backupPath) => {
    setRestoreLoading(true);
    try {
      const saves = await window.api.findGameSaves(
        selectedGame.name,
        selectedGame.steamAppId || null,
      );
      const targetDir = saves.length > 0 ? saves[0].path : null;
      if (!targetDir) {
        if (setToast)
          setToast("No existing save target found to restore into.");
        return;
      }

      const res = await window.api.restoreGameSaves(backupPath, targetDir);
      if (res.success) {
        if (setToast) setToast("Saves restored successfully! 🎮");
        setShowRestoreModal(false);
      } else {
        if (setToast) setToast(`Restore failed: ${res.message}`);
      }
    } catch (e) {
      if (setToast) setToast(`Restore failed: ${e.message}`);
    } finally {
      setRestoreLoading(false);
    }
  };

  const toggleSource = (index) => {
    setExpandedSources((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="w-[450px] shrink-0 flex flex-col gap-4">
      {showControls && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-black/40 backdrop-blur-2xl border p-8 rounded-3xl relative overflow-hidden shadow-2xl ${isRunning ? "border-green-500/40 shadow-green-500/10" : "border-white/10"}`}
        >
          <div
            className={`absolute top-0 left-0 w-full h-1.5 bg-linear-to-r ${isRunning ? "from-green-500 to-emerald-400" : currentTheme.textGradient}`}
          />
          <h3
            className={`text-xl font-black mb-6 flex items-center gap-3 uppercase tracking-widest bg-clip-text text-transparent bg-linear-to-r ${isRunning ? "from-green-400 to-emerald-300" : currentTheme.textGradient}`}
          >
            <Gamepad2
              className={isRunning ? "text-green-400" : currentTheme.iconColor}
              size={24}
            />{" "}
            Game Controls
          </h3>
          <div className="flex flex-col gap-3">
            {libraryEntry?.exePath && (
              <>
                <button
                  onClick={() =>
                    window.api.openGameFolder(libraryEntry.exePath)
                  }
                  className="flex items-center justify-between bg-black/60 border border-white/5 p-4 rounded-xl hover:bg-white/10 transition-all text-left group"
                >
                  <span className="text-sm font-bold text-gray-200 group-hover:text-white">
                    Open Game Folder
                  </span>
                  <FolderOpen
                    size={18}
                    className="text-gray-400 group-hover:text-white transition-colors"
                  />
                </button>

                <button
                  onClick={() => setShowModModal(true)}
                  className="flex items-center justify-between bg-black/60 border border-white/5 p-4 rounded-xl hover:bg-white/10 transition-all text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <Wrench size={16} className={currentTheme.iconColor} />
                    <span className="text-sm font-bold text-gray-200 group-hover:text-white">
                      Mods & ReShade Manager
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-gray-400 group-hover:text-white border border-white/5">
                    Manage
                  </span>
                </button>
              </>
            )}

            {!hasExe ? (
              <button
                onClick={handleChooseLauncher}
                className="flex items-center justify-center gap-3 p-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all border border-dashed border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
              >
                <Gamepad2 size={18} /> Choose Launcher
              </button>
            ) : isRunning ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
                  <span className="text-sm font-black text-green-300 uppercase tracking-widest">
                    Game Running
                  </span>
                </div>
                <button
                  onClick={handleKillGame}
                  className="flex items-center justify-center gap-3 p-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 text-red-300 hover:text-red-200"
                >
                  <Square size={16} fill="currentColor" /> Exit Game
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleLaunchGame}
                  disabled={launching}
                  className={`flex items-center justify-center gap-3 p-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${currentTheme.color} text-black`}
                >
                  {launching ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Play size={18} fill="currentColor" />
                  )}
                  {launching ? "Launching..." : "Play"}
                </button>
                <button
                  onClick={handleChooseLauncher}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                >
                  <RefreshCw size={13} /> Reselect Executable
                </button>
              </div>
            )}

            {hasExe && (
              <div className="mt-1 flex flex-col gap-2 p-3 bg-black/40 rounded-xl border border-white/5">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Executable
                  </p>
                  <p
                    className="text-xs text-gray-300 truncate font-mono"
                    title={libraryEntry.exePath}
                  >
                    {libraryEntry.exePath.split(/[/\\]/).pop()}
                  </p>
                </div>

                {isLinux && (
                  <div className="border-t border-white/5 pt-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                      <Terminal size={12} /> SteamOS / Proton
                    </span>
                    <span className="text-[10px] bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                      Prefix Active
                    </span>
                  </div>
                )}

                {/* Game Progression Status */}
                <div className="border-t border-white/5 pt-2">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Game Progression Status
                  </p>
                  <select
                    value={libraryEntry.status || "backlog"}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      if (window.api?.setGameStatus) {
                        const updated = await window.api.setGameStatus(selectedGame.name, newStatus);
                        setLibrary(updated);
                        if (setToast) setToast(`Status updated to: ${newStatus.toUpperCase()}`);
                      }
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-lg py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-white/30 font-bold"
                  >
                    <option value="playing">🟢 Playing (In Progress)</option>
                    <option value="completed">🏆 Completed (Finished)</option>
                    <option value="backlog">📑 Backlog (To Play)</option>
                    <option value="dropped">🛑 Dropped / Archived</option>
                  </select>
                </div>

                <div className="border-t border-white/5 pt-2">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Launch Parameters
                  </p>
                  <input
                    type="text"
                    placeholder="-fullscreen -novid"
                    value={localParams}
                    onChange={(e) => setLocalParams(e.target.value)}
                    onBlur={async () => {
                      if (
                        localParams !== (libraryEntry.launchParams || "")
                      ) {
                        const updated = await window.api.setLaunchParams(
                          selectedGame.name,
                          localParams,
                        );
                        setLibrary(updated);
                      }
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-lg py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-white/30 font-mono shadow-inner"
                  />
                </div>

                {/* High CPU Priority Toggle */}
                <div className="border-t border-white/5 pt-2 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-gray-200">High CPU Priority</span>
                    <p className="text-[10px] text-gray-500">Allocates maximum CPU thread scheduling to game</p>
                  </div>
                  <button
                    onClick={async () => {
                      const nextVal = !libraryEntry.highPriority;
                      if (window.api?.setGameLaunchProfile) {
                        const updated = await window.api.setGameLaunchProfile(selectedGame.name, {
                          highPriority: nextVal,
                        });
                        setLibrary(updated);
                        if (setToast) setToast(`High Priority: ${nextVal ? "ON" : "OFF"}`);
                      }
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 border border-white/10 ${libraryEntry.highPriority ? currentTheme.color : "bg-black"}`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 bg-white w-4.5 h-4.5 rounded-full transition-transform ${libraryEntry.highPriority ? "translate-x-5" : ""}`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Cloud Save Backup Panel ── */}
      {hasExe && (
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl relative overflow-hidden shadow-2xl flex flex-col gap-4">
          <div
            className={`absolute top-0 left-0 w-full h-1.5 bg-linear-to-r ${currentTheme.textGradient}`}
          />
          <div className="flex items-center justify-between">
            <h3
              className={`text-lg font-black flex items-center gap-2.5 uppercase tracking-widest bg-clip-text text-transparent bg-linear-to-r ${currentTheme.textGradient}`}
            >
              <Cloud className={currentTheme.iconColor} size={20} /> Cloud Save Sync
            </h3>
            {saveHistory.length > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                {saveHistory.length} Snapshots
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleManualBackup}
              disabled={backupLoading}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white`}
            >
              {backupLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CloudUpload size={14} className={currentTheme.iconColor} />
              )}
              {backupLoading ? "Backing up..." : "Backup Saves"}
            </button>

            <button
              onClick={handleSyncWithCloud}
              disabled={syncLoading}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-cyan-300 hover:text-cyan-200`}
              title="Sync snapshots with Cloud folder / WebDAV"
            >
              {syncLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Sync Cloud
            </button>

            {saveHistory.length > 0 && (
              <button
                onClick={() => setShowRestoreModal(!showRestoreModal)}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
              >
                <CloudDownload size={14} /> Restore
              </button>
            )}
          </div>

          {/* Restore Snapshots Dropdown List */}
          {showRestoreModal && (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Available Backups
              </p>
              <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 no-scrollbar">
                {saveHistory.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-black/50 border border-white/5 text-xs"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-gray-200">
                          {new Date(s.mtime).toLocaleDateString()} {new Date(s.mtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {s.isCloud && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 rounded font-bold uppercase">
                            Cloud
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {(s.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button
                      onClick={() => handleManualRestore(s.path)}
                      disabled={restoreLoading}
                      className="px-2.5 py-1 rounded-md bg-green-500/20 text-green-300 font-bold hover:bg-green-500/30 transition-all text-[11px]"
                    >
                      {restoreLoading ? "Restoring..." : "Restore"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Game Patches & Updates Banner ── */}
      {patchLinks.length > 0 && (
        <div className="bg-cyan-950/20 backdrop-blur-2xl border border-cyan-500/30 p-6 rounded-3xl relative overflow-hidden shadow-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black flex items-center gap-2 uppercase tracking-widest text-cyan-300">
              <Sparkles className="text-cyan-400" size={18} /> Updates & Patches Available ({patchLinks.length})
            </h3>
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse">
              New Patch
            </span>
          </div>

          <p className="text-xs text-gray-400 font-medium">
            New updates or standalone patches were detected for this game title.
          </p>

          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto no-scrollbar pt-1">
            {patchLinks.map((patch, pIdx) => (
              <div
                key={pIdx}
                className="flex items-center justify-between p-3 rounded-xl bg-black/50 border border-cyan-500/20 gap-2"
              >
                <span className="text-xs font-bold text-gray-200 truncate flex-1" title={patch.title || patch.name}>
                  {patch.title || patch.name}
                </span>
                <button
                  onClick={() => handleDownload(patch.link || patch.page_link)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-md transition-all"
                >
                  <Download size={13} /> Get Patch
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className={`absolute top-0 left-0 w-full h-1.5 bg-linear-to-r ${currentTheme.textGradient}`} />
        <h3 className={`text-xl font-black mb-6 flex items-center gap-3 uppercase tracking-widest bg-clip-text text-transparent bg-linear-to-r ${currentTheme.textGradient}`}>
          <Download className={currentTheme.iconColor} size={24} /> Direct Links
        </h3>
        
        <div className="flex flex-col gap-3">
          {fetchingLinks ? (
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl text-gray-400 font-bold uppercase tracking-widest text-sm border border-white/5">
              <Loader2 size={18} className="animate-spin" /> Scraping Links...
            </div>
          ) : downloadLinks.length === 0 ? (
            <div className="p-4 bg-white/5 rounded-xl text-gray-500 font-bold uppercase tracking-widest text-xs border border-white/5 text-center">
              No Direct Links Found
            </div>
          ) : (
            downloadLinks.map((originalLink, i) => {
              // BUG FIX: Convert 1-item arrays to pure strings to correctly render them as Single Links instead of Accordions
              const link = (Array.isArray(originalLink) && originalLink.length === 1) ? originalLink[0] : originalLink;

              // 1. ARRAY OF LINKS (Multi-Part)
              if (Array.isArray(link)) {
                const isExpanded = expandedSources[i];
                let siteName = "Direct Download";
                try {
                  siteName = new URL(link[0]).hostname.replace("www.", "");
                } catch {
                  siteName = "Direct Download";
                }
                const allPartsDone = link.every(
                  (_, pIdx) => downloadedParts[`${i}-${pIdx}`],
                );

                return (
                  <div
                    key={i}
                    className={`border rounded-xl overflow-hidden shadow-md ${allPartsDone ? "bg-green-900/10 border-green-500/30" : "bg-black/60 border-white/5"}`}
                  >
                    <button
                      onClick={() => toggleSource(i)}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/10 transition-all text-left group"
                    >
                      <div className="flex flex-col">
                        <span
                          className={`text-[15px] font-bold uppercase tracking-wider transition-colors ${allPartsDone ? "text-green-400" : "text-gray-200 group-hover:text-white"}`}
                        >
                          {siteName}
                        </span>
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                          {link.length} Parts
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 transition-all text-gray-400">
                        {isExpanded ? (
                          <ChevronLeft className="-rotate-90" size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className={`border-t ${allPartsDone ? "border-green-500/30 bg-green-900/20" : "border-white/5 bg-black/40"}`}
                        >
                          <div className="p-3 grid grid-cols-2 gap-2">
                            {link.map((partUrl, pIdx) => {
                              const isPartDone =
                                downloadedParts[`${i}-${pIdx}`];
                              return (
                                <button
                                  key={pIdx}
                                  onClick={() => handleDownload(partUrl)}
                                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-bold transition-all border ${isPartDone ? "bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30" : "bg-white/5 hover:bg-white/15 border-white/5 hover:border-white/15 text-gray-300 hover:text-white"}`}
                                >
                                  {isPartDone ? (
                                    <CheckCircle size={14} />
                                  ) : (
                                    <Download size={14} />
                                  )}{" "}
                                  Part {pIdx + 1}
                                </button>
                              );
                            })}
                          </div>
                          {!allPartsDone && (
                            <div className="p-3 border-t border-white/5 flex justify-end">
                              <button
                                onClick={() => handleDownload(link)}
                                className={`px-4 py-2 ${currentTheme.color} hover:brightness-110 text-black rounded-lg font-bold text-xs shadow-lg transition-all`}
                              >
                                Download Missing Parts
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              // 2. MAGNET / TORRENT LINK
              if (typeof link === "string" && link.startsWith("magnet:")) {
                return (
                  <button
                    key={i}
                    onClick={() => handleDownload(link)}
                    className="group flex items-center justify-between bg-green-900/20 border border-green-500/20 p-4 rounded-xl hover:bg-green-500/20 transition-all shadow-md hover:shadow-xl text-left"
                  >
                    <span className="truncate text-[15px] font-bold text-green-400 group-hover:text-green-300 transition-colors">
                      Magnet / Torrent
                    </span>
                    <div className="bg-green-500/10 border border-green-500/20 p-2.5 rounded-xl group-hover:bg-green-500 group-hover:text-black transition-colors">
                      <Magnet
                        size={18}
                        className="text-green-500 group-hover:text-black"
                      />
                    </div>
                  </button>
                );
              }

              // 3. STANDARD DIRECT LINK (Single Link)
              if (typeof link === "string") {
                let hostname = "Download Link";
                try {
                  hostname = new URL(link).hostname.replace("www.", "");
                } catch {
                  hostname = "Download Link";
                }
                const isPartDone = downloadedParts[`${i}`];

                return (
                  <button
                    key={i}
                    onClick={() => handleDownload(link)}
                    className={`group flex items-center justify-between border p-4 rounded-xl transition-all shadow-md hover:shadow-xl text-left ${isPartDone ? "bg-green-900/20 border-green-500/40 hover:bg-green-900/40" : "bg-black/60 border-white/5 hover:bg-white/10"}`}
                  >
                    <span
                      className={`truncate text-[15px] font-bold uppercase tracking-wider transition-colors ${isPartDone ? "text-green-400" : "text-gray-200 group-hover:text-white"}`}
                    >
                      {hostname}
                    </span>
                    <div
                      className={`${isPartDone ? "bg-green-500/20 text-green-400 border border-green-500/40" : "bg-white/5 border border-white/5 text-gray-400 group-hover:bg-white/15 group-hover:text-white"} p-2.5 rounded-xl transition-colors`}
                    >
                      {isPartDone ? (
                        <CheckCircle size={18} />
                      ) : (
                        <Download size={18} />
                      )}
                    </div>
                  </button>
                );
              }
            })
          )}
        </div>
      </div>

      <ModManagerModal
        isOpen={showModModal}
        onClose={() => setShowModModal(false)}
        game={libraryEntry || selectedGame}
        currentTheme={currentTheme}
        setToast={setToast}
      />
    </div>
  );
}