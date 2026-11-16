// Sirve fotos y MP3 guardados en R2, con soporte de Range para poder adelantar el audio.
export async function onRequest({ request, env, params }) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Método no permitido", { status: 405 });
  const key = (Array.isArray(params.key) ? params.key : [params.key]).join("/");
  if (!/^(img|podcasts)\/[\w/.-]+$/.test(key) || key.includes("..")) return new Response("No encontrado", { status: 404 });
  if (!env.MEDIA) return new Response("Sin almacenamiento", { status: 503 });

  const pideRango = request.headers.get("range");
  const obj = await env.MEDIA.get(key, pideRango ? { range: request.headers } : undefined);
  if (!obj) return new Response("No encontrado", { status: 404 });

  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set("etag", obj.httpEtag);
  h.set("accept-ranges", "bytes");
  h.set("cache-control", "public, max-age=31536000, immutable");   // las claves no se reutilizan
  h.set("x-content-type-options", "nosniff");

  let status = 200;
  if (pideRango && obj.range) {
    const off = obj.range.offset ?? 0;
    const len = obj.range.length ?? (obj.size - off);
    h.set("content-range", `bytes ${off}-${off + len - 1}/${obj.size}`);
    h.set("content-length", String(len));
    status = 206;
  } else {
    h.set("content-length", String(obj.size));
  }
  return new Response(request.method === "HEAD" ? null : obj.body, { status, headers: h });
}
