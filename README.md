# Hindi Words

A minimal static web app for browsing the 30,000 most frequent Hindi words (from `words/hw01.txt`–`hw10.txt`, each line `word,frequency`), most frequent first.

## Run

Serve over HTTP (fetching the txt files doesn't work from `file://`):

```sh
python3 -m http.server
```

Then open http://localhost:8000.

## Decisions

- **Order** — words are sorted by frequency, descending; the most frequent words come first.
- **Grid size** — two dropdowns: columns (2 or 3) × rows (3–6); words per page = columns × rows.
- **Display** — words are shown in a responsive grid (adapts to fit more words at wider sizes), each with its frequency in short form (`17.3M`, `999.8K`, …); the grid scrolls after ~60% of viewport height.
- **Copy** — the copy button copies only the words, comma-separated (no frequencies).
- **Copy with Prompts** — three sample prompts (sentences/images, story, flashcards); each copies the prompt followed by the current page's words. Prompts show on a single line with a tooltip revealing the full text.
- **Pagination** — ← / → arrow buttons page through the list in grid-size chunks. Keyboard: ←/→ changes the page.
- **Labels** — bilingual (Hindi / English): `हिन्दी शब्द / Hindi Words`, `प्रति पृष्ठ शब्द / Words per page`.
- **Persistence** — the last word index and basket size are stored in `localStorage`, so a refresh reopens the same page. Changing the basket size keeps the current position (the page containing the last viewed word).
- **Data cache** — the parsed word list is cached in `localStorage`, so refreshes skip re-fetching the txt files.
- **No dependencies** — plain HTML/CSS/JS, no build step.
