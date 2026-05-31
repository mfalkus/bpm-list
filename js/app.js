import { Metronome } from "./metronome.js";
import { TapTempo } from "./tap-tempo.js";
import {
  loadSongs,
  saveSongs,
  createSong,
  createBreak,
  isSong,
  normalizeBpm,
  loadGigName,
  saveGigName,
  DEFAULT_GIG_NAME,
  loadGigDescription,
  saveGigDescription,
} from "./storage.js";
import { loadSharedState, updateShareUrl } from "./share.js";

const songList = document.getElementById("song-list");
const emptyState = document.getElementById("empty-state");
const addBar = document.getElementById("add-bar");
const addForm = document.getElementById("add-form");
const newTitleInput = document.getElementById("new-title");
const newBpmInput = document.getElementById("new-bpm");
const rowTemplate = document.getElementById("song-row-template");
const breakRowTemplate = document.getElementById("break-row-template");
const themeToggle = document.getElementById("theme-toggle");
const volumeSlider = document.getElementById("volume-slider");
const gigTimeBtn = document.getElementById("gig-time-btn");
const appEl = document.getElementById("app");
const gigNameDisplay = document.getElementById("gig-name-display");
const gigNameInput = document.getElementById("gig-name-input");
const editGigNameBtn = document.getElementById("edit-gig-name");
const gigDescDisplay = document.getElementById("gig-desc-display");
const gigDescInput = document.getElementById("gig-desc-input");
const editGigDescBtn = document.getElementById("edit-gig-desc");
const copyLinkBtn = document.getElementById("copy-link-btn");
const clearListBtn = document.getElementById("clear-list-btn");

const sharedState = loadSharedState();

/** @type {import('./storage.js').ListItem[]} */
let songs = sharedState?.items ?? loadSongs();

let gigName = sharedState?.name ?? loadGigName();
let gigDescription = sharedState?.description ?? loadGigDescription();

/** @type {string | null} */
let activeSongId = songs.length > 0 ? songs[songs.length - 1].id : null;

/** @type {string | null} */
let activePlayId = null;

/** @type {Map<string, TapTempo>} */
const tapTempos = new Map();

/** @type {ReturnType<typeof setTimeout> | null} */
let urlSyncTimer = null;

let isGigTime = false;

/** @type {Set<string>} */
const completedIds = new Set();

const metronome = new Metronome(
  (playing) => {
    updatePlayButtons(playing ? activePlayId : null);
    if (!playing) clearBeatFlash();
  },
  (_beatIndex, accent) => flashActiveRow(accent)
);

function flashActiveRow(accent = false) {
  if (!activePlayId || !metronome.isPlaying) return;

  const row = songList.querySelector(`.song-row[data-id="${activePlayId}"]`);
  if (!row) return;

  row.classList.remove("is-beating", "is-beating--accent");
  void row.offsetWidth;
  row.classList.add("is-beating");
  if (accent) row.classList.add("is-beating--accent");
}

function clearBeatFlash() {
  for (const row of songList.querySelectorAll(".song-row.is-beating")) {
    row.classList.remove("is-beating", "is-beating--accent");
  }
}

function setGigTime(active) {
  isGigTime = active;
  appEl.classList.toggle("is-gig-time", active);
  gigTimeBtn.classList.toggle("is-active", active);
  gigTimeBtn.setAttribute("aria-pressed", String(active));
  gigTimeBtn.textContent = active ? "Edit set list" : "Gig Time";
  gigTimeBtn.title = active
    ? "Unlock setlist for editing"
    : "Lock setlist for live performance";

  if (!gigNameInput.hidden) {
    gigNameInput.hidden = true;
    gigNameDisplay.hidden = false;
  }
  if (!gigDescInput.hidden) {
    gigDescInput.hidden = true;
    gigDescDisplay.hidden = false;
  }

  if (!active) {
    completedIds.clear();
  }

  syncGigTimeUI();

  if (active && activeSongId === null && songs.length > 0) {
    const firstVisible = findNextVisibleIndex(-1, 1);
    if (firstVisible >= 0) setActiveSong(songs[firstVisible].id);
  }
}

function isRowVisible(itemId) {
  return !isGigTime || !completedIds.has(itemId);
}

