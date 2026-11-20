const { getDB } = require("./database");

let pausedByGame = false;
let pausedBySchedule = false;
let scheduleInterval = null;

function isInsideSchedule(schedule) {
  if (!schedule || !schedule.enabled) return true;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const startHour = schedule.startHour || 0;
  const startMinute = schedule.startMinute || 0;
  const endHour = schedule.endHour || 0;
  const endMinute = schedule.endMinute || 0;

  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  if (startTime < endTime) {
    // Normal window (e.g. 1:00 AM to 7:00 AM)
    return currentTime >= startTime && currentTime < endTime;
  } else {
    // Overnight window (e.g. 23:00 PM to 6:00 AM)
    return currentTime >= startTime || currentTime < endTime;
  }
}

async function handleGameStartedAutoPause() {
  const db = getDB();
  if (db.profile?.autoPauseDownloadsInGame !== false) {
    try {
      const { call } = require("./aria2");
      await call("pauseAll");
      pausedByGame = true;
      console.log("[Scheduler] Auto-paused active downloads due to active game session.");
    } catch (e) {
      console.warn("[Scheduler] Failed to auto-pause aria2:", e.message);
    }
  }
}

async function handleGameExitedAutoResume() {
  if (pausedByGame) {
    pausedByGame = false;
    const db = getDB();
    const schedule = db.profile?.downloadSchedule;

    // Check if allowed by schedule before unpausing
    if (isInsideSchedule(schedule)) {
      try {
        const { call } = require("./aria2");
        await call("unpauseAll");
        console.log("[Scheduler] Auto-resumed downloads after game exit.");
      } catch (e) {
        console.warn("[Scheduler] Failed to auto-resume aria2:", e.message);
      }
    }
  }
}

function startScheduleWatcher() {
  if (scheduleInterval) clearInterval(scheduleInterval);

  scheduleInterval = setInterval(async () => {
    const db = getDB();
    const schedule = db.profile?.downloadSchedule;
    if (!schedule || !schedule.enabled) return;

    const allowed = isInsideSchedule(schedule);
    const { call } = require("./aria2");

    if (!allowed && !pausedBySchedule && !pausedByGame) {
      try {
        await call("pauseAll");
        pausedBySchedule = true;
        console.log("[Scheduler] Paused downloads (outside scheduled time window).");
      } catch (e) {}
    } else if (allowed && pausedBySchedule && !pausedByGame) {
      try {
        await call("unpauseAll");
        pausedBySchedule = false;
        console.log("[Scheduler] Resumed downloads (inside scheduled time window).");
      } catch (e) {}
    }
  }, 30000); // Check every 30s
}

function stopScheduleWatcher() {
  if (scheduleInterval) {
    clearInterval(scheduleInterval);
    scheduleInterval = null;
  }
}

module.exports = {
  isInsideSchedule,
  handleGameStartedAutoPause,
  handleGameExitedAutoResume,
  startScheduleWatcher,
  stopScheduleWatcher,
};
