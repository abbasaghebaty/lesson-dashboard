const COLORS = ["#12b886", "#3b82f6", "#f5a623", "#e5484d", "#8b5cf6", "#0ea5e9"];

// FIXES in this version:
//  1) "taught lessons" are now computed from progress_log too (a lesson counts as taught once the last
//     reported page reached its start page), so the site no longer lags behind the Telegram bot.
//  2) the pace chart no longer hides a correct record just because its note mentions the word "اشتباه";
//     only records whose note STARTS with "گزارش اشتباه" (reports marked as wrong) are excluded.

export async function getDashboardData(db) {
  const q = async (sql) => (await db.prepare(sql).all()).results;
  const [plan, exams, homework, sched, books, prog] = await Promise.all([
    q(`SELECT p.id, p.plan_date, p.due_date, b.subject, b.priority, p.kind, p.description,
              IFNULL(p.page_from,0) pf, IFNULL(p.page_to,0) pt,
              IFNULL(p.part_no,0) part, IFNULL(p.parts_total,0) parts, p.status
       FROM plan p JOIN books b ON b.id = p.book_id ORDER BY p.plan_date, p.id`),
    q(`SELECT e.id, b.subject s, e.exam_date d, e.covers c, e.status st, e.book_id
       FROM exams e JOIN books b ON b.id = e.book_id ORDER BY e.exam_date`),
    q(`SELECT h.id, b.subject s, h.description t, h.due_date d, h.status st, h.book_id
       FROM homework h JOIN books b ON b.id = h.book_id ORDER BY h.id`),
    q(`SELECT day_index, day_name, period, part, subject FROM weekly_schedule ORDER BY day_index, period`),
    q(`SELECT b.id, b.subject, b.priority,
              (SELECT COUNT(*) FROM toc t WHERE t.book_id=b.id AND t.kind='lesson') lessons,
              (SELECT COUNT(*) FROM toc t WHERE t.book_id=b.id AND t.kind='lesson'
                 AND (t.taught=1 OR (t.start_page>0 AND t.start_page <= IFNULL((SELECT MAX(p.up_to_page) FROM progress_log p WHERE p.book_id=b.id),0)))) taught,
              (SELECT COUNT(*) FROM toc t WHERE t.book_id=b.id AND t.kind='lesson' AND t.reviewed>0) reviewed
       FROM books b ORDER BY b.priority, b.id`),
    q(`SELECT b.subject, p.report_date d, MAX(p.up_to_page) pg
       FROM progress_log p JOIN books b ON b.id = p.book_id
       WHERE p.up_to_page IS NOT NULL AND IFNULL(p.notes,'') NOT LIKE 'گزارش اشتباه%'
       GROUP BY b.subject, p.report_date ORDER BY b.subject, p.report_date`),
  ]);
  const days = new Map();
  for (const r of sched) {
    if (!days.has(r.day_index)) days.set(r.day_index, { name: r.day_name, cells: [[], [], [], []] });
    const lab = r.subject === "خالی" ? "" : r.subject;
    days.get(r.day_index).cells[r.period - 1].push({ part: r.part, lab });
  }
  const schedule = [...days.entries()].sort((a,b)=>a[0]-b[0]).map(([,d])=>[
    d.name, d.cells.map(c => c.length <= 1 ? (c[0]?.lab ?? "") : c.map(x=>x.lab || "خالی").join(" / ")),
  ]);
  const bySub = new Map();
  for (const r of prog) { if (!bySub.has(r.subject)) bySub.set(r.subject, []); bySub.get(r.subject).push([r.d, r.pg]); }
  const pace = [...bySub.entries()].map(([s,pts],i)=>[s,pts,COLORS[i%COLORS.length]]);
  return {
    plan: plan.map(r=>[r.id,r.plan_date,r.due_date,r.subject,r.priority,r.kind,r.description,r.pf,r.pt,r.part,r.parts,r.status]),
    exams, homework, schedule,
    books: books.map(b=>[b.subject,b.priority,b.lessons,b.taught,b.reviewed]), pace,
    meta: { updatedAt: new Date().toISOString() },
  };
}
