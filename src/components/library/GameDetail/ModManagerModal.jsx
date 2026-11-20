import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Package,
  Wrench,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  FolderOpen,
  Plus,
  Loader2,
  CheckCircle,
  AlertCircle,
  Cpu,
} from "lucide-react";
import { formatBytes } from "../../../utils/helpers";

export default function ModManagerModal({
  isOpen,
  onClose,
  game,
  currentTheme,
  setToast,
}) {
  const [modStatus, setModStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedHook, setSelectedHook] = useState("dxgi.dll");

  const loadModStatus = async () => {
    if (!game?.exePath || !window.api?.getGameModStatus) {
      setLoading(false);
      return;
    }
    try {
      const res = await window.api.getGameModStatus(game.exePath);
      setModStatus(res);
      if (res.activeHook) setSelectedHook(res.activeHook);
    } catch (e) {
      console.error("Failed to load mod status:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && game?.exePath) {
      setLoading(true);
      loadModStatus();
    }
  }, [isOpen, game?.exePath]);

  const handleToggleReShade = async () => {
    if (!modStatus) return;
    setActionLoading(true);
    try {
      const nextState = !modStatus.isReShadeEnabled;
      const res = await window.api.toggleReShade(game.exePath, nextState);
      if (res.success) {
        if (setToast) setToast(`ReShade ${nextState ? "Enabled" : "Disabled"}`);
        await loadModStatus();
      } else {
        // If not installed, install it
        const installRes = await window.api.installReShade(game.exePath, selectedHook);
        if (installRes.success) {
          if (setToast) setToast("ReShade Installed & Initialized! ✨");
          await loadModStatus();
        } else {
          if (setToast) setToast(`ReShade notice: ${installRes.message}`);
        }
      }
    } catch (e) {
      if (setToast) setToast(`ReShade error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleInstallReShade = async () => {
    setActionLoading(true);
    try {
      const res = await window.api.installReShade(game.exePath, selectedHook);
      if (res.success) {
        if (setToast) setToast(`ReShade injected (${selectedHook})! ✨`);
        await loadModStatus();
      } else {
        if (setToast) setToast(`Error: ${res.message}`);
      }
    } catch (e) {
      if (setToast) setToast(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectAndInstallMod = async () => {
    if (!window.api?.selectModFile) return;
    const filePath = await window.api.selectModFile();
    if (!filePath) return;

    setActionLoading(true);
    try {
      const res = await window.api.installModArchive(game.exePath, filePath);
      if (res.success) {
        if (setToast) setToast(res.message || "Mod installed successfully! 📦");
        await loadModStatus();
      } else {
        if (setToast) setToast(`Install failed: ${res.message}`);
      }
    } catch (e) {
      if (setToast) setToast(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleMod = async (mod) => {
    try {
      const res = await window.api.toggleMod(mod.path, !mod.enabled);
      if (res.success) {
        await loadModStatus();
      } else {
        if (setToast) setToast(`Toggle failed: ${res.message}`);
      }
    } catch (e) {
      if (setToast) setToast(`Error: ${e.message}`);
    }
  };

  const handleDeleteMod = async (mod) => {
    try {
      const res = await window.api.deleteMod(mod.path);
      if (res.success) {
        if (setToast) setToast(`Deleted ${mod.name}`);
        await loadModStatus();
      } else {
        if (setToast) setToast(`Delete failed: ${res.message}`);
      }
    } catch (e) {
      if (setToast) setToast(`Error: ${e.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#0a0a0d] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative"
        >
          <div className={`absolute top-0 left-0 w-full h-1.5 bg-linear-to-r ${currentTheme.textGradient}`} />

          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
                <Wrench className={currentTheme.iconColor} size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                  Mods & ReShade Manager
                </h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  {game?.name || "Game"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 no-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 size={32} className="animate-spin text-gray-400" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Scanning Game Engine Structure...
                </span>
              </div>
            ) : !modStatus ? (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle size={40} className="mx-auto mb-2 opacity-50" />
                <p className="font-bold">Please select an executable for this game first.</p>
              </div>
            ) : (
              <>
                {/* Engine Structure Pill */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu size={16} className="text-cyan-400" />
                    <span className="text-xs font-bold text-gray-300">
                      Detected Architecture:
                    </span>
                    <span className="text-xs font-black text-cyan-300 uppercase tracking-wider bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-500/20">
                      {modStatus.engine}
                    </span>
                  </div>
                  {modStatus.modDir && (
                    <button
                      onClick={() => window.api.openGameFolder(modStatus.modDir)}
                      className="text-[11px] font-bold text-gray-400 hover:text-white flex items-center gap-1 hover:underline"
                    >
                      <FolderOpen size={13} /> Open Mod Folder
                    </button>
                  )}
                </div>

                {/* ── ReShade Section ── */}
                <div className="p-5 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Sparkles size={18} className="text-amber-400" />
                      <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">
                          ReShade Graphics Suite
                        </h4>
                        <p className="text-xs text-gray-400">
                          Post-processing shaders, ambient occlusion, color grading & ray-tracing filters
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleToggleReShade}
                      disabled={actionLoading}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                        modStatus.isReShadeEnabled
                          ? "bg-green-500/20 border-green-500/40 text-green-300 shadow-md shadow-green-500/10"
                          : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      {modStatus.isReShadeEnabled ? (
                        <>
                          <CheckCircle size={14} className="text-green-400" /> Active
                        </>
                      ) : (
                        "Disabled / Off"
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-bold">Wrapper API:</span>
                      <select
                        value={selectedHook}
                        onChange={(e) => setSelectedHook(e.target.value)}
                        className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 outline-none"
                      >
                        <option value="dxgi.dll">DXGI (DirectX 11 / 12)</option>
                        <option value="d3d11.dll">Direct3D 11</option>
                        <option value="d3d9.dll">Direct3D 9</option>
                        <option value="opengl32.dll">OpenGL</option>
                      </select>
                    </div>

                    <button
                      onClick={handleInstallReShade}
                      disabled={actionLoading}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${currentTheme.activeBg} text-white border border-white/10 hover:brightness-110 transition-all`}
                    >
                      {modStatus.hasReShade ? "Reinstall Shaders" : "Inject ReShade"}
                    </button>
                  </div>
                </div>

                {/* ── Mod Package Installer ── */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Package size={14} className={currentTheme.iconColor} /> Installed Mods & Plugins (
                      {modStatus.installedMods?.length || 0})
                    </h4>

                    <button
                      onClick={handleSelectAndInstallMod}
                      disabled={actionLoading}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${currentTheme.color} text-black hover:brightness-110 transition-all flex items-center gap-1.5 shadow-md`}
                    >
                      <Plus size={14} /> Install Mod (.zip / .pak / .asi)
                    </button>
                  </div>

                  {modStatus.installedMods?.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white/5 border border-dashed border-white/10 text-center flex flex-col items-center gap-2 text-gray-500">
                      <Package size={32} className="opacity-40" />
                      <p className="text-xs font-medium">
                        No mods installed yet. Click "Install Mod" to add .pak, .asi, .dll or zip packages.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                      {modStatus.installedMods.map((mod, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                            mod.enabled
                              ? "bg-white/5 border-white/10"
                              : "bg-black/30 border-white/5 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                            <div
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                mod.enabled ? "bg-green-400 animate-pulse" : "bg-gray-600"
                              }`}
                            />
                            <div className="flex flex-col truncate">
                              <span className="text-xs font-bold text-white truncate">
                                {mod.name}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">
                                {mod.size > 0 ? formatBytes(mod.size) : "Directory"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleToggleMod(mod)}
                              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                                mod.enabled
                                  ? "bg-green-500/20 text-green-300"
                                  : "bg-white/5 text-gray-400 hover:text-white"
                              }`}
                              title={mod.enabled ? "Disable Mod" : "Enable Mod"}
                            >
                              {mod.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                            </button>

                            <button
                              onClick={() => handleDeleteMod(mod)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all"
                              title="Delete Mod"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-black/40 flex justify-between items-center">
            {modStatus?.exeDir && (
              <button
                onClick={() => window.api.openGameFolder(modStatus.exeDir)}
                className="text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all"
              >
                <FolderOpen size={14} /> Open Executable Directory
              </button>
            )}
            <button
              onClick={onClose}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs ${currentTheme.color} text-black shadow-lg hover:brightness-110 transition-all ml-auto`}
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
