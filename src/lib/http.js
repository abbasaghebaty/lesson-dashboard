export const json = (data, status = 200, origin = "") => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin || "null",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  },
});

export const error = (message, status = 400, origin = "") => json({ error: message }, status, origin);
export const readJson = async (request) => {
  try { return await request.json(); } catch { return null; }
};
export const validDate = (v) => v == null || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v));
