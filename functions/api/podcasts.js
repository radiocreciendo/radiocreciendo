import { json } from "../_lib/util.js";

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: "sin base" }, 503);
  const { results } = await env.DB.prepare(
    "SELECT id,titulo,descripcion,cat,audio_key,duracion,publicado_en FROM podcasts WHERE estado='publicado' AND publicado_en<=? ORDER BY publicado_en DESC LIMIT 100"
  ).bind(new Date().toISOString()).all();
  const episodios = results.map(p => ({
    id: p.id, cat: p.cat, fecha: p.publicado_en, titulo: p.titulo, descripcion: p.descripcion,
    audio: "/media/" + p.audio_key, duracion: p.duracion
  }));
  return json({ actualizado: new Date().toISOString(), episodios }, 200, { "cache-control": "public, max-age=45" });
}
