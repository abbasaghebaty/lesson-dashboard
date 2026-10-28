import { error, json, readJson, validDate } from "../lib/http.js";

// Only homework and exams can be written now (the plan resource was removed with the replanner).
const STATUSES_BY_RESOURCE = {
  homework: new Set(["todo", "done", "skipped"]),
  exams: new Set(["upcoming", "done", "cancelled"]),
};
const positiveId = (s) => /^\d+$/.test(s) && Number(s) > 0;

export async function handleMutation(request, env, url, origin) {
  const db = env.DB;
  const parts = url.pathname.split("/").filter(Boolean); // /api/{resource}/{id?}
  const resource = parts[1], id = parts[2];
  if (!STATUSES_BY_RESOURCE[resource]) return error("مسیر پیدا نشد",404,origin);
  if (id && !positiveId(id)) return error("شناسه نامعتبر است",400,origin);
  if (request.method === "PATCH") {
    if (!id) return error("شناسه لازم است",400,origin);
    const body = await readJson(request);
    if (!body || !STATUSES_BY_RESOURCE[resource].has(body.status)) return error("وضعیت برای این نوع رکورد نامعتبر است",400,origin);
    const result = await db.prepare(`UPDATE ${resource} SET status = ? WHERE id = ?`).bind(body.status, Number(id)).run();
    if (!result.meta?.changes) return error("رکورد پیدا نشد",404,origin);
    return json({ ok:true, id:Number(id), status:body.status },200,origin);
  }
  if (request.method === "POST") {
    const body = await readJson(request);
    if (!body || !Number.isInteger(Number(body.book_id)) || Number(body.book_id) < 1) return error("book_id معتبر لازم است",400,origin);
    if (resource === "homework") {
      if (typeof body.description !== "string" || !body.description.trim() || !validDate(body.due_date)) return error("شرح یا تاریخ تکلیف نامعتبر است",400,origin);
      const r = await db.prepare(`INSERT INTO homework(book_id,description,due_date,status) VALUES(?,?,?, 'todo')`).bind(Number(body.book_id),body.description.trim(),body.due_date||null).run();
      return json({ok:true,id:r.meta.last_row_id},201,origin);
    }
    if (resource === "exams") {
      if (!validDate(body.exam_date) || !body.exam_date || typeof body.covers !== "string") return error("تاریخ یا محدوده امتحان نامعتبر است",400,origin);
      const r = await db.prepare(`INSERT INTO exams(book_id,exam_date,covers,status) VALUES(?,?,?, 'upcoming')`).bind(Number(body.book_id),body.exam_date,body.covers).run();
      return json({ok:true,id:r.meta.last_row_id},201,origin);
    }
  }
  if (request.method === "DELETE") {
    if (!id) return error("شناسه لازم است",400,origin);
    const r = await db.prepare(`DELETE FROM ${resource} WHERE id = ?`).bind(Number(id)).run();
    if (!r.meta?.changes) return error("رکورد پیدا نشد",404,origin);
    return json({ok:true,id:Number(id)},200,origin);
  }
  return error("روش پشتیبانی نمی‌شود",405,origin);
}
