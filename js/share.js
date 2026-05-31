import {
  createSong,
  createBreak,
  DEFAULT_GIG_NAME,
  DEFAULT_GIG_DESCRIPTION,
  normalizeBpm,
} from "./storage.js";

/** @typedef {import('./storage.js').ListItem} ListItem */

/** @typedef {{ name: string, description: string, items: ListItem[] }} ShareState */

const SEGMENT_SEP = "|";

function encodeSegment(text) {
  return encodeURIComponent(text);
}

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment.replace(/\+/g, " "));
  } catch {
    return segment;
  }
}

function fromBase64Url(encoded) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** @param {ListItem} item */
function encodeItem(item) {
  if (item.type === "break") {
    return item.title ? `-${item.title}` : "-";
  }
  return item.bpm != null ? `${item.title} ${item.bpm}` : item.title;
}

/** @param {string} text @returns {ListItem | null} */
function parseListEntry(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("-")) {
    return createBreak(trimmed.slice(1).trim());
  }

  const match = trimmed.match(/^(.+?)\s+(\d{1,3})$/);
  if (match) {
    const bpm = normalizeBpm(match[2]);
    if (bpm != null) {
      return createSong(match[1].trim(), bpm);
    }
  }

  return createSong(trimmed, null);
}

/** @param {ShareState} state */
export function encodeShareState(state) {
  const parts = [
    state.name,
    state.description,
    ...state.items.map(encodeItem),
  ];
  return `g=${parts.map(encodeSegment).join(SEGMENT_SEP)}`;
}

/** @param {unknown} entry */
function itemFromLegacyPayload(entry) {
  if (!Array.isArray(entry) || entry.length === 0) return null;

  if (entry[0] === "b") {
    return createBreak(typeof entry[1] === "string" ? entry[1] : "");
  }

  if (entry[0] === "s") {
    const title = typeof entry[1] === "string" ? entry[1] : "";
    const bpm = entry.length > 2 ? entry[2] : null;
    return createSong(title, bpm);
  }

  return null;
}

/** @param {string} payload @returns {ShareState | null} */
function decodeLegacyPayload(payload) {
  try {
    const data = JSON.parse(fromBase64Url(payload));
    if (!data || typeof data !== "object") return null;

    const items = Array.isArray(data.i)
      ? data.i.map(itemFromLegacyPayload).filter(Boolean)
      : [];

    return {
      name:
        typeof data.n === "string" && data.n.trim()
          ? data.n.trim()
          : DEFAULT_GIG_NAME,
      description:
        typeof data.d === "string" && data.d.trim()
          ? data.d.trim()
          : DEFAULT_GIG_DESCRIPTION,
      items,
    };
  } catch {
    return null;
  }
}

/** @param {string} payload @returns {ShareState | null} */
function decodeSimplePayload(payload) {
  const parts = payload.split(SEGMENT_SEP).map(decodeSegment);
  if (parts.length < 2) return null;

  const name = parts[0].trim() || DEFAULT_GIG_NAME;
  const description = parts[1].trim() || DEFAULT_GIG_DESCRIPTION;
  const items = parts.slice(2).map(parseListEntry).filter(Boolean);

  return { name, description, items };
}

function isLegacyPayload(payload) {
  return /^[A-Za-z0-9_-]+$/.test(payload) && payload.startsWith("eyJ");
}

/** @param {string} hash @returns {ShareState | null} */
export function decodeShareHash(hash) {
  const match = hash.match(/^#?g=(.+)$/);
  if (!match) return null;

  const payload = match[1];
  if (isLegacyPayload(payload)) {
    return decodeLegacyPayload(payload);
  }

  return decodeSimplePayload(payload);
}

/** @param {ShareState} state */
export function updateShareUrl(state) {
  const hash = encodeShareState(state);
  const url = `${window.location.pathname}${window.location.search}#${hash}`;
  history.replaceState(null, "", url);
}

/** @returns {ShareState | null} */
export function loadSharedState() {
  return decodeShareHash(window.location.hash);
}
