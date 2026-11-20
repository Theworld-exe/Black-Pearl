// Manages profile view, avatar upload, download directory selection, debrid services, cloud sync, bandwidth limits, and extraction.
import { useState } from "react";
import {
  User,
  Image as ImageIcon,
  HardDrive,
  Zap,
  Link,
  Archive,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Cloud,
  CloudSync,
  Gauge,
  FolderOpen,
  Server,
  ShieldCheck,
  Radio,
  Clock,
  PauseCircle,
} from "lucide-react";

export default function ProfileSettings({ profile, setProfile, currentTheme, setToast }) {
  const [showKey, setShowKey] = useState(false);
  const [validatingDebrid, setValidatingDebrid] = useState(false);
  const [debridStatus, setDebridStatus] = useState(null);

  const [showWebDAVPass, setShowWebDAVPass] = useState(false);
  const [testingWebDAV, setTestingWebDAV] = useState(false);
  const [webDAVStatus, setWebDAVStatus] = useState(null);

  const debrid = profile.debrid || {
    provider: "realdebrid",
    apiKey: "",
    enabled: false,
  };

  const cloudSync = profile.cloudSync || {
    enabled: false,
    type: "folder",
    folderPath: "",
    webdavUrl: "",
    webdavUser: "",
    webdavPass: "",
  };

  const speedLimits = profile.speedLimits || {
    downloadLimit: "0",
    uploadLimit: "0",
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newProf = { ...profile, avatar: reader.result };
        setProfile(newProf);
        window.api.updateProfile(newProf);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNameChange = (e) => {
    const newProf = { ...profile, name: e.target.value };
    setProfile(newProf);
    window.api.updateProfile(newProf);
  };

  const handleDirectorySelect = async () => {
    const newPath = await window.api.selectDirectory();
    if (newPath) {
      const newProf = { ...profile, downloadPath: newPath };
      setProfile(newProf);
      window.api.updateProfile(newProf);
    }
  };

  const handleCloudFolderSelect = async () => {
    const newPath = await window.api.selectDirectory();
    if (newPath) {
      const newCloud = { ...cloudSync, folderPath: newPath };
      const newProf = { ...profile, cloudSync: newCloud };
      setProfile(newProf);
      window.api.updateProfile(newProf);
    }
  };

  const handleLiteModeToggle = () => {
    const newProf = { ...profile, liteMode: !profile.liteMode };
    setProfile(newProf);
    window.api.updateProfile(newProf);
  };

  const handleAutoExtractToggle = () => {
    const isCurrentlyOn = profile.autoExtract !== false;
    const newProf = { ...profile, autoExtract: !isCurrentlyOn };
    setProfile(newProf);
    window.api.updateProfile(newProf);
  };

  const handleAutoCloudBackupToggle = () => {
    const newProf = { ...profile, autoCloudBackup: profile.autoCloudBackup === false ? true : false };
    setProfile(newProf);
    window.api.updateProfile(newProf);
  };

  const handleCloudSyncToggle = () => {
    const newCloud = { ...cloudSync, enabled: !cloudSync.enabled };
    const newProf = { ...profile, cloudSync: newCloud };
    setProfile(newProf);
    window.api.updateProfile(newProf);
  };

  const handleCloudSyncTypeChange = (type) => {
    const newCloud = { ...cloudSync, type };
    const newProf = { ...profile, cloudSync: newCloud };
    setProfile(newProf);
    window.api.updateProfile(newProf);
    setWebDAVStatus(null);
  };

  const handleWebDAVChange = (field, val) => {
    const newCloud = { ...cloudSync, [field]: val };
    const newProf = { ...profile, cloudSync: newCloud };
    setProfile(newProf);
    window.api.updateProfile(newProf);
    setWebDAVStatus(null);
  };

  const handleTestWebDAV = async () => {
    if (!cloudSync.webdavUrl || !cloudSync.webdavUrl.trim()) {
      if (setToast) setToast("Please enter a WebDAV URL first");
      return;
    }
    setTestingWebDAV(true);
    try {
      const res = await window.api.testWebDAV(cloudSync);
      setWebDAVStatus(res);
      if (res.valid) {
        if (setToast) setToast("WebDAV server connected successfully! ☁️");
      } else {
        if (setToast) setToast(`WebDAV error: ${res.message}`);
      }
    } catch (e) {
      setWebDAVStatus({ valid: false, message: e.message });
    } finally {
      setTestingWebDAV(false);
    }
  };

  const handleSpeedLimitChange = async (limit) => {
    const newLimits = { ...speedLimits, downloadLimit: limit };
    const newProf = { ...profile, speedLimits: newLimits };
    setProfile(newProf);
    await window.api.updateProfile(newProf);
    if (window.api.setSpeedLimits) {
      await window.api.setSpeedLimits(limit, speedLimits.uploadLimit || "0");
    }
    if (setToast) setToast(`Download bandwidth cap set to: ${limit === "0" ? "Unlimited" : limit}`);
  };

  const handleDebridToggle = () => {
    const newProf = {
      ...profile,
      debrid: { ...debrid, enabled: !debrid.enabled },
    };
    setProfile(newProf);
    window.api.updateProfile(newProf);
  };

  const handleDebridProviderChange = (provider) => {
    const newProf = {
      ...profile,
      debrid: { ...debrid, provider },
    };
    setProfile(newProf);
    window.api.updateProfile(newProf);
    setDebridStatus(null);
  };

  const handleDebridKeyChange = (apiKey) => {
    const newProf = {
      ...profile,
      debrid: { ...debrid, apiKey },
    };
    setProfile(newProf);
    window.api.updateProfile(newProf);
    setDebridStatus(null);
  };

  const handleVerifyDebrid = async () => {
    if (!debrid.apiKey || !debrid.apiKey.trim()) {
      if (setToast) setToast("Please enter an API key first");
      return;
    }

    setValidatingDebrid(true);
    try {
      const res = await window.api.validateDebridKey(debrid.provider, debrid.apiKey);
      setDebridStatus(res);
      if (res.valid) {
        if (setToast) setToast(`Connected to ${res.provider}! (${res.username})`);
      } else {
        if (setToast) setToast(`Debrid error: ${res.message}`);
      }
    } catch (e) {
      setDebridStatus({ valid: false, message: e.message });
    } finally {
      setValidatingDebrid(false);
    }
  };

  return (
    <div className="p-12 max-w-4xl mx-auto w-full flex flex-col gap-8">
      <h2
        className={`text-4xl font-black bg-clip-text text-transparent bg-linear-to-r ${currentTheme.textGradient}`}
      >
        Profile Settings
      </h2>

      {/* User Profile Card */}
      <div className="bg-black/40 backdrop-blur-3xl border border-white/10 p-10 rounded-3xl flex flex-col items-center gap-8 shadow-2xl relative overflow-hidden">
        <div
          className={`absolute top-0 left-0 w-full h-1.5 bg-linear-to-r ${currentTheme.textGradient}`}
        />
        <div className="relative group cursor-pointer">
          <div className="w-40 h-40 rounded-full bg-black/60 border-4 border-white/10 overflow-hidden shadow-2xl">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                className="w-full h-full object-cover"
              />
            ) : (
              <User size={80} className="m-10 text-gray-500" />
            )}
          </div>
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex flex-col items-center justify-center">
            <ImageIcon size={30} className={currentTheme.iconColor} />
            <span className="text-xs font-bold mt-2">Upload Avatar</span>
          </div>
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleAvatarUpload}
          />
        </div>

        <div className="w-full text-center">
          <label
            className={`text-xs font-black uppercase tracking-widest mb-2 block ${currentTheme.iconColor}`}
          >
            Username
          </label>
          <input
            type="text"
            value={profile.name}
            onChange={handleNameChange}
            className="bg-black/60 border border-white/10 rounded-xl px-6 py-3 w-72 text-center font-bold text-2xl focus:outline-none focus:border-white/30 text-white hover:bg-black/80 transition-all"
          />
        </div>
      </div>

      {/* Download Directory */}
      <div className="bg-black/40 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col justify-center">
        <div
          className={`absolute top-0 left-0 w-1.5 h-full bg-linear-to-b ${currentTheme.textGradient}`}
        />
        <label
          className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${currentTheme.iconColor}`}
        >
          <HardDrive size={16} /> Download & Games Directory
        </label>
        <div className="flex gap-4 items-center">
          <input
            type="text"
            readOnly
            value={profile.downloadPath || ""}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none cursor-default font-mono truncate"
          />
          <button
            onClick={handleDirectorySelect}
            className={`px-6 py-3 rounded-xl font-bold tracking-wider text-xs transition-all shadow-lg border border-white/10 hover:scale-105 active:scale-95 ${currentTheme.activeBg}`}
          >
            CHANGE
          </button>
        </div>
      </div>

      {/* ── Bandwidth Speed Limiter Card ── */}
      <div className="bg-black/40 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col gap-6">
        <div
          className={`absolute top-0 left-0 w-1.5 h-full bg-linear-to-b ${currentTheme.textGradient}`}
        />
        <div>
          <label
            className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${currentTheme.iconColor}`}
          >
            <Gauge size={16} /> Download Speed Limit
          </label>
          <p className="text-sm text-gray-400 font-medium mt-1">
            Throttle Aria2 download bandwidth to prevent network saturation during gaming or streaming.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          {[
            { label: "Unlimited", value: "0" },
            { label: "5 MB/s", value: "5M" },
            { label: "10 MB/s", value: "10M" },
            { label: "20 MB/s", value: "20M" },
            { label: "50 MB/s", value: "50M" },
          ].map((preset) => (
            <button
              key={preset.value}
              onClick={() => handleSpeedLimitChange(preset.value)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                (speedLimits.downloadLimit || "0") === preset.value
                  ? `${currentTheme.activeBg} border-white/20 shadow-md text-white`
                  : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cloud Save Remote Sync Card (Google Drive / OneDrive / WebDAV) ── */}
      <div className="bg-black/40 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col gap-6">
        <div
          className={`absolute top-0 left-0 w-1.5 h-full bg-linear-to-b ${currentTheme.textGradient}`}
        />
        <div className="flex items-center justify-between">
          <div>
            <label
              className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${currentTheme.iconColor}`}
            >
              <CloudSync size={16} /> Cloud Save Multi-Device Sync
            </label>
            <p className="text-sm text-gray-400 font-medium mt-1">
              Automatically sync save snapshots to your Google Drive, OneDrive, Dropbox, or custom WebDAV server for cross-device progression.
            </p>
          </div>
          <button
            onClick={handleCloudSyncToggle}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 border border-white/10 ${cloudSync.enabled ? currentTheme.color : "bg-black"}`}
          >
            <div
              className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${cloudSync.enabled ? "translate-x-6" : ""}`}
            />
          </button>
        </div>

        {cloudSync.enabled && (
          <div className="flex flex-col gap-4 pt-4 border-t border-white/10">
            <div className="flex gap-3">
              <button
                onClick={() => handleCloudSyncTypeChange("folder")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                  cloudSync.type === "folder"
                    ? `${currentTheme.activeBg} border-white/20 shadow-md text-white`
                    : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                }`}
              >
                <FolderOpen size={14} /> Cloud Storage Folder (Google Drive / OneDrive / Dropbox)
              </button>
              <button
                onClick={() => handleCloudSyncTypeChange("webdav")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                  cloudSync.type === "webdav"
                    ? `${currentTheme.activeBg} border-white/20 shadow-md text-white`
                    : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                }`}
              >
                <Server size={14} /> WebDAV Server (Nextcloud / NAS)
              </button>
            </div>

            {cloudSync.type === "folder" ? (
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Target Cloud Folder Path
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="text"
                    readOnly
                    placeholder="Select your Google Drive, OneDrive, or Dropbox folder..."
                    value={cloudSync.folderPath || ""}
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none font-mono truncate"
                  />
                  <button
                    onClick={handleCloudFolderSelect}
                    className={`px-6 py-3 rounded-xl font-bold tracking-wider text-xs transition-all shadow-lg border border-white/10 hover:scale-105 active:scale-95 ${currentTheme.activeBg}`}
                  >
                    BROWSE
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    WebDAV Server Endpoint URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://nextcloud.example.com/remote.php/dav/files/user/"
                    value={cloudSync.webdavUrl || ""}
                    onChange={(e) => handleWebDAVChange("webdavUrl", e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-gray-200 focus:outline-none focus:border-white/30 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Username
                    </label>
                    <input
                      type="text"
                      placeholder="Username"
                      value={cloudSync.webdavUser || ""}
                      onChange={(e) => handleWebDAVChange("webdavUser", e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-gray-200 focus:outline-none focus:border-white/30 font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1 relative">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Password / App Token
                    </label>
                    <div className="relative">
                      <input
                        type={showWebDAVPass ? "text" : "password"}
                        placeholder="Password or App Token"
                        value={cloudSync.webdavPass || ""}
                        onChange={(e) => handleWebDAVChange("webdavPass", e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl py-2.5 pl-4 pr-10 text-sm text-gray-200 focus:outline-none focus:border-white/30 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebDAVPass(!showWebDAVPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showWebDAVPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={handleTestWebDAV}
                    disabled={testingWebDAV}
                    className={`px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs transition-all shadow-lg border border-white/10 hover:scale-105 active:scale-95 ${currentTheme.activeBg} flex items-center gap-2`}
                  >
                    {testingWebDAV ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Testing...
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={14} /> Test Connection
                      </>
                    )}
                  </button>

                  {webDAVStatus && (
                    <div
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                        webDAVStatus.valid
                          ? "bg-green-500/10 border-green-500/30 text-green-300"
                          : "bg-red-500/10 border-red-500/30 text-red-300"
                      }`}
                    >
                      {webDAVStatus.valid ? (
                        <CheckCircle size={15} className="text-green-400 shrink-0" />
                      ) : (
                        <AlertCircle size={15} className="text-red-400 shrink-0" />
                      )}
                      <span>{webDAVStatus.message}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Debrid Service Integration ── */}
      <div className="bg-black/40 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col gap-6">
        <div
          className={`absolute top-0 left-0 w-1.5 h-full bg-linear-to-b ${currentTheme.textGradient}`}
        />
        <div className="flex items-center justify-between">
          <div>
            <label
              className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${currentTheme.iconColor}`}
            >
              <Link size={16} /> Debrid Service Integration
            </label>
            <p className="text-sm text-gray-400 font-medium mt-1">
              Unrestrict file hoster links and download magnets at maximum ISP speeds without captchas.
            </p>
          </div>
          <button
            onClick={handleDebridToggle}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 border border-white/10 ${debrid.enabled ? currentTheme.color : "bg-black"}`}
          >
            <div
              className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${debrid.enabled ? "translate-x-6" : ""}`}
            />
          </button>
        </div>

        {debrid.enabled && (
          <div className="flex flex-col gap-4 pt-4 border-t border-white/10">
            <div className="flex gap-3 flex-wrap">
              {[
                { id: "realdebrid", label: "Real-Debrid" },
                { id: "alldebrid", label: "AllDebrid" },
                { id: "torbox", label: "Torbox" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleDebridProviderChange(p.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    debrid.provider === p.id
                      ? `${currentTheme.activeBg} border-white/20 shadow-md`
                      : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  placeholder={`Enter your ${debrid.provider === "realdebrid" ? "Real-Debrid" : debrid.provider === "alldebrid" ? "AllDebrid" : "Torbox"} API Key / Token...`}
                  value={debrid.apiKey || ""}
                  onChange={(e) => handleDebridKeyChange(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-gray-200 focus:outline-none focus:border-white/30 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <button
                onClick={handleVerifyDebrid}
                disabled={validatingDebrid}
                className={`px-6 py-3 rounded-xl font-bold tracking-wider text-xs transition-all shadow-lg border border-white/10 hover:scale-105 active:scale-95 shrink-0 ${currentTheme.activeBg} flex items-center gap-2`}
              >
                {validatingDebrid ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Verifying...
                  </>
                ) : (
                  "Test & Connect"
                )}
              </button>
            </div>

            {/* Validation status pill */}
            {debridStatus && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  debridStatus.valid
                    ? "bg-green-500/10 border-green-500/30 text-green-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                {debridStatus.valid ? (
                  <CheckCircle size={15} className="text-green-400 shrink-0" />
                ) : (
                  <AlertCircle size={15} className="text-red-400 shrink-0" />
                )}
                <span>
                  {debridStatus.valid
                    ? `Connected: ${debridStatus.username} (${debridStatus.isPremium ? "Premium Active" : "Free Tier"})`
                    : debridStatus.message}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Auto-Extraction Setting ── */}
      <div className="bg-black/40 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col justify-center">
        <div
          className={`absolute top-0 left-0 w-1.5 h-full bg-linear-to-b ${currentTheme.textGradient}`}
        />
        <div className="flex items-center justify-between">
          <div>
            <label
              className={`text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${currentTheme.iconColor}`}
            >
              <Archive size={16} /> Auto-Extract & Cleanup Archives
            </label>
            <p className="text-sm text-gray-400 font-medium mt-1">
              Automatically extracts game downloads (.zip, .rar, .7z, setup files) directly into your games directory, renames the folder to the game name, and permanently cleans up source archive files upon success.
            </p>
          </div>
          <button
            onClick={handleAutoExtractToggle}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 border border-white/10 ${profile.autoExtract !== false ? currentTheme.color : "bg-black"}`}
          >
            <div
              className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${profile.autoExtract !== false ? "translate-x-6" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* ── Cloud Save Auto-Backup Setting ── */}
      <div className="bg-black/40 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col justify-center">
        <div
          className={`absolute top-0 left-0 w-1.5 h-full bg-linear-to-b ${currentTheme.textGradient}`}
        />
        <div className="flex items-center justify-between">
          <div>
            <label
              className={`text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${currentTheme.iconColor}`}
            >
              <Cloud size={16} /> Cloud Save Auto-Backup
            </label>
            <p className="text-sm text-gray-400 font-medium mt-1">
              Automatically creates timestamped zip backups of your game saves when you exit a game so you never lose progress.
            </p>
          </div>
          <button
            onClick={handleAutoCloudBackupToggle}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 border border-white/10 ${profile.autoCloudBackup !== false ? currentTheme.color : "bg-black"}`}
          >
            <div
              className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${profile.autoCloudBackup !== false ? "translate-x-6" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* ── Discord Rich Presence Setting ── */}
      <div className="bg-black/40 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col justify-center">
        <div
          className={`absolute top-0 left-0 w-1.5 h-full bg-linear-to-b ${currentTheme.textGradient}`}
        />
        <div className="flex items-center justify-between">
          <div>
            <label
              className={`text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${currentTheme.iconColor}`}
            >
              <Radio size={16} /> Discord Rich Presence (RPC)
            </label>
            <p className="text-sm text-gray-400 font-medium mt-1">
              Displays your currently playing game title and elapsed session playtime on your Discord profile automatically.
            </p>
          </div>
          <button
            onClick={() => {
              const isCurrentlyOn = profile.discordRpc !== false;
              const newProf = { ...profile, discordRpc: !isCurrentlyOn };
              setProfile(newProf);
              window.api.updateProfile(newProf);
            }}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 border border-white/10 ${profile.discordRpc !== false ? currentTheme.color : "bg-black"}`}
          >
            <div
              className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${profile.discordRpc !== false ? "translate-x-6" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* ── Smart In-Game Download Auto-Pause ── */}
      <div className="bg-black/40 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col justify-center">
        <div
          className={`absolute top-0 left-0 w-1.5 h-full bg-linear-to-b ${currentTheme.textGradient}`}
        />
        <div className="flex items-center justify-between">
          <div>
            <label
              className={`text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${currentTheme.iconColor}`}
            >
              <PauseCircle size={16} /> Smart In-Game Network Auto-Pause
            </label>
            <p className="text-sm text-gray-400 font-medium mt-1">
              Automatically pauses background downloads when a game is launched so multiplayer latency and disk speed stay optimal.
            </p>
          </div>
          <button
            onClick={() => {
              const isCurrentlyOn = profile.autoPauseDownloadsInGame !== false;
              const newProf = { ...profile, autoPauseDownloadsInGame: !isCurrentlyOn };
              setProfile(newProf);
              window.api.updateProfile(newProf);
            }}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 border border-white/10 ${profile.autoPauseDownloadsInGame !== false ? currentTheme.color : "bg-black"}`}
          >
            <div
              className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${profile.autoPauseDownloadsInGame !== false ? "translate-x-6" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* ── Download Scheduler (Off-Peak Hours) ── */}
      <div className="bg-black/40 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col gap-5">
        <div
          className={`absolute top-0 left-0 w-1.5 h-full bg-linear-to-b ${currentTheme.textGradient}`}
        />
        <div className="flex items-center justify-between">
          <div>
            <label
              className={`text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${currentTheme.iconColor}`}
            >
              <Clock size={16} /> Download Scheduler (Off-Peak Hours)
            </label>
            <p className="text-sm text-gray-400 font-medium mt-1">
              Restrict downloads to specific off-peak hours (e.g. late night) to conserve bandwidth.
            </p>
          </div>
          <button
            onClick={() => {
              const currentSched = profile.downloadSchedule || { enabled: false, startHour: 1, startMinute: 0, endHour: 7, endMinute: 0 };
              const newSched = { ...currentSched, enabled: !currentSched.enabled };
              const newProf = { ...profile, downloadSchedule: newSched };
              setProfile(newProf);
              window.api.updateProfile(newProf);
            }}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 border border-white/10 ${profile.downloadSchedule?.enabled ? currentTheme.color : "bg-black"}`}
          >
            <div
              className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${profile.downloadSchedule?.enabled ? "translate-x-6" : ""}`}
            />
          </button>
        </div>

        {profile.downloadSchedule?.enabled && (
          <div className="flex items-center gap-4 pt-4 border-t border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-400">Start Time:</span>
              <input
                type="number"
                min="0"
                max="23"
                value={profile.downloadSchedule.startHour || 0}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                  const newSched = { ...profile.downloadSchedule, startHour: val };
                  const newProf = { ...profile, downloadSchedule: newSched };
                  setProfile(newProf);
                  window.api.updateProfile(newProf);
                }}
                className="w-16 bg-black/60 border border-white/10 rounded-lg p-2 text-center text-white font-mono"
              />
              <span className="text-gray-400">:00</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-400">End Time:</span>
              <input
                type="number"
                min="0"
                max="23"
                value={profile.downloadSchedule.endHour || 0}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                  const newSched = { ...profile.downloadSchedule, endHour: val };
                  const newProf = { ...profile, downloadSchedule: newSched };
                  setProfile(newProf);
                  window.api.updateProfile(newProf);
                }}
                className="w-16 bg-black/60 border border-white/10 rounded-lg p-2 text-center text-white font-mono"
              />
              <span className="text-gray-400">:00</span>
            </div>
          </div>
        )}
      </div>

      {/* Lite Mode */}
      <div className="bg-black/40 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col justify-center">
        <div
          className={`absolute top-0 left-0 w-1.5 h-full bg-linear-to-b ${currentTheme.textGradient}`}
        />
        <div className="flex items-center justify-between">
          <div>
            <label
              className={`text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${currentTheme.iconColor}`}
            >
              <Zap size={16} /> Lite Mode (Performance)
            </label>
            <p className="text-sm text-gray-400 font-medium mt-1">
              Disables heavy animations, rendering blurs, and graphical effects
              for a snappier experience.
            </p>
          </div>
          <button
            onClick={handleLiteModeToggle}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 border border-white/10 ${profile.liteMode ? currentTheme.color : "bg-black"}`}
          >
            <div
              className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${profile.liteMode ? "translate-x-6" : ""}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}


