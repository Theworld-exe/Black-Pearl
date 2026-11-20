import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Sparkles, X } from "lucide-react";

// Web Audio API chime generator for console-like achievement sound
function playAchievementChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    // Play a rising major chord arpeggio (C5 -> E5 -> G5 -> C6)
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5
    osc1.frequency.setValueAtTime(783.99, now + 0.16); // G5
    osc1.frequency.setValueAtTime(1046.50, now + 0.24); // C6

    osc2.frequency.setValueAtTime(1046.50, now + 0.24);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.24);
    osc1.stop(now + 0.8);
    osc2.stop(now + 0.8);
  } catch {
    // AudioContext blocked by browser policy until interaction
  }
}

export default function AchievementToast() {
  const [currentAchievement, setCurrentAchievement] = useState(null);

  useEffect(() => {
    if (window.api?.onAchievementUnlocked) {
      window.api.onAchievementUnlocked((data) => {
        if (data && data.achievement) {
          playAchievementChime();
          setCurrentAchievement(data);

          // Auto-hide after 5.5 seconds
          setTimeout(() => {
            setCurrentAchievement((prev) => (prev === data ? null : prev));
          }, 5500);
        }
      });
    }
  }, []);

  return (
    <AnimatePresence>
      {currentAchievement && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="fixed top-6 right-6 z-200 max-w-md w-full bg-[#0c0c0c]/95 backdrop-blur-2xl border-2 border-yellow-500/50 rounded-2xl p-4 shadow-[0_0_50px_rgba(234,179,8,0.3)] flex items-center gap-4 text-white overflow-hidden pointer-events-auto"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-yellow-500 via-amber-300 to-yellow-600 animate-pulse" />

          {/* Achievement Icon */}
          <div className="relative shrink-0">
            {currentAchievement.achievement.icon ? (
              <img
                src={currentAchievement.achievement.icon}
                alt={currentAchievement.achievement.displayName}
                className="w-14 h-14 rounded-xl border border-yellow-500/40 bg-black/60 object-cover shadow-inner"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl border border-yellow-500/40 bg-yellow-500/10 flex items-center justify-center">
                <Trophy size={26} className="text-yellow-400" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black p-1 rounded-full shadow-lg">
              <Sparkles size={11} />
            </div>
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-yellow-400">
              <Trophy size={12} /> Achievement Unlocked
            </div>
            <h4 className="font-black text-sm text-white truncate drop-shadow-sm mt-0.5">
              {currentAchievement.achievement.displayName}
            </h4>
            <p className="text-xs text-gray-300 line-clamp-2 mt-0.5">
              {currentAchievement.achievement.description || currentAchievement.gameName}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={() => setCurrentAchievement(null)}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
