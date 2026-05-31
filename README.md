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

BPM List can load a full setlist from the URL hash. An automated agent can build that link from a song list elsewhere — look up tempos, join the pieces with `|`, and send a ready-to-open URL.

The live site is at **https://bpm.falkus.co**.

### URL shape

```
https://bpm.falkus.co#g={PAYLOAD}
```

The payload is **pipe-separated** text (`|` between fields). We use pipes instead of commas so song titles like `Signed,Sealed,Delivered` do not need escaping.

Each segment is passed through `encodeURIComponent` when building the URL (so `|`, `#`, etc. in a title are safe). For typical titles, the hash is readable as plain text.

### Field order

| Position | Meaning |
|----------|---------|
| 1 | Gig name (page title) |
| 2 | Gig description (subtitle) |
| 3+ | Songs and breaks, in setlist order |

Use an empty segment for the defaults: `||Song one 120` → gig name “Your Gig”, default subtitle, one song.

### Songs

Write each song as **`Title`** or **`Title BPM`**:

- If the entry ends with a **space** and **1–3 digits**, and that number is a valid tempo (**20–400**), it is treated as BPM and stripped from the title.
- Otherwise the whole string is the title (no BPM).

Examples:

| Entry | Title | BPM |
|-------|-------|-----|
| `Paradise City 120` | Paradise City | 120 |
| `December 1963 104` | December 1963 | 104 |
| `December 1963` | December 1963 | — (1963 is four digits, not treated as BPM) |
| `New Song` | New Song | — |

Song numbers (1, 2, 3…) are computed when displayed and reset after each break — do not encode them.

### Breaks

Prefix with `-`:

| Entry | Meaning |
|-------|---------|
| `-` | Unlabeled break |
| `- Set change` | Labeled break |

### Agent workflow

1. **Collect titles** — rider, email, spreadsheet, etc.
2. **Look up BPMs** — omit the number for unknown tempos.
3. **Insert breaks** — `- Set change` between sections if needed.
4. **Build the payload** — `{title}|{subtitle}|{song}|{song}|…`
5. **URL-encode each segment** and join with `|`.
6. **Return** `https://bpm.falkus.co#g={payload}`.

When the user opens the link, the app loads the decoded setlist.

### Example

Payload (before encoding):

```
Funk Tuckers - Bath Pizza Co|Fringe Festival - May 29, 2026|I want you back 98|Signed,Sealed,Delivered 109|Soul man 114|- Set change|Superstition 100
```

URL:

```
https://bpm.falkus.co#g=Funk%20Tuckers%20-%20Bath%20Pizza%20Co|Fringe%20Festival%20-%20May%2029%2C%202026|I%20want%20you%20back%2098|Signed%2CSealed%2CDelivered%20109|Soul%20man%20114|-%20Set%20change|Superstition%20100
```

For simple titles without special characters, agents can often skip encoding and use a readable hash directly:

```
https://bpm.falkus.co#g=Friday at The Crown|Support slot|Paradise City 120|- Set change|November Rain 75
```

### Reference implementation

**Node.js**

```javascript
function encodeSegment(text) {
  return encodeURIComponent(text);
}

function encodeItem(item) {
  if (item.type === "break") {
    return item.label ? `-${item.label}` : "-";
  }
  return item.bpm != null ? `${item.title} ${item.bpm}` : item.title;
}

function buildBpmlistUrl(baseUrl, { name, description, items }) {
  const parts = [name, description, ...items.map(encodeItem)];
  const hash = `g=${parts.map(encodeSegment).join("|")}`;
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
from urllib.parse import quote

def encode_item(item):
    if item["type"] == "break":
        label = item.get("label", "")
        return f"-{label}" if label else "-"
    title = item["title"]
    bpm = item.get("bpm")
    return f"{title} {bpm}" if bpm is not None else title

def build_bpmlist_url(base_url, *, name, description, items):
    parts = [name, description, *[encode_item(i) for i in items]]
    payload = "|".join(quote(p, safe="") for p in parts)
    return f"{base_url.rstrip('#')}#g={payload}"
```

### Legacy URLs

Older links used base64url-encoded JSON (`#g=eyJ…`). Those still work. New links use the pipe format above.

Source of truth: [`js/share.js`](js/share.js).

## Tech

Plain HTML, CSS, and JavaScript. There are no build steps here.
