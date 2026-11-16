// API del panel. Todo pasa por la clave PANEL_CLAVE.
import {
  json, ahora, uid, slugify, texto, urlHttp, exigirClave, fechaISO,
  CATS_NOTAS, CATS_POD, MAX_IMG_BYTES, MAX_AUDIO_BYTES, MAX_AUDIO_SEG, tipoImagen, esMp3
} from "../../_lib/util.js";
import { probarFeed, actualizarFuente, actualizarTodas } from "../../_lib/rss.js";

const bool = v => (v === true || v === 1 || v === "1" || v === "true") ? 1 : 0;

async function cuerpoJson(request) {
  try { return await request.json(); } catch { return null; }
}

export async function onRequest({ request, env, params }) {
  const bad = await exigirClave(request, env);
  if (bad) return bad;
  if (!env.DB) return json({ error: "Falta conectar la base D1 (binding DB)." }, 500);

  const ruta = (Array.isArray(params.path) ? params.path : [params.path || ""]).filter(Boolean);
  const [recurso, id, accion] = ruta;
  const m = request.method;

  try {
    // ---------- resumen ----------
    if (recurso === "resumen" && m === "GET") {
      const q = async sql => (await env.DB.prepare(sql).first()).n;
      return json({
        pendientes: await q("SELECT COUNT(*) n FROM cola WHERE estado='pendiente'"),
        noticias: await q("SELECT COUNT(*) n FROM noticias WHERE estado='publicada'"),
        podcasts: await q("SELECT COUNT(*) n FROM podcasts WHERE estado='publicado'"),
        historia: await q("SELECT COUNT(*) n FROM historia WHERE estado='publicada'"),
        fuentes: await q("SELECT COUNT(*) n FROM fuentes WHERE activa=1"),
        ultimoChequeo: (await env.DB.prepare("SELECT MAX(ultimo_chequeo) t FROM fuentes").first()).t
      });
    }

    // ---------- noticias ----------
    if (recurso === "noticias") {
      if (m === "GET" && !id) {
        const estado = new URL(request.url).searchParams.get("estado");
        const { results } = await env.DB.prepare(
          "SELECT * FROM noticias" + (estado ? " WHERE estado=?" : "") + " ORDER BY publicada_en DESC LIMIT 150"
        ).bind(...(estado ? [estado] : [])).all();
        return json({ noticias: results });
      }
      if (m === "GET" && id) {
        const n = await env.DB.prepare("SELECT * FROM noticias WHERE id=?").bind(id).first();
        return n ? json(n) : json({ error: "No existe" }, 404);
      }
      if (m === "POST" || m === "PUT") {
        const b = await cuerpoJson(request);
        if (!b) return json({ error: "Datos inválidos" }, 400);
        const titulo = texto(b.titulo, 200), cuerpo = texto(b.cuerpo, 4000);
        if (!titulo || !cuerpo) return json({ error: "Falta el título o el cuerpo." }, 400);
        const cat = b.cat in CATS_NOTAS ? b.cat : "altovalle";
        const region = CATS_NOTAS[cat] ? 1 : bool(b.region);
        const imagen = b.imagen ? texto(b.imagen, 200) : null;
        const fn = texto(b.fuente_nombre, 120) || null;
        const fu = urlHttp(b.fuente_url);
        const estado = b.estado === "borrador" ? "borrador" : "publicada";
        const pub = fechaISO(b.publicada_en);
        if (m === "POST") {
          const nid = uid();
          await env.DB.prepare(
            "INSERT INTO noticias (id,slug,titulo,cuerpo,cat,region,imagen,origen,fuente_nombre,fuente_url,estado,publicada_en,creada_en,actualizada_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
          ).bind(nid, slugify(titulo), titulo, cuerpo, cat, region, imagen, fn ? "republicada" : "propia", fn, fu, estado, pub, ahora(), ahora()).run();
          return json({ id: nid }, 201);
        }
        const r = await env.DB.prepare(
          "UPDATE noticias SET titulo=?,cuerpo=?,cat=?,region=?,imagen=?,fuente_nombre=?,fuente_url=?,origen=?,estado=?,publicada_en=?,actualizada_en=? WHERE id=?"
        ).bind(titulo, cuerpo, cat, region, imagen, fn, fu, fn ? "republicada" : "propia", estado, pub, ahora(), id).run();
        return r.meta.changes ? json({ ok: true }) : json({ error: "No existe" }, 404);
      }
      if (m === "DELETE" && id) {
        await env.DB.prepare("DELETE FROM noticias WHERE id=?").bind(id).run();
        return json({ ok: true });
      }
    }

    // ---------- cola de notas de otros medios ----------
    if (recurso === "cola") {
      if (m === "GET" && !id) {
        const { results } = await env.DB.prepare(
          "SELECT c.*, f.nombre AS fuente_nombre, f.cat_default, f.sitio_url FROM cola c JOIN fuentes f ON f.id=c.fuente_id WHERE c.estado='pendiente' ORDER BY c.fecha DESC LIMIT 100"
        ).all();
        return json({ cola: results });
      }
      if (m === "POST" && id && accion === "rechazar") {
        await env.DB.prepare("UPDATE cola SET estado='rechazada' WHERE id=?").bind(id).run();
        return json({ ok: true });
      }
      if (m === "POST" && id && accion === "aceptar") {
        const c = await env.DB.prepare(
          "SELECT c.*, f.nombre AS fnombre FROM cola c JOIN fuentes f ON f.id=c.fuente_id WHERE c.id=?"
        ).bind(id).first();
        if (!c) return json({ error: "No existe" }, 404);
        const b = (await cuerpoJson(request)) || {};
        const titulo = texto(b.titulo, 200) || c.titulo;
        const cuerpo = texto(b.cuerpo, 4000) || c.resumen || c.titulo;
        const cat = b.cat in CATS_NOTAS ? b.cat : "nacional";
        const nid = uid();
        // Una nota republicada siempre lleva el medio de origen y el link a la nota completa.
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO noticias (id,slug,titulo,cuerpo,cat,region,imagen,origen,fuente_nombre,fuente_url,cola_id,estado,publicada_en,creada_en,actualizada_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
          ).bind(nid, slugify(titulo), titulo, cuerpo, cat, CATS_NOTAS[cat] ? 1 : bool(b.region), b.imagen ? texto(b.imagen, 200) : null,
            "republicada", c.fnombre, c.link, c.id, b.estado === "borrador" ? "borrador" : "publicada", ahora(), ahora(), ahora()),
          env.DB.prepare("UPDATE cola SET estado='aceptada' WHERE id=?").bind(id)
        ]);
        return json({ id: nid }, 201);
      }
    }

    // ---------- fuentes ----------
    if (recurso === "fuentes") {
      if (m === "GET" && !id) {
        const { results } = await env.DB.prepare(
          "SELECT f.*, (SELECT COUNT(*) FROM cola c WHERE c.fuente_id=f.id AND c.estado='pendiente') AS pendientes FROM fuentes f ORDER BY f.nombre"
        ).all();
        return json({ fuentes: results });
      }
      if (m === "POST" && id === "probar") {
        const b = await cuerpoJson(request);
        const url = urlHttp(b?.url);
        if (!url) return json({ error: "Esa dirección no es válida." }, 400);
        try { return json(await probarFeed(url)); }
        catch (e) { return json({ error: String(e.message || e) }, 422); }
      }
      if (m === "POST" && id === "actualizar") {
        return json({ resultado: await actualizarTodas(env) });
      }
      if (m === "POST" && id && accion === "actualizar") {
        const f = await env.DB.prepare("SELECT * FROM fuentes WHERE id=?").bind(id).first();
        return f ? json({ resultado: [await actualizarFuente(env, f)] }) : json({ error: "No existe" }, 404);
      }
      if (m === "POST" && !id) {
        const b = await cuerpoJson(request);
        const url = urlHttp(b?.feed_url), nombre = texto(b?.nombre, 120);
        if (!url || !nombre) return json({ error: "Falta el nombre o la dirección del feed." }, 400);
        const cat = b.cat_default in CATS_NOTAS ? b.cat_default : "nacional";
        const fid = uid();
        try {
          await env.DB.prepare("INSERT INTO fuentes (id,nombre,feed_url,sitio_url,cat_default,creada_en) VALUES (?,?,?,?,?,?)")
            .bind(fid, nombre, url, urlHttp(b.sitio_url), cat, ahora()).run();
        } catch { return json({ error: "Ese feed ya está cargado." }, 409); }
        const f = await env.DB.prepare("SELECT * FROM fuentes WHERE id=?").bind(fid).first();
        return json({ id: fid, resultado: await actualizarFuente(env, f) }, 201);
      }
      if (m === "PUT" && id) {
        const b = await cuerpoJson(request) || {};
        await env.DB.prepare("UPDATE fuentes SET nombre=COALESCE(?,nombre), cat_default=COALESCE(?,cat_default), activa=COALESCE(?,activa) WHERE id=?")
          .bind(b.nombre ? texto(b.nombre, 120) : null, b.cat_default in CATS_NOTAS ? b.cat_default : null,
            b.activa === undefined ? null : bool(b.activa), id).run();
        return json({ ok: true });
      }
      if (m === "DELETE" && id) {
        await env.DB.prepare("DELETE FROM fuentes WHERE id=?").bind(id).run();
        return json({ ok: true });
      }
    }

    // ---------- fotos ----------
    if (recurso === "media" && m === "POST") {
      const fd = await request.formData();
      const f = fd.get("archivo");
      if (!f || typeof f === "string") return json({ error: "Falta el archivo." }, 400);
      if (f.size > MAX_IMG_BYTES) return json({ error: "La foto pesa más de 4 MB." }, 413);
      const buf = await f.arrayBuffer();
      const t = tipoImagen(buf);
      if (!t) return json({ error: "Solo se aceptan fotos JPG, PNG o WebP." }, 415);
      const d = new Date();
      const key = `img/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${uid()}.${t.ext}`;
      await env.MEDIA.put(key, buf, { httpMetadata: { contentType: t.mime } });
      return json({ key, url: "/media/" + key }, 201);
    }

    // ---------- podcasts ----------
    if (recurso === "podcasts") {
      if (m === "GET" && !id) {
        const { results } = await env.DB.prepare("SELECT * FROM podcasts ORDER BY publicado_en DESC LIMIT 150").all();
        return json({ podcasts: results });
      }
      if (m === "POST" && !id) {
        const fd = await request.formData();
        const titulo = texto(fd.get("titulo"), 200);
        const f = fd.get("audio");
        if (!titulo) return json({ error: "Falta el título." }, 400);
        if (!f || typeof f === "string") return json({ error: "Falta el archivo de audio." }, 400);
        if (f.size > MAX_AUDIO_BYTES) return json({ error: "El audio pesa más de 12 MB." }, 413);
        const duracion = Math.round(Number(fd.get("duracion")) || 0);
        if (duracion > MAX_AUDIO_SEG) return json({ error: "El episodio supera los 5 minutos." }, 422);
        const buf = await f.arrayBuffer();
        if (!esMp3(buf)) return json({ error: "El archivo tiene que ser un MP3." }, 415);
        const pid = uid(), d = new Date();
        const key = `podcasts/${d.getUTCFullYear()}/${pid}.mp3`;
        await env.MEDIA.put(key, buf, { httpMetadata: { contentType: "audio/mpeg" } });
        const cat = CATS_POD.includes(fd.get("cat")) ? fd.get("cat") : "actualidad";
        await env.DB.prepare(
          "INSERT INTO podcasts (id,titulo,descripcion,cat,audio_key,duracion,bytes,estado,publicado_en,creado_en) VALUES (?,?,?,?,?,?,?,?,?,?)"
        ).bind(pid, titulo, texto(fd.get("descripcion"), 800), cat, key, duracion, f.size,
          fd.get("estado") === "borrador" ? "borrador" : "publicado", fechaISO(fd.get("publicado_en")), ahora()).run();
        return json({ id: pid }, 201);
      }
      if (m === "PUT" && id) {
        const b = await cuerpoJson(request) || {};
        const titulo = texto(b.titulo, 200);
        if (!titulo) return json({ error: "Falta el título." }, 400);
        await env.DB.prepare("UPDATE podcasts SET titulo=?,descripcion=?,cat=?,estado=?,publicado_en=? WHERE id=?")
          .bind(titulo, texto(b.descripcion, 800), CATS_POD.includes(b.cat) ? b.cat : "actualidad",
            b.estado === "borrador" ? "borrador" : "publicado", fechaISO(b.publicado_en), id).run();
        return json({ ok: true });
      }
      if (m === "DELETE" && id) {
        const p = await env.DB.prepare("SELECT audio_key FROM podcasts WHERE id=?").bind(id).first();
        if (p) { await env.MEDIA.delete(p.audio_key); await env.DB.prepare("DELETE FROM podcasts WHERE id=?").bind(id).run(); }
        return json({ ok: true });
      }
    }

    // ---------- historia de la radio ----------
    if (recurso === "historia") {
      if (m === "GET" && !id) {
        const { results } = await env.DB.prepare("SELECT * FROM historia ORDER BY orden, creada_en").all();
        return json({ historia: results.map(h => ({ ...h, fotos: JSON.parse(h.fotos || "[]") })) });
      }
      if (m === "POST" || m === "PUT") {
        const b = await cuerpoJson(request);
        if (!b) return json({ error: "Datos inválidos" }, 400);
        const titulo = texto(b.titulo, 200), cuerpo = texto(b.cuerpo, 20000);
        if (!titulo || !cuerpo) return json({ error: "Falta el título o el texto." }, 400);
        const fotos = (Array.isArray(b.fotos) ? b.fotos : []).slice(0, 40)
          .filter(x => x && /^img\/[\w/.-]+$/.test(String(x.key || "")))
          .map(x => ({ key: x.key, epigrafe: texto(x.epigrafe, 240) }));
        const portada = Math.min(Math.max(parseInt(b.portada) || 0, 0), Math.max(fotos.length - 1, 0));
        const vals = [titulo, texto(b.etiqueta, 40) || null, texto(b.bajada, 400) || null, cuerpo, JSON.stringify(fotos), portada,
          parseInt(b.orden) || 0, b.estado === "borrador" ? "borrador" : "publicada"];
        if (m === "POST") {
          const hid = uid();
          await env.DB.prepare(
            "INSERT INTO historia (id,slug,titulo,etiqueta,bajada,cuerpo,fotos,portada,orden,estado,creada_en,actualizada_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
          ).bind(hid, slugify(titulo), ...vals, ahora(), ahora()).run();
          return json({ id: hid }, 201);
        }
        const r = await env.DB.prepare(
          "UPDATE historia SET titulo=?,etiqueta=?,bajada=?,cuerpo=?,fotos=?,portada=?,orden=?,estado=?,actualizada_en=? WHERE id=?"
        ).bind(...vals, ahora(), id).run();
        return r.meta.changes ? json({ ok: true }) : json({ error: "No existe" }, 404);
      }
      if (m === "DELETE" && id) {
        await env.DB.prepare("DELETE FROM historia WHERE id=?").bind(id).run();
        return json({ ok: true });
      }
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: "Error interno: " + String(e.message || e) }, 500);
  }
}
