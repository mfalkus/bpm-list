# BPM List

Create a list of songs and tempos, with built-in metronome.

**Live app:** [https://bpm.falkus.co](https://bpm.falkus.co)

I occasionally play drums in a gigging band. Ahead of those gigs I'll scribble
out a list of songs and tempos.  Google has a metronome built in... but you hit
play and there's a delay!  That's annoying if you're trying to check the tempo
of a song whilst listening to the record.

## Features

- Add, edit, and remove songs
- Tap tempo — tap along while listening to a track to detect BPM
- Per-song metronome with immediate first beat (no startup delay)
- Light/dark mode with system preference support
- All in the browser, no server components

## Run locally

It's ready to go! e.g. `npx serve`

## Share URLs (for agents)

BPM List can load a full setlist from the URL hash. An automated agent (or script) can build that link from a song list obtained elsewhere — look up tempos, encode the list, and send the user a ready-to-open URL.

The live site is at **https://bpm.falkus.co** — use that as `{SITE_BASE}` when generating links for production.

### URL shape

```
https://bpm.falkus.co#g={PAYLOAD}
```

More generally:

```
{SITE_BASE}#g={PAYLOAD}
```

- `{SITE_BASE}` — where the app is hosted. Production: `https://bpm.falkus.co`. For local dev: e.g. `http://localhost:3000/`. Path and query string are preserved; only the hash carries setlist data.
- `{PAYLOAD}` — **base64url** encoding of a UTF-8 JSON object (see below).

**Base64url rules:** standard Base64, then replace `+` → `-`, `/` → `_`, and remove trailing `=` padding.

### JSON payload

```json
{
  "n": "Friday at The Crown",
  "d": "Support slot, 45 min",
  "i": [
    ["s", "Paradise City", 120],
    ["s", "Sweet Child O' Mine", 125],
    ["b", "Set change"],
    ["s", "November Rain", 75]
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `i` | **yes** | Ordered list of items (songs and breaks). |
| `n` | no | Gig name. Omit if `"Your Gig"` (the default). |
| `d` | no | Gig description/subtitle. Omit if `"Your gig setlist with tempo reference."` (the default). |

### Item encoding (`i` entries)

Each entry is a short JSON array:

| Type | Format | Examples |
|------|--------|----------|
| **Song with BPM** | `["s", title, bpm]` | `["s", "Paradise City", 120]` |
| **Song without BPM** | `["s", title]` | `["s", "New Song"]` — user can tap or enter tempo later |
| **Break (unlabeled)** | `["b"]` | Section divider; song numbering restarts after it |
| **Break (labeled)** | `["b", label]` | `["b", "Set change"]`, `["b", "Encore"]` |

- `title` and break labels are plain strings (UTF-8).
- `bpm` must be an integer **20–400**. Invalid values are treated as missing.
- Order in `i` is the setlist order. Song numbers (1, 2, 3…) are computed at display time and reset after each break — do not encode them.
- Item IDs are not in the URL; the app generates them on load.

### Agent workflow

1. **Collect titles** — from a rider, email, spreadsheet, previous setlist, etc.
2. **Look up BPMs** — use a music database, web search, or ask the user for unknowns. Omit BPM or skip lookup for songs where tempo is TBD.
3. **Insert breaks** — add `["b", "…"]` entries between sets or sections if needed.
4. **Build the payload** — set optional `n` / `d`, populate `i`.
5. **Encode** — `JSON.stringify` the object (no pretty-print), UTF-8 bytes, base64url.
6. **Return the link** — `https://bpm.falkus.co#g={encoded}` (or `{SITE_BASE}#g={encoded}` for other hosts).

When the user opens the link, the app replaces the current list with the decoded setlist and keeps the hash in the address bar for sharing.

### Examples

**Minimal setlist (defaults for name/description):**

JSON:

```json
{"i":[["s","Paradise City",120],["s","Sweet Child O' Mine",125]]}
```

URL (live site):

```
https://bpm.falkus.co#g=eyJpIjpbWyJzIiwiUGFyYWRpc2UgQ2l0eSIsMTIwXSxbInMiLCJTd2VldCBDaGlsZCBPJyBNaW5lIiwxMjVdXX0
```

**Full gig with name, description, and a break:**

JSON:

```json
{
  "n": "The Crown — Friday",
  "d": "Support, 45 min",
  "i": [
    ["s", "Paradise City", 120],
    ["b", "Set change"],
    ["s", "November Rain", 75]
  ]
}
```

### Reference implementations

**Node.js**

```javascript
function toBase64Url(text) {
  return Buffer.from(text, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildBpmlistUrl(baseUrl, { name, description, items }) {
  const payload = {
    i: items.map((item) => {
      if (item.type === "break") {
        return item.label ? ["b", item.label] : ["b"];
      }
      return item.bpm != null ? ["s", item.title, item.bpm] : ["s", item.title];
    }),
  };
  if (name && name !== "Your Gig") payload.n = name;
  if (description && description !== "Your gig setlist with tempo reference.") {
    payload.d = description;
  }
  const hash = `g=${toBase64Url(JSON.stringify(payload))}`;
  return `${baseUrl.replace(/#$/, "")}#${hash}`;
}

// Example
const url = buildBpmlistUrl("https://bpm.falkus.co", {
  name: "Friday at The Crown",
  description: "Support slot",
  items: [
    { type: "song", title: "Paradise City", bpm: 120 },
    { type: "break", label: "Set change" },
    { type: "song", title: "November Rain", bpm: 75 },
  ],
});
```

**Python**

```python
import base64
import json

DEFAULT_NAME = "Your Gig"
DEFAULT_DESC = "Your gig setlist with tempo reference."

def to_base64url(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode("utf-8")).decode("ascii").rstrip("=")

def build_bpmlist_url(base_url: str, *, name=None, description=None, items) -> str:
    payload = {"i": []}
    for item in items:
        if item["type"] == "break":
            payload["i"].append(["b", item["label"]] if item.get("label") else ["b"])
        else:
            row = ["s", item["title"]]
            if item.get("bpm") is not None:
                row.append(int(item["bpm"]))
            payload["i"].append(row)
    if name and name != DEFAULT_NAME:
        payload["n"] = name
    if description and description != DEFAULT_DESC:
        payload["d"] = description
    base = base_url.rstrip("#")
    return f"{base}#g={to_base64url(json.dumps(payload, separators=(',', ':')))}"

# Example
# url = build_bpmlist_url("https://bpm.falkus.co", name="Friday at The Crown", ...)
```

Source of truth for encode/decode logic: [`js/share.js`](js/share.js).

## Tech

Plain HTML, CSS, and JavaScript. There are no build steps here.
