// Una nota por slug (para el link compartible nota.html?s=...).
import { json } from "../_lib/util.js";

export async function onRequestGet({ env, request }) {
  if (!env.DB) return json({ error: "sin base" }, 503);
  const slug = new URL(request.url).searchParams.get("s");
  const n = slug && await env.DB.prepare("SELECT * FROM noticias WHERE slug=? AND estado='publicada'").bind(slug).first();
  if (!n) return json({ error: "No existe" }, 404);
  return json({
    slug: n.slug, titulo: n.titulo, cuerpo: n.cuerpo, cat: n.cat, hora: n.publicada_en,
    imagen: n.imagen ? "/media/" + n.imagen : null,
    fuente: n.fuente_nombre ? { nombre: n.fuente_nombre, url: n.fuente_url } : null
  }, 200, { "cache-control": "public, max-age=60" });
}