function findNextVisibleIndex(fromIndex, direction) {
  if (direction === 0) return -1;

  let index = fromIndex + direction;
  while (index >= 0 && index < songs.length) {
    if (isRowVisible(songs[index].id)) return index;
    index += direction;
  }

  return -1;
}

function syncRowDisplay(row, item) {
  const titleText = row.querySelector(".song-row__title-text");
  const bpmText = row.querySelector(".song-row__bpm-text");

  if (titleText) {
    titleText.textContent = item.title;
  }

  if (bpmText && isSong(item)) {
    if (item.bpm != null) {
      bpmText.textContent = String(item.bpm);
      bpmText.classList.remove("is-empty");
    } else {
      bpmText.textContent = "—";
      bpmText.classList.add("is-empty");
    }
  }

  row.classList.toggle("is-done", isGigTime && completedIds.has(item.id));
}

function syncGigTimeUI() {
  for (const row of songList.querySelectorAll(".song-row")) {
    const item = songs.find((s) => s.id === row.dataset.id);
    if (item) syncRowDisplay(row, item);
  }
}

function markItemDone(itemId) {
  if (!isGigTime || completedIds.has(itemId)) return;

  completedIds.add(itemId);

  const row = songList.querySelector(`.song-row[data-id="${itemId}"]`);
  row?.classList.add("is-done");

  if (activePlayId === itemId) {
    metronome.stop();
    activePlayId = null;
    updatePlayButtons(null);
  }

  const index = songs.findIndex((s) => s.id === itemId);
  const nextIndex = findNextVisibleIndex(index, 1);
  if (nextIndex >= 0) {
    setActiveSong(songs[nextIndex].id);
    scrollActiveRowIntoView();
    return;
  }

  const prevIndex = findNextVisibleIndex(index, -1);
  if (prevIndex >= 0) {
    setActiveSong(songs[prevIndex].id);
    scrollActiveRowIntoView();
    return;
  }

  activeSongId = null;
  updateActiveRows();
}

function initGigTime() {
  gigTimeBtn.addEventListener("click", () => setGigTime(!isGigTime));
}

function getAppState() {
  return { name: gigName, description: gigDescription, items: songs };
}

function scheduleUrlSync() {
  clearTimeout(urlSyncTimer);
  urlSyncTimer = setTimeout(() => updateShareUrl(getAppState()), 400);
}

function syncToStorage() {
  saveSongs(songs);
  saveGigName(gigName);
  saveGigDescription(gigDescription);
  scheduleUrlSync();
}

function updateDocumentTitle(name) {
  document.title = name === DEFAULT_GIG_NAME ? "BPM List" : `${name} · BPM List`;
}

function renderGigName(name) {
  gigName = saveGigName(name);
  gigNameDisplay.textContent = gigName;
  updateDocumentTitle(gigName);
  scheduleUrlSync();
}

function initInlineEdit({ display, input, editBtn, onSave }) {
  const start = () => {
    input.value = display.textContent;
    display.hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  };

  const finish = (save) => {
    if (save) onSave(input.value);
    input.hidden = true;
    display.hidden = false;
  };

  editBtn.addEventListener("click", start);
  display.addEventListener("click", start);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    }
  });

  input.addEventListener("blur", () => finish(true));
}

function initGigName() {
  gigNameDisplay.textContent = gigName;
  updateDocumentTitle(gigName);
  gigDescDisplay.textContent = gigDescription;

  initInlineEdit({
    display: gigNameDisplay,
    input: gigNameInput,
    editBtn: editGigNameBtn,
    onSave: (value) => renderGigName(value),
  });

  initInlineEdit({
    display: gigDescDisplay,
    input: gigDescInput,
    editBtn: editGigDescBtn,
    onSave: (value) => renderGigDescription(value),
  });
}

function renderGigDescription(description) {
  gigDescription = saveGigDescription(description);
  gigDescDisplay.textContent = gigDescription;
  scheduleUrlSync();
}

function initVolume() {
  const stored = localStorage.getItem("bpmlist-volume");
  const percent = stored != null ? Number(stored) : 80;
  const clamped = Number.isFinite(percent)
    ? Math.max(0, Math.min(100, percent))
    : 80;

  volumeSlider.value = String(clamped);
  metronome.setVolume(clamped / 100);

  volumeSlider.addEventListener("input", () => {
    const value = Number(volumeSlider.value);
    metronome.setVolume(value / 100);
    localStorage.setItem("bpmlist-volume", String(value));
  });
}

