// Renders the user's game library with launcher status, remove option, and auto-directory scanner.
import { useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Trash2,
  Gamepad2,
  Clock,
  FolderSearch,
  BarChart3,
  LayoutGrid,
  Play,
  CheckCircle2,
  Bookmark,
  XCircle,
} from "lucide-react";
import { formatPlaytime, formatLastPlayed } from "../../utils/helpers";
import GameScannerModal from "./GameScannerModal";
import LibraryAnalytics from "./LibraryAnalytics";

export default function LibraryView({
  library,
  setLibrary,
  currentTheme,
  openGame,
  onRemove,
  runningGames,
  setToast,
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [viewMode, setViewMode] = useState("games"); // "games" | "analytics"
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "playing" | "completed" | "backlog" | "dropped"

  const filteredLibrary = library.filter((g) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "backlog") return g.status === "backlog" || !g.status;
    return g.status === statusFilter;
  });

  return (
    <div className="p-8 w-full">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h2
            className={`text-3xl font-black bg-clip-text text-transparent bg-linear-to-r ${currentTheme.textGradient}`}
          >
            <BookOpen className="inline mb-1 mr-2" size={28} />
            Library
          </h2>
          <span className="text-xs font-black uppercase tracking-widest text-gray-500 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
            {library.length} {library.length === 1 ? "game" : "games"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Grid vs Analytics Toggle */}
          <div className="flex bg-black/40 border border-white/10 p-1 rounded-2xl">
            <button
              onClick={() => setViewMode("games")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === "games"
                  ? `${currentTheme.activeBg} text-white shadow-md`
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <LayoutGrid size={14} /> Games
            </button>
            <button
              onClick={() => setViewMode("analytics")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === "analytics"
                  ? `${currentTheme.activeBg} text-white shadow-md`
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <BarChart3 size={14} /> Insights & Analytics
            </button>
          </div>

          {/* Scan & Import Games Button */}
          <button
            onClick={() => setScannerOpen(true)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/20 transition-all shadow-md`}
          >
            <FolderSearch size={16} className={currentTheme.iconColor} /> Scan for Games
          </button>
        </div>
      </div>

      {viewMode === "analytics" ? (
        <LibraryAnalytics
          library={library}
          currentTheme={currentTheme}
          openGame={openGame}
        />
      ) : (
        <>
          {/* Status Filter Tabs */}
          {library.length > 0 && (
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar">
              {[
                { id: "all", label: "All Games", count: library.length },
                {
                  id: "playing",
                  label: "Playing",
                  count: library.filter((g) => g.status === "playing").length,
                  icon: Play,
                  color: "text-green-400",
                },
                {
                  id: "completed",
                  label: "Completed",
                  count: library.filter((g) => g.status === "completed").length,
                  icon: CheckCircle2,
                  color: "text-amber-400",
                },
                {
                  id: "backlog",
                  label: "Backlog",
                  count: library.filter((g) => g.status === "backlog" || !g.status).length,
                  icon: Bookmark,
                  color: "text-blue-400",
                },
                {
                  id: "dropped",
                  label: "Dropped",
                  count: library.filter((g) => g.status === "dropped").length,
                  icon: XCircle,
                  color: "text-red-400",
                },
              ].map((tab) => {
                const isActive = statusFilter === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shrink-0 ${
                      isActive
                        ? `${currentTheme.activeBg} border-white/20 text-white shadow-md`
                        : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                    }`}
                  >
                    {Icon && <Icon size={12} className={tab.color} />}
                    {tab.label}
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive ? "bg-white/20 text-white" : "bg-black/40 text-gray-400"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

      {filteredLibrary.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500 gap-4">
          <Gamepad2
            size={72}
            className={`opacity-30 ${currentTheme.iconColor}`}
          />
          <p className="text-lg font-bold text-center text-gray-300">
            {library.length === 0 ? "Your library is empty" : "No games in this category"}
          </p>
          <p className="text-sm text-center max-w-xs text-gray-400">
            {library.length === 0
              ? "Downloaded games appear here automatically, or you can scan your drives for existing games."
              : "Change your status filter or add more games to this category."}
          </p>
          {library.length === 0 && (
            <button
              onClick={() => setScannerOpen(true)}
              className={`mt-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider ${currentTheme.color} text-black shadow-lg hover:brightness-110 transition-all flex items-center gap-2`}
            >
              <FolderSearch size={16} /> Scan Directory for Games
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredLibrary.map((game, i) => {
            const isRunning = runningGames.has(game.name);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group flex flex-col gap-2.5"
              >
                <div
                  onClick={() => openGame(game)}
                  className={`relative rounded-2xl overflow-hidden aspect-3/4 bg-black/40 border transition-all duration-300 cursor-pointer shadow-xl ${
                    isRunning
                      ? "border-green-500/60 shadow-green-500/20"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <img
                    src={game.thumbnail_link}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    alt={game.name}
                  />

                  {/* Running pulse overlay */}
                  {isRunning && (
                    <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-ping" />
                        <span className="text-[10px] font-black text-green-300 uppercase tracking-widest bg-black/60 px-2 py-1 rounded-full">
                          Running
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Launcher set badge */}
                  {game.exePath && !isRunning && (
                    <div className="absolute bottom-2 left-2 z-10 bg-black/70 backdrop-blur-sm text-white text-[9px] font-black tracking-wider px-2 py-1 rounded-lg flex items-center gap-1 border border-white/10">
                      <Gamepad2 size={10} className={currentTheme.iconColor} />
                      LAUNCHER SET
                    </div>
                  )}

                  {/* Playtime badge if played */}
                  {game.playtimeSeconds > 0 && !isRunning && (
                    <div className="absolute top-2 right-2 z-10 bg-black/75 backdrop-blur-sm text-gray-200 text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border border-white/10">
                      <Clock size={9} className={currentTheme.iconColor} />
                      {formatPlaytime(game.playtimeSeconds)}
                    </div>
                  )}

                  {/* Hover overlay */}
                  {!isRunning && (
                    <div className="absolute inset-0 bg-linear-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                      <span
                        className={`text-[10px] font-bold text-white px-2.5 py-1.5 rounded-lg bg-linear-to-r ${currentTheme.textGradient}`}
                      >
                        {game.exePath ? "▶ PLAY" : "OPEN"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Title + Remove */}
                <div className="flex items-start justify-between px-1 gap-2">
                  <div className="flex-1 min-w-0">
                    <h3
                      onClick={() => openGame(game)}
                      className="font-semibold text-sm text-gray-200 group-hover:text-white transition-colors line-clamp-1 cursor-pointer"
                      title={game.name}
                    >
                      {game.name}
                    </h3>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1 font-medium">
                      <span className="flex items-center gap-1 truncate">
                        <Clock size={11} className={currentTheme.iconColor} />
                        {formatPlaytime(game.playtimeSeconds)}
                      </span>
                      {game.lastPlayed && (
                        <span className="text-[10px] text-gray-500 shrink-0 ml-1">
                          {formatLastPlayed(game.lastPlayed)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(game.name);
                    }}
                    title="Remove from Library"
                    className="shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20 mt-0.5"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      </>
      )}

      <GameScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        currentTheme={currentTheme}
        setLibrary={setLibrary}
        setToast={setToast}
      />
    </div>
  );
}
