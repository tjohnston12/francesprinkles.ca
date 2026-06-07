// =====================================================================
//  /api/gallery.js   —  France & Sprinkles
//  Serves the photo gallery from an Airtable table, keeping your token
//  private. The site fetches this at load time, so the (temporary)
//  Airtable attachment URLs are always freshly issued and valid.
//
//  Airtable "Gallery" table is expected to have:
//    - an Attachment field for the photo        (default name: "Photo")
//    - a Single select field for the category    (default name: "Category")
//    - a text field for the caption/name          (default name: "Name")
//  Field names are overridable with env vars (see below).
// =====================================================================

const BASE   = process.env.AIRTABLE_BASE_ID;
const TABLE  = process.env.AIRTABLE_GALLERY_TABLE || "Gallery";
const F_PHOTO = process.env.GALLERY_PHOTO_FIELD    || "Photo";
const F_CAT   = process.env.GALLERY_CATEGORY_FIELD || "Category";
const F_NAME  = process.env.GALLERY_NAME_FIELD     || "Name";

// Map whatever the single-select says to the site's category buckets.
const CAT_MAP = {
  cupcake:"Cupcakes", cupcakes:"Cupcakes",
  cookie:"Cookies",   cookies:"Cookies",
  bread:"Breads",     breads:"Breads", loaf:"Breads", loaves:"Breads"
};
function normCat(c){
  if(!c) return "Other";
  const k = String(c).trim().toLowerCase();
  return CAT_MAP[k] || (String(c).charAt(0).toUpperCase() + String(c).slice(1));
}

module.exports = async (req, res) => {
  try {
    const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}?pageSize=100`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` }
    });
    if (!r.ok) throw new Error(`Airtable ${r.status}: ${await r.text()}`);
    const data = await r.json();

    const items = (data.records || []).map((rec) => {
      const f = rec.fields || {};
      const att = (f[F_PHOTO] || [])[0];
      if (!att) return null; // skip rows without a photo
      // Prefer a sized thumbnail to keep the page light; fall back to full url.
      const img =
        (att.thumbnails && att.thumbnails.large && att.thumbnails.large.url) ||
        att.url;
      return { name: f[F_NAME] || "", cat: normCat(f[F_CAT]), img };
    }).filter(Boolean);

    // Short cache: well under the ~2h URL lifetime, so links stay valid.
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).json({ items });
  } catch (err) {
    console.error(err);
    // Return empty so the site quietly falls back to its placeholders.
    res.status(200).json({ items: [], error: "Could not load gallery" });
  }
};
