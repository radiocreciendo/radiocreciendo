// Lector de fuentes RSS / Atom. Sin dependencias: corre dentro de Cloudflare Workers.
import { uid, ahora, fechaISO, urlHttp, hostPermitido } from "./util.js";

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodificar(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => safeChar(parseInt(n, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
function safeChar(n) { try { return String.fromCodePoint(n); } catch { return ""; } }

export function aTexto(html) {
  return decodificar(
    decodificar(String(html || ""))
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|li|h\d)>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function etiqueta(bloque, nombre) {
  const m = bloque.match(new RegExp("<" + nombre + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + nombre + ">", "i"));
  return m ? m[1] : "";
}
function atributo(bloque, etiq, attr) {
  const m = bloque.match(new RegExp("<" + etiq + "\\b[^>]*\\b" + attr + "=[\"']([^\"']+)[\"']", "i"));
  return m ? decodificar(m[1]) : "";
}

export function leerFeed(xml) {
  const bloques = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  const items = [];
  for (const b of bloques) {
    const titulo = aTexto(etiqueta(b, "title"));
    let link = aTexto(etiqueta(b, "link"));
    if (!link) {
      const alt = b.match(/<link\b[^>]*rel=["']alternate["'][^>]*>/i) || b.match(/<link\b[^>]*>/i);
      if (alt) { const h = alt[0].match(/href=["']([^"']+)["']/i); if (h) link = decodificar(h[1]); }
    }
    const contenido = etiqueta(b, "content:encoded") || etiqueta(b, "content") || etiqueta(b, "description") || etiqueta(b, "summary");
    const resumen = aTexto(contenido).slice(0, 600);
    const guid = aTexto(etiqueta(b, "guid") || etiqueta(b, "id")) || link || titulo;
    const fecha = fechaISO(aTexto(etiqueta(b, "pubDate") || etiqueta(b, "published") || etiqueta(b, "updated") || etiqueta(b, "dc:date")));

    let imagen = atributo(b, "media:content", "url") || atributo(b, "media:thumbnail", "url");
    if (!imagen) {
      const enc = b.match(/<enclosure\b[^>]*>/i);
      if (enc && /image\//i.test(enc[0])) { const u = enc[0].match(/url=["']([^"']+)["']/i); if (u) imagen = decodificar(u[1]); }
    }
    if (!imagen) { const im = decodificar(contenido).match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i); if (im) imagen = im[1]; }

    if (titulo && urlHttp(link)) {
      items.push({ titulo, link: urlHttp(link), resumen, guid, fecha, imagen: urlHttp(imagen) || null });
    }
  }
  return items;
}

async function bajar(url) {
  if (!urlHttp(url) || !hostPermitido(url)) throw new Error("Dirección no permitida");
  const r = await fetch(url, {
    headers: { "user-agent": "RadioCreciendoBot/1.0 (+https://radiocreciendo.com)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(9000),
    redirect: "follow"
  });
  if (!r.ok) throw new Error("El sitio respondió " + r.status);
  const xml = (await r.text()).slice(0, 2_000_000);
  if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error("No parece un feed RSS o Atom");
  return xml;
}

// Prueba una dirección antes de agregarla: devuelve el nombre del sitio y cuántas notas trae.
export async function probarFeed(url) {
  const xml = await bajar(url);
  const items = leerFeed(xml);
  const canal = xml.replace(/<(item|entry)[\s>][\s\S]*$/i, "");
  const nombre = aTexto(etiqueta(canal, "title"));
  const sitio = urlHttp(aTexto(etiqueta(canal, "link"))) || atributo(canal, "link", "href");
  return { nombre, sitio: urlHttp(sitio) || null, cantidad: items.length, muestra: items.slice(0, 3).map(i => i.titulo) };
}

const MAX_ANTIGUEDAD_MS = 5 * 24 * 3600 * 1000;   // la primera vez no se inunda la cola con notas viejas

export async function actualizarFuente(env, f) {
  let nuevas = 0;
  try {
    const items = leerFeed(await bajar(f.feed_url)).slice(0, 40);
    for (const it of items) {
      if (Date.now() - new Date(it.fecha).getTime() > MAX_ANTIGUEDAD_MS) continue;
      const r = await env.DB.prepare(
        "INSERT OR IGNORE INTO cola (id, fuente_id, guid, titulo, resumen, link, imagen, fecha, creada_en) VALUES (?,?,?,?,?,?,?,?,?)"
      ).bind(uid(), f.id, it.guid.slice(0, 500), it.titulo.slice(0, 300), it.resumen, it.link, it.imagen, it.fecha, ahora()).run();
      nuevas += r.meta?.changes || 0;
    }
    await env.DB.prepare("UPDATE fuentes SET ultimo_chequeo=?, ultimo_error=NULL WHERE id=?").bind(ahora(), f.id).run();
    return { id: f.id, nombre: f.nombre, nuevas };
  } catch (e) {
    await env.DB.prepare("UPDATE fuentes SET ultimo_chequeo=?, ultimo_error=? WHERE id=?")
      .bind(ahora(), String(e.message || e).slice(0, 200), f.id).run();
    return { id: f.id, nombre: f.nombre, nuevas, error: String(e.message || e) };
  }
}

export async function actualizarTodas(env) {
  const { results } = await env.DB.prepare("SELECT * FROM fuentes WHERE activa=1").all();
  const salida = [];
  for (const f of results) salida.push(await actualizarFuente(env, f));
  // orden en la casa: se limpian las decididas hace más de 30 días
  await env.DB.prepare("DELETE FROM cola WHERE estado!='pendiente' AND creada_en < ?")
    .bind(new Date(Date.now() - 30 * 864e5).toISOString()).run();
  await env.DB.prepare("DELETE FROM cola WHERE estado='pendiente' AND fecha < ?")
    .bind(new Date(Date.now() - 14 * 864e5).toISOString()).run();
  return salida;
}