function initTheme() {
  const stored = localStorage.getItem("bpmlist-theme");
  if (stored === "light" || stored === "dark") {
    document.documentElement.dataset.theme = stored;
  }
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark =
    current === "dark" || (!current && prefersDark);
  const next = isDark ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("bpmlist-theme", next);
}

function clearList() {
  if (songs.length === 0) return;
  if (!confirm("Clear the entire setlist?")) return;

  metronome.stop();
  activePlayId = null;
  tapTempos.clear();
  songs = [];
  activeSongId = null;
  persist();
  render();
  setActiveAddForm();
}

function persist() {
  syncToStorage();
}

function getSongNumber(index) {
  let n = 0;
  for (let i = index; i >= 0; i--) {
    if (!isSong(songs[i])) break;
    n++;
  }
  return n;
}

function getTapTempo(songId) {
  if (!tapTempos.has(songId)) {
    tapTempos.set(songId, new TapTempo());
  }
  return tapTempos.get(songId);
}

function setActiveSong(songId) {
  activeSongId = songId;
  updateActiveRows();
}

function setActiveAddForm() {
  if (isGigTime) return;
  activeSongId = null;
  updateActiveRows();
  newTitleInput.focus();
}

function scrollActiveRowIntoView() {
  const row = songList.querySelector(`.song-row[data-id="${activeSongId}"]`);
  row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function selectAdjacentSong(delta) {
  if (delta < 0) {
    if (songs.length === 0) {
      setActiveAddForm();
      return;
    }

    const currentIndex = activeSongId
      ? songs.findIndex((s) => s.id === activeSongId)
      : -1;

    if (isGigTime) {
      const prevIndex =
        currentIndex < 0
          ? findNextVisibleIndex(songs.length, -1)
          : findNextVisibleIndex(currentIndex, -1);
      if (prevIndex >= 0) {
        setActiveSong(songs[prevIndex].id);
        scrollActiveRowIntoView();
      }
      return;
    }

    if (currentIndex <= 0) {
      setActiveAddForm();
      return;
    }

    setActiveSong(songs[currentIndex - 1].id);
    scrollActiveRowIntoView();
    return;
  }

  if (songs.length === 0) return;

  if (!activeSongId) {
    const firstIndex = isGigTime ? findNextVisibleIndex(-1, 1) : 0;
    if (firstIndex >= 0) {
      setActiveSong(songs[firstIndex].id);
      scrollActiveRowIntoView();
    }
    return;
  }

  const currentIndex = songs.findIndex((s) => s.id === activeSongId);
  if (currentIndex < 0) return;

  if (isGigTime) {
    const nextIndex = findNextVisibleIndex(currentIndex, 1);
    if (nextIndex >= 0) {
      setActiveSong(songs[nextIndex].id);
      scrollActiveRowIntoView();
    }
    return;
  }

  if (currentIndex >= songs.length - 1) return;

  setActiveSong(songs[currentIndex + 1].id);
  scrollActiveRowIntoView();
}

function updateActiveRows() {
  addBar.classList.toggle("is-active", activeSongId === null);

  for (const row of songList.querySelectorAll(".song-row")) {
    row.classList.toggle("is-active", row.dataset.id === activeSongId);
  }
}

function getActiveRowElements() {
  if (!activeSongId) return null;

  const row = songList.querySelector(`.song-row[data-id="${activeSongId}"]`);
  if (!row) return null;

  const item = songs.find((s) => s.id === activeSongId);
  if (!item || !isSong(item)) return null;

  return {
    song: item,
    row,
    bpmInput: row.querySelector(".song-row__bpm"),
    tapBtn: row.querySelector(".song-row__tap"),
  };
}

function isTypingTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

async function handleTap(song, bpmInput, tapBtn = null) {
  setActiveSong(song.id);

  const wasPlayingThis = metronome.isPlaying && activePlayId === song.id;

  if (tapBtn) {
    tapBtn.classList.add("is-tapping");
    window.setTimeout(() => tapBtn.classList.remove("is-tapping"), 120);
  }

  const bpm = getTapTempo(song.id).tap();

  if (bpm != null) {
    song.bpm = bpm;
    bpmInput.value = String(bpm);
    const bpmText = bpmInput.closest(".song-row")?.querySelector(".song-row__bpm-text");
    if (bpmText) {
      bpmText.textContent = String(bpm);
      bpmText.classList.remove("is-empty");
    }
    persist();

    if (wasPlayingThis) {
      await metronome.start(bpm);
    }
  }
}

async function togglePlay(song, bpmInput) {
  setActiveSong(song.id);

  const bpm = song.bpm ?? normalizeBpm(bpmInput?.value);
  if (!bpm) {
    if (!isGigTime) bpmInput?.focus();
    return;
  }

  if (activePlayId === song.id && metronome.isPlaying) {
    metronome.stop();
    activePlayId = null;
    return;
  }

  activePlayId = song.id;
  const started = await metronome.start(bpm);
  if (!started) activePlayId = null;
}

function render() {
  songList.replaceChildren();
  emptyState.hidden = songs.length > 0;

  songs.forEach((item, index) => {
    songList.appendChild(
      isSong(item) ? createSongRow(item, index) : createBreakRow(item, index)
    );
  });

  updateActiveRows();
  updatePlayButtons(activePlayId);
  syncGigTimeUI();
}

function moveItem(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= songs.length) return;

  setActiveSong(songs[index].id);

  const [item] = songs.splice(index, 1);
  songs.splice(target, 0, item);
  persist();
  render();
}

