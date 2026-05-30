import {
  createSong,
  createBreak,
  DEFAULT_GIG_NAME,
  DEFAULT_GIG_DESCRIPTION,
} from "./storage.js";

/** @typedef {import('./storage.js').ListItem} ListItem */

/** @typedef {{ name: string, description: string, items: ListItem[] }} ShareState */

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(encoded) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** @param {ShareState} state */
export function encodeShareState(state) {
  /** @type {{ n?: string, d?: string, i: unknown[] }} */
  const payload = {
    i: state.items.map((item) => {
      if (item.type === "break") {
        return item.title ? ["b", item.title] : ["b"];
      }
      return item.bpm != null ? ["s", item.title, item.bpm] : ["s", item.title];
    }),
  };

  if (state.name !== DEFAULT_GIG_NAME) payload.n = state.name;
  if (state.description !== DEFAULT_GIG_DESCRIPTION) payload.d = state.description;

  return `g=${toBase64Url(JSON.stringify(payload))}`;
}

/** @param {unknown} entry */
function itemFromPayload(entry) {
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

/** @param {string} hash @returns {ShareState | null} */
export function decodeShareHash(hash) {
  const match = hash.match(/^#?g=([A-Za-z0-9_-]+)$/);
  if (!match) return null;

  try {
    const data = JSON.parse(fromBase64Url(match[1]));
    if (!data || typeof data !== "object") return null;

    const items = Array.isArray(data.i)
      ? data.i.map(itemFromPayload).filter(Boolean)
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
