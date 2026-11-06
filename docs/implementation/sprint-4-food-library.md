# Sprint 4 — Food Library

## Status: Partial

The Food Library now supports debounced catalog search, category filtering based on returned records, expandable food details, per-100 g macro values, clear unavailable-value labels, retry/error/loading/empty states, and responsive result pagination. Search continues through the existing Axios client and public `GET /foods/search` route; no backend contract or nutrition data was changed.

## Data contract and limits

The current backend validates a 2–60 character query and returns at most 20 results; the existing frontend API wrapper requests 8. Each result includes its IFCT code, name, category, available serving units, and calories/protein/carbohydrate/fat (both flattened and under `nutrients`). The page displays only the familiar name/category and per-100 g macros. Null or absent values render as “Unavailable”, never zero.

The current response does not expose dietary tags, preparation/raw-cooked state, detailed nutrient profiles, record-level source locators, or source license. The page therefore does not offer unsupported dietary filters or claim a raw/cooked state. It identifies the catalog as the IFCT 2017 application subset while explicitly noting that record-level source mapping is unavailable. It does not merge packaged-food records into this generic composition search.

The existing catalog API has no page/cursor parameter and the wrapper asks for only eight matches. The UI provides local pagination over the returned subset; this is not server-side pagination. A broader searchable library requires an intentional backend contract change.

## Files

- `poshanai-frontend/src/pages/FoodLibrary.jsx`

## Validation

Page-specific lint/build results are recorded by the integrating sprint owner after integration. No food-data fixtures or production nutrition values were added or changed.
