const STORAGE_KEY = "bpmlist-songs";

/** @typedef {{ id: string, type: 'song', title: string, bpm: number | null }} Song */
/** @typedef {{ id: string, type: 'break', title: string }} Break */
/** @typedef {Song | Break} ListItem */

/** @returns {ListItem[]} */
export function loadSongs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem);
  } catch {
    return [];
  }
}

/** @param {ListItem[]} items */
export function saveSongs(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** @returns {Song} */
export function createSong(title = "", bpm = null) {
  return {
    id: crypto.randomUUID(),
    type: "song",
    title: title.trim(),
    bpm: normalizeBpm(bpm),
  };
}

/** @returns {Break} */
export function createBreak(title = "") {
  return {
    id: crypto.randomUUID(),
    type: "break",
    title: title.trim(),
  };
}

/** @param {ListItem} item */
export function isSong(item) {
  return item.type !== "break";
}

/** @param {unknown} item */
function isValidItem(item) {
  if (!item || typeof item !== "object" || typeof item.id !== "string") {
    return false;
  }

  if (item.type === "break") {
    return typeof item.title === "string";
  }

  return (
    typeof item.title === "string" &&
    (item.bpm === null ||
      item.bpm === undefined ||
      (typeof item.bpm === "number" && item.bpm >= 20))
  );
}

const GIG_NAME_KEY = "bpmlist-gig-name";
const DEFAULT_GIG_NAME = "Your Gig";

/** @returns {string} */
export function loadGigName() {
  const name = localStorage.getItem(GIG_NAME_KEY);
  return name?.trim() || DEFAULT_GIG_NAME;
}

/** @param {string} name @returns {string} */
export function saveGigName(name) {
  const trimmed = name.trim() || DEFAULT_GIG_NAME;
  localStorage.setItem(GIG_NAME_KEY, trimmed);
  return trimmed;
}

export { DEFAULT_GIG_NAME };

const GIG_DESC_KEY = "bpmlist-gig-description";
const DEFAULT_GIG_DESCRIPTION = "Your gig setlist with tempo reference.";

/** @returns {string} */
export function loadGigDescription() {
  const desc = localStorage.getItem(GIG_DESC_KEY);
  return desc?.trim() || DEFAULT_GIG_DESCRIPTION;
}

/** @param {string} description @returns {string} */
export function saveGigDescription(description) {
  const trimmed = description.trim() || DEFAULT_GIG_DESCRIPTION;
  localStorage.setItem(GIG_DESC_KEY, trimmed);
  return trimmed;
}

export { DEFAULT_GIG_DESCRIPTION };

/** @param {unknown} value */
export function normalizeBpm(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Math.round(Number(value));
  if (!n || n < 20 || n > 400) return null;
  return n;
}
