# Loading, not found, error and empty states (frontend)

Use the shared views in `frontend/src/components/feedback`; don't hand-roll new ones.

- **Missing thing** (bad URL, unknown id or slug, an API 404 / `*_NOT_FOUND`): `NotFoundView`, or
  `LoadFailed` for a query result. Name what is missing ("Order not found").
- **Failed load**: `ErrorView` with a `retry` (it words offline and server errors differently and
  shows the request reference). A failed load must never render as an empty list, a blank page
  or an endless spinner. Check `error` before `!data.length`.
- **Empty list**: `EmptyView` (panels, grids) or `EmptyRow` (tables, under the headers). Say what
  will appear there and, when there is one, the next step (a button).
- **New route group or surface**: add a `[...rest]/page.tsx` calling `notFound()`, plus its own
  `not-found.tsx` and `error.tsx`, so 404s and crashes keep the surface's frame.
- Every message exists in `en` and `kh` (`common.feedback.*` for the shared wording).
