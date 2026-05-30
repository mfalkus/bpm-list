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
let activePlayId = null;

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

function render() {
  songList.replaceChildren();
  emptyState.hidden = songs.length > 0;

  songs.forEach((song, index) => {
    songList.appendChild(createRow(song, index));
  });

  updatePlayButtons(activePlayId);
}

function moveSong(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= songs.length) return;

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

  titleInput.addEventListener("input", () => {
    song.title = titleInput.value;
    persist();
  });

  bpmInput.addEventListener("change", () => {
    song.bpm = normalizeBpm(bpmInput.value);
    if (song.bpm != null) bpmInput.value = String(song.bpm);
    else bpmInput.value = "";
    persist();

    if (activePlayId === song.id && metronome.isPlaying) {
      metronome.start(song.bpm);
    }
  });

  const tapTempo = new TapTempo((bpm) => {
    song.bpm = bpm;
    bpmInput.value = String(bpm);
    persist();
  });

  tapBtn.addEventListener("click", () => {
    tapBtn.classList.add("is-tapping");
    tapTempo.tap();
    window.setTimeout(() => tapBtn.classList.remove("is-tapping"), 120);
  });

  playBtn.addEventListener("click", async () => {
    const bpm = normalizeBpm(bpmInput.value);
    if (!bpm) {
      bpmInput.focus();
      bpmInput.reportValidity?.();
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
  });

  upBtn.disabled = index === 0;
  downBtn.disabled = index === songs.length - 1;

  upBtn.addEventListener("click", () => moveSong(index, -1));
  downBtn.addEventListener("click", () => moveSong(index, 1));

  deleteBtn.addEventListener("click", () => {
    if (activePlayId === song.id) {
      metronome.stop();
      activePlayId = null;
    }
    songs = songs.filter((s) => s.id !== song.id);
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
  persist();
  render();

  newTitleInput.value = "";
  newBpmInput.value = "";
  newTitleInput.focus();
});

themeToggle.addEventListener("click", toggleTheme);

initTheme();
render();
