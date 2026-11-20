const { BrowserWindow, screen } = require("electron");

let overlayWindow = null;
const notificationQueue = [];
let isShowingNotification = false;

function getOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  const winWidth = 380;
  const winHeight = 110;
  const x = screenWidth - winWidth - 24;
  const y = screenHeight - winHeight - 24;

  overlayWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeIconUrl(url) {
  if (typeof url !== "string" || !url.trim()) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return escapeHtml(parsed.toString());
    }
  } catch {}
  return "";
}

// Generate self-contained HTML for Steam-style achievement popup
function generateAchievementHTML(gameName, achievement) {
  const trophyIconSvg = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.45.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.45.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  `;

  const safeIcon = sanitizeIconUrl(achievement?.icon);
  const safeGameName = escapeHtml(gameName || "Game");
  const safeTitle = escapeHtml(achievement?.displayName || achievement?.apiName || "Achievement");
  const safeDesc = escapeHtml(achievement?.description || "Achievement Earned");

  const iconImg = safeIcon
    ? `<img src="${safeIcon}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;border:1px solid rgba(251,191,36,0.5);box-shadow:0 0 12px rgba(251,191,36,0.3);" />`
    : `<div style="width:48px;height:48px;border-radius:10px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.4);display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(251,191,36,0.2);">${trophyIconSvg}</div>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
        body {
          background: transparent;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
        }
        .banner {
          width: 360px;
          height: 90px;
          background: rgba(12, 12, 16, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(251, 191, 36, 0.4);
          border-radius: 16px;
          display: flex;
          align-items: center;
          padding: 12px 16px;
          gap: 14px;
          position: relative;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.8), 0 0 20px rgba(251, 191, 36, 0.15);
          animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .banner::before {
          content: "";
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 2px;
          background: linear-gradient(90deg, #fbbf24, #f59e0b, #ef4444);
          border-radius: 16px 16px 0 0;
        }
        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #fbbf24;
          margin-bottom: 2px;
        }
        .title {
          font-size: 14px;
          font-weight: 800;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }
        .desc {
          font-size: 11px;
          font-weight: 500;
          color: #9ca3af;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }
        .game-tag {
          font-size: 9px;
          color: #6b7280;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-left: auto;
          max-width: 90px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @keyframes slideIn {
          0% { transform: translateY(120%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeOut {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(50px); }
        }
      </style>
    </head>
    <body>
      <div class="banner" id="banner">
        ${iconImg}
        <div class="content">
          <div class="header">
            <span>ACHIEVEMENT UNLOCKED</span>
            <span class="game-tag">${safeGameName}</span>
          </div>
          <div class="title">${safeTitle}</div>
          <div class="desc">${safeDesc}</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Show achievement notification overlay with auto queue
function showAchievementNotification({ gameName, achievement }) {
  notificationQueue.push({ gameName, achievement });
  processNextNotification();
}

function processNextNotification() {
  if (isShowingNotification || notificationQueue.length === 0) return;

  isShowingNotification = true;
  const current = notificationQueue.shift();
  const win = getOverlayWindow();

  const html = generateAchievementHTML(current.gameName, current.achievement);
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  win.showInactive();

  setTimeout(() => {
    if (win && !win.isDestroyed()) {
      win.webContents.executeJavaScript(`
        document.getElementById('banner').style.animation = 'fadeOut 0.5s ease-in forwards';
      `).catch(() => {});
    }

    setTimeout(() => {
      if (win && !win.isDestroyed()) {
        win.hide();
      }
      isShowingNotification = false;
      // Process next in queue
      processNextNotification();
    }, 600);
  }, 4500);
}

function closeOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
}

module.exports = {
  showAchievementNotification,
  closeOverlay,
};
