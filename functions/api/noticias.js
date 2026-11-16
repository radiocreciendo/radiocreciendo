// Feed público de notas (lo lee index.html).
import { json } from "../_lib/util.js";

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: "sin base" }, 503);
  const { results } = await env.DB.prepare(
    "SELECT id,slug,titulo,cuerpo,cat,region,imagen,fuente_nombre,fuente_url,publicada_en FROM noticias WHERE estado='publicada' AND publicada_en<=? ORDER BY publicada_en DESC LIMIT 100"
  ).bind(new Date().toISOString()).all();
  const notas = results.map(n => ({
    id: n.id, slug: n.slug, cat: n.cat, hora: n.publicada_en, region: !!n.region,
    titulo: n.titulo, cuerpo: n.cuerpo,
    imagen: n.imagen ? "/media/" + n.imagen : null,
    fuente: n.fuente_nombre ? { nombre: n.fuente_nombre, url: n.fuente_url } : null
  }));
  return json({ actualizado: new Date().toISOString(), notas }, 200, { "cache-control": "public, max-age=45" });
}
