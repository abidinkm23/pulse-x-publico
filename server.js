const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");

function send(res, status, body, type="application/json; charset=utf-8") {
  res.writeHead(status, {"Content-Type": type, "Access-Control-Allow-Origin": "*"});
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}
function cleanHandle(s) {
  return String(s || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?x\.com\//i, "").split(/[/?#]/)[0];
}
function findTweets(root) {
  const found = new Map();
  const seen = new Set();
  function walk(x, depth=0) {
    if (!x || typeof x !== "object" || depth > 40 || seen.has(x)) return;
    seen.add(x);
    if (Array.isArray(x)) { for (const y of x) walk(y, depth+1); return; }
    // Handles common public syndication / embedded tweet shapes, without assuming every response uses them.
    const legacy = x.legacy || x.tweet?.legacy;
    const user = x.core?.user_results?.result?.legacy || x.user || x.author;
    const id = String(x.rest_id || x.id_str || legacy?.id_str || x.tweet?.rest_id || "");
    if (id && legacy && (legacy.full_text || legacy.text)) {
      const m = legacy.extended_entities || {};
      const viewsRaw = x.views?.count ?? x.views?.state?.count ?? x.view_count ?? x.public_metrics?.impression_count;
      const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
      found.set(id, {
        id,
        url: `https://x.com/${user?.screen_name || user?.username || "i"}/status/${id}`,
        text: legacy.full_text || legacy.text || "",
        created_at: legacy.created_at || x.created_at || "",
        author: user?.name || user?.screen_name || user?.username || "",
        handle: user?.screen_name || user?.username || "",
        replies: num(legacy.reply_count ?? x.public_metrics?.reply_count),
        reposts: num(legacy.retweet_count ?? x.public_metrics?.retweet_count),
        likes: num(legacy.favorite_count ?? x.public_metrics?.like_count),
        views: viewsRaw == null ? null : num(viewsRaw),
        quotes: num(legacy.quote_count ?? x.public_metrics?.quote_count)
      });
    }
    for (const [k,v] of Object.entries(x)) walk(v, depth+1);
  }
  walk(root);
  return [...found.values()];
}
const server = http.createServer(async (req,res) => {
  const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (u.pathname === "/api/posts") {
    const handle = cleanHandle(u.searchParams.get("user"));
    if (!handle || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) return send(res,400,{error:"Escribe un @usuario válido de X."});
    try {
      // Public, unauthenticated syndication endpoint. X may change or block it at any time.
      const upstream = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}?lang=es`;
      const r = await fetch(upstream, {headers: {"User-Agent":"Mozilla/5.0 (compatible; PulseX/1.0)", "Accept":"text/html,application/xhtml+xml"}});
      if (!r.ok) throw new Error(`La fuente pública respondió ${r.status}`);
      const html = await r.text();
      const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
      const candidates = [html, ...scripts];
      let posts=[];
      for (const raw of candidates) {
        const decoded = raw.replace(/&quot;/g,'"').replace(/&amp;/g,'&');
        // Parse JSON script blocks when possible; fall back to extracting a JSON-like object.
        try { posts = posts.concat(findTweets(JSON.parse(decoded))); } catch {}
        if (posts.length === 0) {
          const start = decoded.indexOf('{"');
          if (start >= 0) {
            for (const match of decoded.matchAll(/"full_text"\s*:\s*"((?:\\.|[^"\\])*)"/g)) {
              try {
                const text = JSON.parse(`"${match[1]}"`);
                if (text) posts.push({id:`text-${posts.length}`, text, url:`https://x.com/${handle}`, created_at:"", author:handle, handle, replies:0,reposts:0,likes:0,views:null,quotes:0});
              } catch {}
            }
          }
        }
      }
      const unique = new Map(posts.map(p=>[p.id,p]));
      posts=[...unique.values()].filter(p=>p.id && !String(p.id).startsWith("text-"));
      if (!posts.length) {
        return send(res,502,{error:"X no ha entregado publicaciones en un formato público que podamos leer ahora. Puede haber cambiado o bloqueado esta fuente; no se han inventado métricas."});
      }
      posts.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
      return send(res,200,{user:handle, count:posts.length, posts:posts.slice(0,100), note:"Solo datos que la fuente pública ha permitido recuperar. Las visualizaciones pueden no estar disponibles."});
    } catch (e) {
      return send(res,502,{error:"No se han podido recuperar las publicaciones públicas de X en este momento. X puede bloquear o cambiar esta fuente sin aviso.", detail: e.message});
    }
  }
  let file = u.pathname === "/" ? "index.html" : path.basename(u.pathname);
  const full = path.join(ROOT,file);
  if (!full.startsWith(ROOT)) return send(res,403,{error:"Forbidden"});
  fs.readFile(full,(err,data)=> err ? send(res,404,"No encontrado","text/plain; charset=utf-8") : send(res,200,data.toString(), file.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain; charset=utf-8"));
});
server.listen(PORT,()=>console.log(`Pulse X Público listo en http://localhost:${PORT}`));
