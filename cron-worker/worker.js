// Opcional: Worker con cron que pide al sitio revisar las fuentes cada 30 minutos.
// Cloudflare Pages no tiene tareas programadas, por eso va aparte. Ver LEEME.
export default {
  async scheduled(event, env) {
    await fetch(env.SITIO + "/api/admin/fuentes/actualizar", {
      method: "POST",
      headers: { authorization: "Bearer " + env.PANEL_CLAVE }
    });
  }
};