function deleteItem(itemId) {
  if (activePlayId === itemId) {
    metronome.stop();
    activePlayId = null;
  }

  tapTempos.delete(itemId);
  const deleteIndex = songs.findIndex((s) => s.id === itemId);
  songs = songs.filter((s) => s.id !== itemId);

  if (activeSongId === itemId) {
    activeSongId =
      songs.length > 0
        ? songs[Math.min(deleteIndex, songs.length - 1)].id
        : null;
  }

  persist();
  render();
}

function attachManageButtons(fragment, item, index) {
  const upBtn = fragment.querySelector(".song-row__up");
  const downBtn = fragment.querySelector(".song-row__down");
  const deleteBtn = fragment.querySelector(".song-row__delete");

  upBtn.disabled = index === 0;
  downBtn.disabled = index === songs.length - 1;

  upBtn.addEventListener("click", () => moveItem(index, -1));
  downBtn.addEventListener("click", () => moveItem(index, 1));
  deleteBtn.addEventListener("click", () => {
    setActiveSong(item.id);
    deleteItem(item.id);
  });
}

function createSongRow(song, index) {
  const fragment = rowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".song-row");
  const numEl = fragment.querySelector(".song-row__num");
  const titleInput = fragment.querySelector(".song-row__title");
  const titleText = fragment.querySelector(".song-row__title-text");
  const bpmInput = fragment.querySelector(".song-row__bpm");
  const bpmText = fragment.querySelector(".song-row__bpm-text");
  const tapBtn = fragment.querySelector(".song-row__tap");
  const playBtn = fragment.querySelector(".song-row__play");
  const doneBtn = fragment.querySelector(".song-row__done");

  row.dataset.id = song.id;
  numEl.textContent = String(getSongNumber(index));
  titleInput.value = song.title;
  titleText.textContent = song.title;
  if (song.bpm != null) {
    bpmInput.value = String(song.bpm);
    bpmText.textContent = String(song.bpm);
    bpmText.classList.remove("is-empty");
  } else {
    bpmText.textContent = "—";
    bpmText.classList.add("is-empty");
  }

  row.classList.toggle("is-done", isGigTime && completedIds.has(song.id));

  row.addEventListener("click", () => setActiveSong(song.id));

  titleInput.addEventListener("focus", () => setActiveSong(song.id));
  titleInput.addEventListener("input", () => {
    song.title = titleInput.value;
    titleText.textContent = titleInput.value;
    persist();
  });

  bpmInput.addEventListener("focus", () => setActiveSong(song.id));
  bpmInput.addEventListener("change", () => {
    setActiveSong(song.id);
    song.bpm = normalizeBpm(bpmInput.value);
    if (song.bpm != null) {
      bpmInput.value = String(song.bpm);
      bpmText.textContent = String(song.bpm);
      bpmText.classList.remove("is-empty");
    } else {
      bpmInput.value = "";
      bpmText.textContent = "—";
      bpmText.classList.add("is-empty");
    }
    persist();

    if (activePlayId === song.id && metronome.isPlaying) {
      metronome.start(song.bpm);
    }
  });

  tapBtn.addEventListener("click", () => handleTap(song, bpmInput, tapBtn));
  playBtn.addEventListener("click", () => togglePlay(song, bpmInput));
  doneBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    markItemDone(song.id);
  });
  attachManageButtons(fragment, song, index);

  return fragment;
}

