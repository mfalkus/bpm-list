import { Metronome } from "./metronome.js";
import { TapTempo } from "./tap-tempo.js";
import {
  loadSongs,
  saveSongs,
  createSong,
  normalizeBpm,
} from "./storage.js";

const songList = document.getElementById("song-list");
const emptyState = document.getElementById("empty-state");
const addForm = document.getElementById("add-form");
const newTitleInput = document.getElementById("new-title");
const newBpmInput = document.getElementById("new-bpm");
const rowTemplate = document.getElementById("song-row-template");
const themeToggle = document.getElementById("theme-toggle");

/** @type {import('./storage.js').Song[]} */
let songs = loadSongs();

/** @type {string | null} */
let activeSongId = songs.length > 0 ? songs[songs.length - 1].id : null;

/** @type {string | null} */
let activePlayId = null;

/** @type {Map<string, TapTempo>} */
const tapTempos = new Map();

const metronome = new Metronome((playing) => {
  updatePlayButtons(playing ? activePlayId : null);
});

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

function persist() {
  saveSongs(songs);
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

function selectAdjacentSong(delta) {
  if (songs.length === 0) return;

  const currentIndex = songs.findIndex((s) => s.id === activeSongId);
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = Math.max(0, Math.min(songs.length - 1, startIndex + delta));

  setActiveSong(songs[nextIndex].id);

  const row = songList.querySelector(`.song-row[data-id="${activeSongId}"]`);
  row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function updateActiveRows() {
  for (const row of songList.querySelectorAll(".song-row")) {
    row.classList.toggle("is-active", row.dataset.id === activeSongId);
  }
}

function getActiveRowElements() {
  if (!activeSongId) return null;

  const row = songList.querySelector(`.song-row[data-id="${activeSongId}"]`);
  if (!row) return null;

  const song = songs.find((s) => s.id === activeSongId);
  if (!song) return null;

  return {
    song,
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
    persist();

    if (wasPlayingThis) {
      await metronome.start(bpm);
    }
  }
}

async function togglePlay(song, bpmInput) {
  setActiveSong(song.id);

  const bpm = normalizeBpm(bpmInput.value);
  if (!bpm) {
    bpmInput.focus();
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

  songs.forEach((song, index) => {
    songList.appendChild(createRow(song, index));
  });

  updateActiveRows();
  updatePlayButtons(activePlayId);
}

function moveSong(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= songs.length) return;

  setActiveSong(songs[index].id);

  const [item] = songs.splice(index, 1);
  songs.splice(target, 0, item);
  persist();
  render();
}

function createRow(song, index) {
  const fragment = rowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".song-row");
  const titleInput = fragment.querySelector(".song-row__title");
  const bpmInput = fragment.querySelector(".song-row__bpm");
  const tapBtn = fragment.querySelector(".song-row__tap");
  const playBtn = fragment.querySelector(".song-row__play");
  const upBtn = fragment.querySelector(".song-row__up");
  const downBtn = fragment.querySelector(".song-row__down");
  const deleteBtn = fragment.querySelector(".song-row__delete");

  row.dataset.id = song.id;
  titleInput.value = song.title;
  if (song.bpm != null) bpmInput.value = String(song.bpm);

  row.addEventListener("click", () => setActiveSong(song.id));

  titleInput.addEventListener("focus", () => setActiveSong(song.id));
  titleInput.addEventListener("input", () => {
    song.title = titleInput.value;
    persist();
  });

  bpmInput.addEventListener("focus", () => setActiveSong(song.id));
  bpmInput.addEventListener("change", () => {
    setActiveSong(song.id);
    song.bpm = normalizeBpm(bpmInput.value);
    if (song.bpm != null) bpmInput.value = String(song.bpm);
    else bpmInput.value = "";
    persist();

    if (activePlayId === song.id && metronome.isPlaying) {
      metronome.start(song.bpm);
    }
  });

  tapBtn.addEventListener("click", () => handleTap(song, bpmInput, tapBtn));

  playBtn.addEventListener("click", () => togglePlay(song, bpmInput));

  upBtn.disabled = index === 0;
  downBtn.disabled = index === songs.length - 1;

  upBtn.addEventListener("click", () => moveSong(index, -1));
  downBtn.addEventListener("click", () => moveSong(index, 1));

  deleteBtn.addEventListener("click", () => {
    setActiveSong(song.id);

    if (activePlayId === song.id) {
      metronome.stop();
      activePlayId = null;
    }

    tapTempos.delete(song.id);
    const deleteIndex = songs.findIndex((s) => s.id === song.id);
    songs = songs.filter((s) => s.id !== song.id);

    if (activeSongId === song.id) {
      activeSongId =
        songs.length > 0
          ? songs[Math.min(deleteIndex, songs.length - 1)].id
          : null;
    }

    persist();
    render();
  });

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

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = newTitleInput.value.trim();
  if (!title) return;

  const song = createSong(title, newBpmInput.value);
  songs.push(song);
  activeSongId = song.id;
  persist();
  render();

  newTitleInput.value = "";
  newBpmInput.value = "";
  newTitleInput.focus();
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
    e.preventDefault();
    const active = getActiveRowElements();
    if (active) handleTap(active.song, active.bpmInput, active.tapBtn);
  }
});

themeToggle.addEventListener("click", toggleTheme);

initTheme();
render();
