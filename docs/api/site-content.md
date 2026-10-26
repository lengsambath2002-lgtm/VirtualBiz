# Site content: homepage banners and legal pages

A super-admin edits these in the console (**Settings → Homepage** and **Settings → Terms &
privacy**); everyone reads them. Stored in `site_content` (one JSON document per key), checked by
`SiteContentService`, and every change is in the audit log (`CONTENT_UPDATED`, target `CONTENT`).

## Read (public)

| | |
| --- | --- |
| `GET /api/meta/home-banners` | `{main, side1, side2, updatedAt, updatedBy}` |
| `GET /api/meta/legal/{terms\|privacy}` | `{en, kh, updatedAt, updatedBy}` |

A banner is `{visible, eyebrow, title, body, cta, href, imageUrl}`; each text is `{en, kh}` (an empty
Khmer text shows the English one). `body` may mark a promo code as `**CODE**` (shown
highlighted). `cta` is the main banner's button. `href` is a page of the site (`/deals`,
`/search?type=service`) or an `https://` address.

`imageUrl` is an optional background photo: upload it with `POST /api/files` (`purpose=SITE_BANNER`), then
save the banners with its URL. A new photo must be one the saving admin uploaded; one already on
the banner can stay whoever saves. The homepage shades it so the text stays readable.

Limits: small heading 40, title 90, text 160, button 30 characters; a legal page 30,000.

Legal pages are plain text: `## ` starts a heading, `- ` a bullet, a blank line a paragraph. The
pages are `/terms` and `/privacy`, linked from the footers and the sign-up form (opened in a new
tab there, so a half-typed sign-up is kept).

## Change (super-admin; other staff read)

`GET` / `PUT /api/admin/content/home-banners` (all three banners) and
`GET` / `PUT /api/admin/content/legal/{page}` (`{en, kh}`). `VALIDATION_FAILED` names the field,
e.g. `main.title.en` or `side1.href`.

The homepage reads the banners in its server render (cached up to a minute) and checks again
once the page is up, so a change shows at once for new visits.

The seeded Terms and Privacy text is a starting point: have it checked by a lawyer for the
business before relying on it.
