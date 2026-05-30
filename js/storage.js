const STORAGE_KEY = "bpmlist-songs";

/** @typedef {{ id: string, title: string, bpm: number | null }} Song */

/** @returns {Song[]} */
export function loadSongs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSong);
  } catch {
    return [];
  }
}

/** @param {Song[]} songs */
export function saveSongs(songs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
}

/** @returns {Song} */
export function createSong(title = "", bpm = null) {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    bpm: normalizeBpm(bpm),
  };
}

/** @param {unknown} song */
function isValidSong(song) {
  return (
    song &&
    typeof song === "object" &&
    typeof song.id === "string" &&
    typeof song.title === "string" &&
    (song.bpm === null || (typeof song.bpm === "number" && song.bpm >= 20))
  );
}

/** @param {unknown} value */
export function normalizeBpm(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Math.round(Number(value));
  if (!n || n < 20 || n > 400) return null;
  return n;
}
