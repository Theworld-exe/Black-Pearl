import { useState, useEffect } from "react";
import { Trophy, CheckCircle2, Lock } from "lucide-react";

export default function AchievementsSection({
  selectedGame,
  steamData,
  currentTheme,
  setToast,
}) {
  const [achievements, setAchievements] = useState([]);
  const [unlockedMap, setUnlockedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // "all", "unlocked", "locked"

  const appId = steamData?.appid || steamData?.steam_appid || selectedGame?.steamAppId || null;

  const loadAchievements = async () => {
    if (!window.api?.getGameAchievements) return;
    setLoading(true);
    try {
      const res = await window.api.getGameAchievements(selectedGame.name, appId);
      if (res && res.schema) {
        setAchievements(res.schema);
        setUnlockedMap(res.unlocked || {});
      }
    } catch (e) {
      console.warn("Failed to load achievements", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGame?.name) {
      loadAchievements();
    }
  }, [selectedGame?.name, appId]);

  const handleToggleUnlock = async (apiName) => {
    try {
      const res = await window.api.unlockAchievement(selectedGame.name, apiName);
      setUnlockedMap((prev) => {
        const next = { ...prev };
        if (next[apiName]) {
          delete next[apiName];
        } else {
          next[apiName] = res.timestamp;
        }
        return next;
      });
      if (res.newlyUnlocked && setToast) {
        setToast("Achievement Marked as Unlocked! 🏆");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex flex-col gap-4 mt-8">
        <div className="h-8 w-48 skeleton rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (achievements.length === 0) {
    return null;
  }

  const totalCount = achievements.length;
  const unlockedCount = Object.keys(unlockedMap).length;
  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const filteredAchievements = achievements.filter((a) => {
    const isUnlocked = !!unlockedMap[a.apiName];
    if (filter === "unlocked") return isUnlocked;
    if (filter === "locked") return !isUnlocked;
    return true;
  });

  return (
    <div className="w-full flex flex-col gap-6 mt-12 pt-12 border-t border-white/10">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h3
            className={`text-2xl font-black flex items-center gap-3 uppercase tracking-wider bg-clip-text text-transparent bg-linear-to-r ${currentTheme.textGradient}`}
          >
            <Trophy className={currentTheme.iconColor} size={28} /> Game Achievements
          </h3>
          <p className="text-xs text-gray-400 font-medium mt-1">
            Track and unlock in-game achievements
          </p>
        </div>

        {/* Progress Bar & Badges */}
        <div className="flex flex-col gap-2 min-w-[240px]">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-gray-300">
              {unlockedCount} of {totalCount} Unlocked
            </span>
            <span className={`font-mono font-black ${currentTheme.iconColor}`}>
              {progressPercent}%
            </span>
          </div>
          <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
            <div
              className={`h-full ${currentTheme.color} transition-all duration-500 rounded-full`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {[
            { id: "all", label: `All (${totalCount})` },
            { id: "unlocked", label: `Unlocked (${unlockedCount})` },
            { id: "locked", label: `Locked (${totalCount - unlockedCount})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                filter === f.id
                  ? `${currentTheme.activeBg} border-white/20 text-white shadow-md`
                  : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAchievements.map((ach) => {
          const isUnlocked = !!unlockedMap[ach.apiName];
          const unlockDate = unlockedMap[ach.apiName];

          return (
            <div
              key={ach.apiName}
              onClick={() => handleToggleUnlock(ach.apiName)}
              className={`p-4 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer group select-none ${
                isUnlocked
                  ? "bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]"
                  : "bg-black/40 border-white/5 hover:border-white/15 opacity-70 hover:opacity-100"
              }`}
              title="Click to toggle achievement"
            >
              {/* Icon */}
              <div className="relative shrink-0">
                {ach.icon ? (
                  <img
                    src={isUnlocked ? ach.icon : (ach.iconGray || ach.icon)}
                    alt={ach.displayName}
                    className={`w-14 h-14 rounded-xl border object-cover transition-all ${
                      isUnlocked
                        ? "border-yellow-500/50 shadow-md scale-105"
                        : "border-white/10 grayscale brightness-50"
                    }`}
                  />
                ) : (
                  <div
                    className={`w-14 h-14 rounded-xl border flex items-center justify-center ${
                      isUnlocked
                        ? "border-yellow-500/50 bg-yellow-500/20 text-yellow-400"
                        : "border-white/10 bg-black/60 text-gray-600"
                    }`}
                  >
                    {isUnlocked ? <Trophy size={22} /> : <Lock size={22} />}
                  </div>
                )}
                {isUnlocked && (
                  <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black p-0.5 rounded-full shadow-lg">
                    <CheckCircle2 size={12} />
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4
                    className={`text-sm font-bold truncate transition-colors ${
                      isUnlocked ? "text-yellow-200" : "text-gray-300"
                    }`}
                  >
                    {ach.displayName}
                  </h4>
                  {isUnlocked && (
                    <span className="text-[9px] font-mono text-yellow-400/80 shrink-0">
                      Unlocked
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
                  {ach.description || "In-game achievement"}
                </p>
                {unlockDate && (
                  <span className="text-[10px] text-gray-500 mt-1 block font-mono">
                    {new Date(unlockDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
