import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  FolderSearch,
  FolderOpen,
  CheckSquare,
  Square,
  CheckCircle2,
  Loader2,
  Gamepad2,
  HardDrive,
  Sparkles,
} from "lucide-react";

export default function GameScannerModal({
  isOpen,
  onClose,
  currentTheme,
  setLibrary,
  setToast,
}) {
  const [scanPath, setScanPath] = useState("");
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [discoveredGames, setDiscoveredGames] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [hasScanned, setHasScanned] = useState(false);

  const handleSelectFolder = async () => {
    if (window.api?.selectDirectory) {
      const folder = await window.api.selectDirectory();
      if (folder) {
        setScanPath(folder);
      }
    }
  };

  const handleStartScan = async () => {
    setScanning(true);
    setHasScanned(false);
    try {
      let target = scanPath;
      if (!target) {
        const db = await window.api.getDB();
        target = db.profile?.downloadPath || "";
      }
      const res = await window.api.scanForGames(target);
      if (res.success) {
        setDiscoveredGames(res.games || []);
        // Pre-select games that are not already in library
        const newIndices = new Set();
        (res.games || []).forEach((g, idx) => {
          if (!g.isAlreadyInLib) newIndices.add(idx);
        });
        setSelectedIndices(newIndices);
        setHasScanned(true);
      } else {
        if (setToast) setToast(`Scan notice: ${res.message}`);
      }
    } catch (e) {
      if (setToast) setToast(`Scan failed: ${e.message}`);
    } finally {
      setScanning(false);
    }
  };

  const toggleSelectGame = (index) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === discoveredGames.filter((g) => !g.isAlreadyInLib).length) {
      setSelectedIndices(new Set());
    } else {
      const all = new Set();
      discoveredGames.forEach((g, idx) => {
        if (!g.isAlreadyInLib) all.add(idx);
      });
      setSelectedIndices(all);
    }
  };

  const handleImportSelected = async () => {
    const toImport = discoveredGames.filter((_, idx) => selectedIndices.has(idx));
    if (toImport.length === 0) return;

    setImporting(true);
    try {
      const res = await window.api.importScannedGames(toImport);
      if (res.success) {
        if (setLibrary) setLibrary(res.library);
        if (setToast) setToast(`Successfully added ${res.addedCount} game(s) to Library! 🎮`);
        onClose();
      }
    } catch (e) {
      if (setToast) setToast(`Import error: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  const selectableCount = discoveredGames.filter((g) => !g.isAlreadyInLib).length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative"
        >
          <div className={`absolute top-0 left-0 w-full h-1.5 bg-linear-to-r ${currentTheme.textGradient}`} />

          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderSearch className={currentTheme.iconColor} size={26} />
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-wider">
                  Game Directory Scanner
                </h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  Scan folders to automatically detect installed games, match box art, and link executables
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

          {/* Directory Picker Bar */}
          <div className="p-6 border-b border-white/10 bg-black/40 flex flex-col gap-4">
            <label className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${currentTheme.iconColor}`}>
              <HardDrive size={14} /> Scan Target Folder
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Defaults to your Downloads / Games directory..."
                value={scanPath}
                onChange={(e) => setScanPath(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-white/30 font-mono truncate"
              />
              <button
                onClick={handleSelectFolder}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-200 hover:text-white border border-white/10 transition-all flex items-center gap-2 shrink-0"
              >
                <FolderOpen size={14} /> Browse
              </button>
              <button
                onClick={handleStartScan}
                disabled={scanning}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider ${currentTheme.color} text-black shadow-lg hover:brightness-110 transition-all flex items-center gap-2 shrink-0 disabled:opacity-60`}
              >
                {scanning ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Scanning...
                  </>
                ) : (
                  <>
                    <Search size={14} /> Scan Folder
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Body: Discovered Games */}
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-3 no-scrollbar">
            {scanning ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-4">
                <Loader2 size={40} className={`animate-spin ${currentTheme.iconColor}`} />
                <p className="text-sm font-bold animate-pulse">
                  Scanning directory & matching Steam metadata...
                </p>
              </div>
            ) : !hasScanned ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                <Gamepad2 size={48} className="opacity-30" />
                <p className="text-sm font-bold text-gray-400">
                  Select a directory and click Scan Folder to discover installed games
                </p>
                <p className="text-xs text-gray-500 max-w-md text-center">
                  Black Pearl will scan for executables, clean game titles, and fetch official artwork automatically.
                </p>
              </div>
            ) : discoveredGames.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                <FolderSearch size={48} className="opacity-30" />
                <p className="text-sm font-bold text-gray-300">No game executables found</p>
                <p className="text-xs text-gray-500">
                  Try browsing to a different folder containing game installations.
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                    Found {discoveredGames.length} Game(s)
                  </span>
                  {selectableCount > 0 && (
                    <button
                      onClick={toggleSelectAll}
                      className="text-xs text-gray-300 hover:text-white font-bold flex items-center gap-1.5"
                    >
                      {selectedIndices.size === selectableCount ? (
                        <>
                          <CheckSquare size={14} className={currentTheme.iconColor} /> Deselect All
                        </>
                      ) : (
                        <>
                          <Square size={14} /> Select All New
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2.5">
                  {discoveredGames.map((game, idx) => {
                    const isSelected = selectedIndices.has(idx);
                    const isAlready = game.isAlreadyInLib;

                    return (
                      <div
                        key={idx}
                        onClick={() => !isAlready && toggleSelectGame(idx)}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center gap-4 ${
                          isAlready
                            ? "bg-white/5 border-white/5 opacity-50 cursor-default"
                            : isSelected
                            ? "bg-white/10 border-white/30 shadow-md cursor-pointer"
                            : "bg-black/40 border-white/5 hover:border-white/15 cursor-pointer"
                        }`}
                      >
                        {/* Checkbox */}
                        <div className="shrink-0 text-gray-400">
                          {isAlready ? (
                            <CheckCircle2 size={18} className="text-green-500" />
                          ) : isSelected ? (
                            <CheckSquare size={18} className={currentTheme.iconColor} />
                          ) : (
                            <Square size={18} />
                          )}
                        </div>

                        {/* Thumbnail */}
                        <img
                          src={game.thumbnail_link}
                          alt={game.name}
                          className="w-14 h-16 rounded-xl object-cover border border-white/10 bg-black shrink-0"
                        />

                        {/* Details */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white truncate">
                              {game.name}
                            </h4>
                            {isAlready && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                                In Library
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 font-mono truncate mt-0.5">
                            {game.exePath}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-black/50 flex justify-between items-center">
            <span className="text-xs text-gray-400 font-medium">
              {selectedIndices.size} of {discoveredGames.length} selected
            </span>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleImportSelected}
                disabled={selectedIndices.size === 0 || importing}
                className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider ${currentTheme.color} text-black shadow-lg hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2`}
              >
                {importing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Adding...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Add Selected to Library ({selectedIndices.size})
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
