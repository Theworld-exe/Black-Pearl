import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  Layers,
  Zap,
  FileText,
  AlertCircle,
  Store,
  Download,
  CheckCircle,
  Loader2,
  Search,
} from "lucide-react";

export default function ExtensionManagerModal({
  isOpen,
  onClose,
  currentTheme,
  extensions,
  setExtensions,
  activeExt,
  handleSelectExtension,
  setToast,
}) {
  const [activeTab, setActiveTab] = useState("installed"); // "installed" | "marketplace"
  const [extDetails, setExtDetails] = useState([]);
  const [marketplaceList, setMarketplaceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingName, setDeletingName] = useState(null);
  const [installingName, setInstallingName] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const refreshDetails = async () => {
    if (!window.api?.getExtensionsDetails) return;
    try {
      const details = await window.api.getExtensionsDetails();
      setExtDetails(details);
      if (window.api?.getMarketplaceExtensions) {
        const market = await window.api.getMarketplaceExtensions();
        setMarketplaceList(market);
      }
    } catch (e) {
      console.error("Failed to fetch extension details", e);
    }
  };

  useEffect(() => {
    let active = true;
    if (isOpen) {
      setLoading(true);
      refreshDetails().finally(() => {
        if (active) setLoading(false);
      });
    }
    return () => {
      active = false;
    };
  }, [isOpen, extensions]);

  const handleDelete = async (name) => {
    setDeletingName(name);
    try {
      const res = await window.api.deleteExtension(name);
      if (res.success) {
        setToast(`Extension '${name}' removed successfully`);
        setExtensions(res.remaining);
        if (res.activeExt) {
          handleSelectExtension(res.activeExt);
        } else if (res.remaining.length > 0) {
          handleSelectExtension(res.remaining[0]);
        }
        await refreshDetails();
      } else {
        setToast(`Delete failed: ${res.message}`);
      }
    } catch (err) {
      setToast(`Error: ${err.message}`);
    } finally {
      setDeletingName(null);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleInstallFromMarketplace = async (marketItem) => {
    setInstallingName(marketItem.name);
    try {
      const res = await window.api.installExtension({
        url: marketItem.url,
        name: marketItem.name,
        id: marketItem.id,
      });
      if (res.success) {
        setToast(`Installed ${marketItem.name} successfully! 🚀`);
        const exts = await window.api.getExtensions();
        setExtensions(exts);
        await refreshDetails();
      } else {
        setToast(`Install failed: ${res.message}`);
      }
    } catch (err) {
      setToast(`Error: ${err.message}`);
    } finally {
      setInstallingName(null);
      setTimeout(() => setToast(null), 4000);
    }
  };

  if (!isOpen) return null;

  const filteredMarketplace = marketplaceList.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.tags && item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))),
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#0a0a0d] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative"
        >
          <div className={`absolute top-0 left-0 w-full h-1.5 bg-linear-to-r ${currentTheme.textGradient}`} />

          {/* Header & Tabs */}
          <div className="p-6 border-b border-white/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
                  <Layers className={currentTheme.iconColor} size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-wider">
                    Extension Hub
                  </h3>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    Community scrapers, torrent mirrors, and direct download providers
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

            {/* Tab Selector */}
            <div className="flex gap-2 p-1 bg-black/40 border border-white/5 rounded-2xl">
              <button
                onClick={() => setActiveTab("installed")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === "installed"
                    ? `${currentTheme.activeBg} text-white shadow-md`
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Layers size={14} /> Installed ({extDetails.length})
              </button>

              <button
                onClick={() => setActiveTab("marketplace")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === "marketplace"
                    ? `${currentTheme.activeBg} text-white shadow-md`
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Store size={14} /> Community Marketplace ({marketplaceList.length})
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4 no-scrollbar">
            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 skeleton rounded-2xl" />
                ))}
              </div>
            ) : activeTab === "installed" ? (
              /* ── Tab 1: Installed Extensions ── */
              extDetails.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle size={40} className="mx-auto mb-2 opacity-50" />
                  <p className="font-bold">No extensions installed yet</p>
                </div>
              ) : (
                extDetails.map((ext) => {
                  const isActive = activeExt === ext.name;
                  const hasStreaming = !!ext.capabilities?.hasStreaming;
                  const hasCatPagination = !!ext.capabilities?.hasCategoryPagination;
                  const hasSearchPagination = !!ext.capabilities?.hasSearchPagination;

                  return (
                    <div
                      key={ext.name}
                      className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isActive
                          ? "bg-white/5 border-white/20 shadow-lg"
                          : "bg-black/40 border-white/5 hover:border-white/10"
                      }`}
                    >
                      <div className="flex flex-col gap-2 min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-black text-base text-white truncate">
                            {ext.name}
                          </span>
                          {isActive && (
                            <span
                              className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${currentTheme.activeBg} border border-white/10`}
                            >
                              Active Source
                            </span>
                          )}
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/5">
                            {ext.isCustom ? "Custom Plugin" : "Built-in"}
                          </span>
                        </div>

                        {/* Capabilities badges */}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400">
                          {hasStreaming && (
                            <span className="flex items-center gap-1 text-[11px] text-amber-300/90 font-medium">
                              <Zap size={12} className="text-amber-400" /> Live Stream Scraping
                            </span>
                          )}
                          {(hasCatPagination || hasSearchPagination) && (
                            <span className="flex items-center gap-1 text-[11px] text-blue-300/90 font-medium">
                              <FileText size={12} className="text-blue-400" /> Pagination
                            </span>
                          )}
                          <span className="text-[11px] text-gray-500">
                            {ext.categories?.length || 0} Categories
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isActive && (
                          <button
                            onClick={() => {
                              handleSelectExtension(ext.name);
                              onClose();
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-white/10 hover:border-white/30 bg-white/5 text-gray-200 hover:text-white`}
                          >
                            Select
                          </button>
                        )}
                        {ext.isCustom && (
                          <button
                            onClick={() => handleDelete(ext.name)}
                            disabled={deletingName === ext.name}
                            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all disabled:opacity-50"
                            title="Delete Extension"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              /* ── Tab 2: Community Marketplace ── */
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search community scrapers & plugins..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  {filteredMarketplace.map((market) => (
                    <div
                      key={market.name}
                      className="p-5 rounded-2xl bg-black/40 border border-white/5 hover:border-white/15 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex flex-col gap-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-black text-base text-white">
                            {market.name}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            v{market.version} by {market.author}
                          </span>
                          {market.isInstalled && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 flex items-center gap-1">
                              <CheckCircle size={10} /> Installed
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-400 line-clamp-2">
                          {market.description}
                        </p>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {market.tags?.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/5 text-gray-300 border border-white/5"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {market.isInstalled ? (
                          <button
                            disabled
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/5 text-gray-500 cursor-default"
                          >
                            Up to Date
                          </button>
                        ) : (
                          <button
                            onClick={() => handleInstallFromMarketplace(market)}
                            disabled={installingName === market.name}
                            className={`px-4 py-2 rounded-xl text-xs font-bold ${currentTheme.color} text-black hover:brightness-110 transition-all shadow-md flex items-center gap-1.5`}
                          >
                            {installingName === market.name ? (
                              <>
                                <Loader2 size={13} className="animate-spin" /> Installing...
                              </>
                            ) : (
                              <>
                                <Download size={13} /> 1-Click Install
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end">
            <button
              onClick={onClose}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs ${currentTheme.color} text-black shadow-lg hover:brightness-110 transition-all`}
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

