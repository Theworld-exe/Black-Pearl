const net = require("net");
const path = require("path");
const crypto = require("crypto");
const { getDB } = require("./database");

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "121500000000000000"; // Black Pearl Discord Application Client ID
let rpcSocket = null;
let isConnected = false;
let reconnectTimer = null;
let currentActivity = null;

// OPCODES
const OPCODES = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
};

// Encode Discord IPC packet (Opcode + Length + JSON payload)
function encodePacket(op, payload) {
  const jsonStr = JSON.stringify(payload);
  const len = Buffer.byteLength(jsonStr);
  const packet = Buffer.alloc(8 + len);
  packet.writeInt32LE(op, 0);
  packet.writeInt32LE(len, 4);
  packet.write(jsonStr, 8);
  return packet;
}

// Find active Discord IPC pipe (Windows: \\.\pipe\discord-ipc-0..9, Linux: $XDG_RUNTIME_DIR/discord-ipc-0..9)
function getDiscordPipePath(index = 0) {
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\discord-ipc-${index}`;
  }
  const prefix =
    process.env.XDG_RUNTIME_DIR ||
    process.env.TMPDIR ||
    process.env.TMP ||
    process.env.TEMP ||
    "/tmp";
  return path.join(prefix, `discord-ipc-${index}`);
}

// Connect to Discord IPC socket
function connectDiscordRpc(pipeIndex = 0) {
  if (isConnected || rpcSocket) return;

  const db = getDB();
  if (db.profile?.discordRpc === false) {
    return; // User disabled Discord RPC
  }

  const pipePath = getDiscordPipePath(pipeIndex);
  const socket = net.createConnection(pipePath);

  socket.on("connect", () => {
    console.log(`[DiscordRPC] Connected to Discord on pipe ${pipeIndex}`);
    rpcSocket = socket;
    isConnected = true;

    // Send Handshake
    const handshake = {
      v: 1,
      client_id: CLIENT_ID,
    };
    socket.write(encodePacket(OPCODES.HANDSHAKE, handshake));

    // Restore pending activity if any, or set idle
    if (currentActivity) {
      setActivity(currentActivity);
    } else {
      setIdleActivity();
    }
  });

  socket.on("data", (data) => {
    try {
      if (data.length < 8) return;
      const op = data.readInt32LE(0);
      const len = data.readInt32LE(4);
      const raw = data.slice(8, 8 + len).toString("utf8");
      // Parsed Discord response
    } catch (err) {}
  });

  socket.on("error", (err) => {
    // Try next pipe index up to 9
    if (pipeIndex < 9 && !isConnected) {
      connectDiscordRpc(pipeIndex + 1);
    } else {
      scheduleReconnect();
    }
  });

  socket.on("close", () => {
    isConnected = false;
    rpcSocket = null;
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    const db = getDB();
    if (db.profile?.discordRpc !== false) {
      connectDiscordRpc(0);
    }
  }, 15000);
}

// Send SET_ACTIVITY command to Discord
function setActivity(activity) {
  currentActivity = activity;
  if (!rpcSocket || !isConnected) return;

  try {
    const payload = {
      cmd: "SET_ACTIVITY",
      args: {
        pid: process.pid,
        activity,
      },
      nonce: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    };
    rpcSocket.write(encodePacket(OPCODES.FRAME, payload));
  } catch (err) {
    console.error("[DiscordRPC] Failed to send activity:", err.message);
  }
}

// Set Game Activity when launching a game
function setGameActivity(gameName, startTime = Date.now()) {
  const db = getDB();
  if (db.profile?.discordRpc === false) return;

  const startTimestamp = Math.floor(startTime / 1000);
  const activity = {
    details: `Playing ${gameName}`,
    state: "In Game",
    timestamps: {
      start: startTimestamp,
    },
    assets: {
      large_image: "blackpearl_logo",
      large_text: gameName,
      small_image: "gamepad",
      small_text: "Black Pearl Launcher",
    },
  };

  setActivity(activity);
}

// Set Idle status when browsing launcher
function setIdleActivity() {
  const db = getDB();
  if (db.profile?.discordRpc === false) return;

  const activity = {
    details: "In Library",
    state: "Browsing Games",
    assets: {
      large_image: "blackpearl_logo",
      large_text: "Black Pearl",
      small_image: "online",
      small_text: "Online",
    },
  };

  setActivity(activity);
}

// Clear Discord activity
function clearActivity() {
  currentActivity = null;
  if (!rpcSocket || !isConnected) return;

  try {
    const payload = {
      cmd: "SET_ACTIVITY",
      args: {
        pid: process.pid,
        activity: null,
      },
      nonce: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    };
    rpcSocket.write(encodePacket(OPCODES.FRAME, payload));
  } catch (err) {}
}

// Destroy Discord RPC on shutdown
function destroyDiscordRpc() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (rpcSocket) {
    try {
      clearActivity();
      rpcSocket.destroy();
    } catch (e) {}
    rpcSocket = null;
    isConnected = false;
  }
}

module.exports = {
  connectDiscordRpc,
  setGameActivity,
  setIdleActivity,
  setActivity,
  clearActivity,
  destroyDiscordRpc,
};
