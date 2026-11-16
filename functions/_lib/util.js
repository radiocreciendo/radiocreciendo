// Utilidades compartidas por la API pública, el panel y el lector de fuentes.

export const CATS_NOTAS = {
  altovalle: true, neuquen: true, bariloche: true, energia: true,   // regionales
  nacional: false, internacional: false, deportes: false,
  economia: false, comunidad: false, eventos: false
};
export const CATS_POD = ["actualidad", "general", "deportes", "cultura"];

export const MAX_IMG_BYTES = 4 * 1024 * 1024;     // las fotos se achican en el navegador antes de subir
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
export const MAX_AUDIO_SEG = 5 * 60;              // regla actual: episodios de hasta 5 minutos

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
  });
}

export const ahora = () => new Date().toISOString();
export const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

export function slugify(texto) {
  const base = String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 70).replace(/-+$/g, "");
  return (base || "nota") + "-" + uid().slice(0, 5);
}

// Comparación en tiempo constante, para no filtrar la clave por tiempos de respuesta.
export function iguales(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  let d = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}

export async function exigirClave(request, env) {
  if (!env.PANEL_CLAVE) return json({ error: "Falta cargar el secreto PANEL_CLAVE en Cloudflare." }, 500);
  const h = request.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!iguales(token, env.PANEL_CLAVE)) {
    await new Promise(r => setTimeout(r, 700));      // frena los intentos a ciegas
    return json({ error: "Clave incorrecta." }, 401);
  }
  return null;
}

export function texto(v, max) {
  return String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

export function urlHttp(v) {
  try {
    const u = new URL(String(v || "").trim());
    return (u.protocol === "http:" || u.protocol === "https:") ? u.toString() : null;
  } catch { return null; }
}

// Evita que el lector de fuentes sea usado para consultar la red interna.
export function hostPermitido(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return false;
    if (h.includes(":") || h.startsWith("[")) return false;
    return true;
  } catch { return false; }
}

export function fechaISO(v, defecto) {
  const d = new Date(v);
  return isNaN(d) ? (defecto || ahora()) : d.toISOString();
}

// Firmas de archivo: no nos fiamos del tipo que declara el navegador.
export function tipoImagen(bytes) {
  const b = new Uint8Array(bytes.slice(0, 12));
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return { mime: "image/webp", ext: "webp" };
  return null;
}
export function esMp3(bytes) {
  const b = new Uint8Array(bytes.slice(0, 4));
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true;          // ID3
  return b[0] === 0xFF && (b[1] & 0xE0) === 0xE0;                            // frame MPEG
}
