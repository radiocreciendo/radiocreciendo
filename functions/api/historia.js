// Historia de la radio: lista, o una entrada con ?s=slug.
import { json } from "../_lib/util.js";

const dar = h => {
  const fotos = JSON.parse(h.fotos || "[]").map(f => ({ url: "/media/" + f.key, epigrafe: f.epigrafe || "" }));
  return { slug: h.slug, titulo: h.titulo, etiqueta: h.etiqueta, bajada: h.bajada, cuerpo: h.cuerpo, fotos, portada: fotos[h.portada] || fotos[0] || null };
};

export async function onRequestGet({ env, request }) {
  if (!env.DB) return json({ error: "sin base" }, 503);
  const slug = new URL(request.url).searchParams.get("s");
  const cache = { "cache-control": "public, max-age=60" };
  if (slug) {
    const h = await env.DB.prepare("SELECT * FROM historia WHERE slug=? AND estado='publicada'").bind(slug).first();
    return h ? json(dar(h), 200, cache) : json({ error: "No existe" }, 404);
  }
  const { results } = await env.DB.prepare("SELECT * FROM historia WHERE estado='publicada' ORDER BY orden, creada_en").all();
  return json({ entradas: results.map(h => { const d = dar(h); delete d.cuerpo; delete d.fotos; return d; }) }, 200, cache);
}
