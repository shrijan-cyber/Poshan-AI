# Sprint 9 — Food Library photography

No food images were added. The current food catalog has no image records with evidence tying the photograph to both the exact IFCT food identity and its raw/cooked state, plus a verified usage license and attribution. Reusing an arbitrary web image or a Taste Skill placeholder would misrepresent food state and fail the requested rights checks.

The Food Library remains usable without photos and retains its existing responsive card layout. Once assets are licensed, add an optional image object to the catalog projection (`url`, source, creator, license, attribution, food state, dimensions/checksum), render only records that pass verification, set `loading="lazy"`, provide descriptive alt text and a no-image fallback. Do not create synthetic or guessed image URLs. External images stay out of production until terms permit hosting and derivative optimization.
