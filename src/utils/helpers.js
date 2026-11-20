export const formatBytes = (bytes) => {
  if (!+bytes) return "0 Bytes";
  const k = 1024,
    sizes = ["B", "KB", "MB", "GB", "TB"],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatPlaytime = (seconds) => {
  if (!seconds || seconds <= 0) return "Never played";
  if (seconds < 60) return "< 1 min";
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins} ${mins === 1 ? "min" : "mins"}`;
  }
  const hours = (seconds / 3600).toFixed(1);
  return `${hours} hrs`;
};

export const formatLastPlayed = (isoDate) => {
  if (!isoDate) return "Never";
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return "Never";
    
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "Never";
  }
};