function createBreakRow(breakItem, index) {
  const fragment = breakRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".song-row");
  const titleInput = fragment.querySelector(".song-row__title");
  const titleText = fragment.querySelector(".song-row__title-text");
  const doneBtn = fragment.querySelector(".song-row__done");

  row.dataset.id = breakItem.id;
  titleInput.value = breakItem.title;
  titleText.textContent = breakItem.title;
  row.classList.toggle("is-done", isGigTime && completedIds.has(breakItem.id));

  row.addEventListener("click", () => setActiveSong(breakItem.id));

  titleInput.addEventListener("focus", () => setActiveSong(breakItem.id));
  titleInput.addEventListener("input", () => {
    breakItem.title = titleInput.value;
    titleText.textContent = titleInput.value;
    persist();
  });

  doneBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    markItemDone(breakItem.id);
  });
  attachManageButtons(fragment, breakItem, index);

  return fragment;
}

function updatePlayButtons(playingId) {
  for (const btn of songList.querySelectorAll(".song-row__play")) {
    const row = btn.closest(".song-row");
    const isActive = row?.dataset.id === playingId && metronome.isPlaying;
    btn.classList.toggle("is-playing", isActive);
    btn.setAttribute("aria-label", isActive ? "Stop metronome" : "Play metronome");
  }
}

addBar.addEventListener("focusin", () => {
  activeSongId = null;
  updateActiveRows();
});

addForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const action = e.submitter?.value;
  const title = newTitleInput.value.trim();

  if (action === "song") {
    if (!title) {
      newTitleInput.focus();
      return;
    }

    const song = createSong(title, newBpmInput.value);
    songs.push(song);
    activeSongId = song.id;
    persist();
    render();

    newTitleInput.value = "";
    newBpmInput.value = "";
    newTitleInput.focus();
    return;
  }

  if (action === "break") {
    const breakItem = createBreak(title);
    songs.push(breakItem);
    activeSongId = breakItem.id;
    persist();
    render();

    newTitleInput.value = "";
    newBpmInput.value = "";
    newTitleInput.focus();
  }
});

document.addEventListener("keydown", (e) => {
  if (isTypingTarget(e.target)) return;

  if (e.code === "ArrowUp") {
    e.preventDefault();
    selectAdjacentSong(-1);
    return;
  }

  if (e.code === "ArrowDown") {
    e.preventDefault();
    selectAdjacentSong(1);
    return;
  }

  if (e.code === "Space") {
    e.preventDefault();
    const active = getActiveRowElements();
    if (active) togglePlay(active.song, active.bpmInput);
    return;
  }

  if (e.key === "t" || e.key === "T") {
    if (isGigTime) return;
    e.preventDefault();
    const active = getActiveRowElements();
    if (active) handleTap(active.song, active.bpmInput, active.tapBtn);
  }
});

themeToggle.addEventListener("click", toggleTheme);

clearListBtn.addEventListener("click", clearList);

copyLinkBtn.addEventListener("click", async () => {
  updateShareUrl(getAppState());
  const url = window.location.href;

  try {
    await navigator.clipboard.writeText(url);
    copyLinkBtn.textContent = "Link copied!";
    window.setTimeout(() => {
      copyLinkBtn.textContent = "Copy share link";
    }, 2000);
  } catch {
    copyLinkBtn.textContent = "Copy failed";
    window.setTimeout(() => {
      copyLinkBtn.textContent = "Copy share link";
    }, 2000);
  }
});

initTheme();
initVolume();
initGigTime();
initGigName();
syncToStorage();
render();
