# Sprint 9 — supplement tracker

Added an authenticated, user-owned `UserSupplement` collection separate from the public static catalog and existing daily intake log. It stores the user's product name, brand, label serving, optional recorded dose, multiple nutrient components with original numeric values/units, schedule note and notes. No dosage recommendation or unit conversion is performed.

## API

- `GET /api/v1/supplements/mine` — list only the authenticated user's saved products.
- `POST /api/v1/supplements/mine` — create a validated custom product.
- `PATCH /api/v1/supplements/mine/:id` — update only an owned product.
- `DELETE /api/v1/supplements/mine/:id` — delete only an owned product.
- `GET /api/v1/supplements/history?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50` — list that user's existing supplement intake logs.
- Existing public `GET /api/v1/supplements/list` and `/api/v1/daily-logs/add-supplement` remain unchanged.

Nutrient component units are checked against the nutrient. Values are stored as provided; no automatic conversion is done. Authenticated records are scoped by `userId` in every query, update and delete filter. The new model is additive; no migration of old daily supplement logs is needed.

The dashboard tracker includes add/edit/delete, multi-component input, loading/error/empty states, label-only disclaimer and recent intake history. Historical log records are shown as originally logged; old entries are not reconstructed into new product definitions.
