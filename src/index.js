import { error, json } from "./lib/http.js";
import { getDashboardData } from "./routes/data.js";
import { handleMutation } from "./routes/mutations.js";

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowlist = (env.ALLOWED_ORIGINS || "").split(",").map(x=>x.trim()).filter(Boolean);
  // Same-origin requests can omit Origin. Cross-origin requests must be explicitly allowlisted.
  if (!origin) return "";
  return allowlist.includes(origin) ? origin : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      if (origin === null) return new Response(null,{status:403});
      return new Response(null,{headers:{"Access-Control-Allow-Origin":origin || "null","Access-Control-Allow-Methods":"GET, POST, PATCH, DELETE, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization","Vary":"Origin"}});
    }
    if (origin === null) return error("Origin مجاز نیست",403);
    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        const r = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({ok:r?.ok===1,service:"lesson-dashboard",time:new Date().toISOString()},200,origin);
      }
      if (url.pathname === "/api/data" && request.method === "GET") return json(await getDashboardData(env.DB),200,origin);
      if (/^\/api\/(homework|exams)(\/\d+)?$/.test(url.pathname)) {
        // Writes are disabled unless a server-side secret has been configured.
        // Never place WRITE_API_TOKEN in public frontend JavaScript.
        const token = env.WRITE_API_TOKEN;
        const supplied = request.headers.get("Authorization") || "";
        if (!token || supplied !== `Bearer ${token}`) return error("عملیات نوشتن مجاز نیست؛ احراز هویت سرور لازم است",401,origin || "");
        return await handleMutation(request,env,url,origin || "");
      }
      return error("مسیر پیدا نشد",404,origin || "");
    } catch (e) {
      console.error("API error",e);
      return error("خطای داخلی سرور؛ لاگ Worker را بررسی کنید",500,origin || "");
    }
  },
};
