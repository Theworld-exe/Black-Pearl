import { motion } from "framer-motion";
import {
  Clock,
  Trophy,
  Gamepad2,
  CheckCircle2,
  Bookmark,
  XCircle,
  Play,
  Flame,
  Award,
  Sparkles,
} from "lucide-react";

export default function LibraryAnalytics({ library, currentTheme, openGame }) {
  // 1. Calculate overall stats
  const totalSeconds = library.reduce(
    (acc, g) => acc + (g.playtimeSeconds || 0),
    0,
  );
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

  const playingCount = library.filter((g) => g.status === "playing").length;
  const completedCount = library.filter((g) => g.status === "completed").length;
  const backlogCount = library.filter((g) => g.status === "backlog" || !g.status).length;
  const droppedCount = library.filter((g) => g.status === "dropped").length;

  // 2. Top Played Games
  const sortedByPlaytime = [...library]
    .filter((g) => (g.playtimeSeconds || 0) > 0)
    .sort((a, b) => (b.playtimeSeconds || 0) - (a.playtimeSeconds || 0));

  const topPlayed = sortedByPlaytime.slice(0, 4);

  // 3. Recently Played
  const recentlyPlayed = [...library]
    .filter((g) => g.lastPlayed)
    .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed))
    .slice(0, 5);

  const formatHours = (seconds) => {
    if (!seconds || seconds <= 0) return "0m";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="p-8 flex flex-col gap-8 max-w-7xl mx-auto">
      {/* Top Banner & Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Playtime Card */}
        <div className="bg-black/40 border border-white/10 p-6 rounded-3xl relative overflow-hidden shadow-2xl flex flex-col justify-between">
          <div className={`absolute top-0 left-0 w-full h-1 bg-linear-to-r ${currentTheme.textGradient}`} />
          <div className="flex items-center justify-between text-gray-400 mb-4">
            <span className="text-xs font-black uppercase tracking-widest">Total Playtime</span>
            <Clock size={18} className={currentTheme.iconColor} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{totalHours}</span>
            <span className="text-sm font-bold text-gray-400">hours {totalMinutes}m</span>
          </div>
        </div>

        {/* Total Games */}
        <div className="bg-black/40 border border-white/10 p-6 rounded-3xl relative overflow-hidden shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-4">
            <span className="text-xs font-black uppercase tracking-widest">Library Size</span>
            <Gamepad2 size={18} className="text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{library.length}</span>
            <span className="text-sm font-bold text-gray-400">installed titles</span>
          </div>
        </div>

        {/* Completed Games */}
        <div className="bg-black/40 border border-white/10 p-6 rounded-3xl relative overflow-hidden shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-4">
            <span className="text-xs font-black uppercase tracking-widest">Completed</span>
            <Trophy size={18} className="text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-300">{completedCount}</span>
            <span className="text-sm font-bold text-gray-400">
              {library.length > 0 ? Math.round((completedCount / library.length) * 100) : 0}% beat
            </span>
          </div>
        </div>

        {/* Currently In Progress */}
        <div className="bg-black/40 border border-white/10 p-6 rounded-3xl relative overflow-hidden shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-4">
            <span className="text-xs font-black uppercase tracking-widest">In Progress</span>
            <Flame size={18} className="text-green-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-green-300">{playingCount}</span>
            <span className="text-sm font-bold text-gray-400">games active</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Most Played Hall of Fame & Progression Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Played Hall of Fame (2 Columns) */}
        <div className="lg:col-span-2 bg-black/40 border border-white/10 p-7 rounded-3xl shadow-2xl relative flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Award className="text-amber-400" size={20} /> Most Played Hall of Fame
            </h3>
            <span className="text-xs font-bold text-gray-400">Cumulative Time</span>
          </div>

          {topPlayed.length === 0 ? (
            <div className="text-center py-16 text-gray-500 font-bold text-sm">
              No recorded gameplay yet. Launch games from your library to track playtime!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {topPlayed.map((game, idx) => {
                const percent = totalSeconds > 0 ? Math.round(((game.playtimeSeconds || 0) / totalSeconds) * 100) : 0;
                const medals = ["🥇", "🥈", "🥉", "4️⃣"];

                return (
                  <motion.div
                    key={game.name}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => openGame(game)}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer flex gap-3.5 items-center relative overflow-hidden group shadow-lg"
                  >
                    <span className="text-xl shrink-0">{medals[idx] || "🎮"}</span>
                    <img
                      src={game.thumbnail_link || game.thumbnail || "https://images.unsplash.com/photo-1550745165-9bc0b252726f"}
                      alt={game.name}
                      className="w-14 h-18 object-cover rounded-xl shadow-md shrink-0 bg-black/60"
                      onError={(e) => {
                        e.target.src = "https://images.unsplash.com/photo-1550745165-9bc0b252726f";
                      }}
                    />

                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-black text-sm text-white truncate group-hover:text-amber-300 transition-colors">
                        {game.clean_name || game.name}
                      </span>
                      <span className="text-xs font-bold text-amber-400 mt-0.5">
                        {formatHours(game.playtimeSeconds)}
                      </span>
                      <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full bg-linear-to-r ${currentTheme.textGradient}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Distribution & Progression Card */}
        <div className="bg-black/40 border border-white/10 p-7 rounded-3xl shadow-2xl flex flex-col justify-between gap-6">
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2 mb-1">
              <Sparkles className={currentTheme.iconColor} size={20} /> Progression
            </h3>
            <p className="text-xs text-gray-400">Library completion distribution</p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Playing */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-green-500/10 border border-green-500/20 text-xs font-bold">
              <div className="flex items-center gap-2 text-green-300">
                <Play size={14} /> Currently Playing
              </div>
              <span className="font-black text-white">{playingCount}</span>
            </div>

            {/* Completed */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold">
              <div className="flex items-center gap-2 text-amber-300">
                <CheckCircle2 size={14} /> Completed
              </div>
              <span className="font-black text-white">{completedCount}</span>
            </div>

            {/* Backlog */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs font-bold">
              <div className="flex items-center gap-2 text-blue-300">
                <Bookmark size={14} /> In Backlog
              </div>
              <span className="font-black text-white">{backlogCount}</span>
            </div>

            {/* Dropped */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs font-bold">
              <div className="flex items-center gap-2 text-red-300">
                <XCircle size={14} /> Dropped / Archived
              </div>
              <span className="font-black text-white">{droppedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Played History */}
      {recentlyPlayed.length > 0 && (
        <div className="bg-black/40 border border-white/10 p-7 rounded-3xl shadow-2xl flex flex-col gap-4">
          <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
            <Clock className={currentTheme.iconColor} size={18} /> Recent Play Activity
          </h3>

          <div className="flex flex-col gap-2">
            {recentlyPlayed.map((game) => (
              <div
                key={game.name}
                onClick={() => openGame(game)}
                className="p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3 truncate">
                  <img
                    src={game.thumbnail_link || game.thumbnail || "https://images.unsplash.com/photo-1550745165-9bc0b252726f"}
                    alt={game.name}
                    className="w-10 h-13 object-cover rounded-lg bg-black/60"
                  />
                  <div className="flex flex-col truncate">
                    <span className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                      {game.clean_name || game.name}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Total Playtime: {formatHours(game.playtimeSeconds)}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 text-xs text-gray-500 font-mono">
                  {new Date(game.lastPlayed).toLocaleDateString()} {new Date(game.lastPlayed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
