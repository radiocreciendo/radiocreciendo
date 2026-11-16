# Dashboard de Radio Creciendo — puesta en marcha

El dashboard vive en **radiocreciendo.com/admin** y reemplaza el flujo de "bajar el JSON y subirlo a GitHub". Todo se carga con un botón y aparece en el sitio al instante.

**Requisito:** el sitio tiene que estar en **Cloudflare Pages** (Netlify no ejecuta estas funciones). Si todavía está en Netlify, primero hay que hacer la Fase 2 de la mudanza.

## Qué hace

| Pestaña | Para qué |
|---|---|
| **Notas de otros medios** | Cola de notas que llegan de los feeds RSS que cargaste. Aceptás y reescribís, o rechazás. Lo aceptado se publica con crédito y link al medio original |
| **Noticias** | Notas propias y todas las publicadas: crear, editar, borrador, borrar, foto opcional |
| **Fuentes** | Alta de medios por su feed RSS (con botón *Probar*), pausar, revisar ahora, quitar |
| **Podcasts** | Subir MP3 (hasta 5 minutos), editar, borrar. El audio se guarda en R2 |
| **Historia** | Entradas tipo blog con varias fotos, epígrafes, foto de portada y línea de tiempo. Se ven en `/historia.html` |

Las notas tienen link compartible: `nota.html?s=...`.

## Instalación (una sola vez, unos 15 minutos)

Todo se hace desde el panel de Cloudflare, sin instalar nada.

**1. Subir los archivos a GitHub.** Descomprimí el ZIP, arrastrá todo su contenido al repositorio (*Add file → Upload files*) y *Commit changes*. Cloudflare publica solo. Las carpetas `functions`, `admin`, `db` y `cron-worker` tienen que mantener su estructura.

**2. Crear la base de datos.** *Storage & Databases → D1 → Create database*, nombre `radiocreciendo`. Abrí la pestaña **Console**, pegá todo el contenido de `db/schema.sql` y ejecutalo. Es seguro correrlo de nuevo.

**3. Crear el almacenamiento de fotos y audios.** *R2 → Create bucket*, nombre `radiocreciendo-media`. Dejalo privado: el sitio lo sirve a través de `/media/`.

**4. Conectar todo al proyecto.** *Workers & Pages → tu proyecto → Settings → Bindings*:
- *D1 database*: nombre de variable `DB`, base `radiocreciendo`.
- *R2 bucket*: nombre de variable `MEDIA`, bucket `radiocreciendo-media`.

**5. Cargar la clave.** *Settings → Variables and Secrets → Add*, tipo **Secret**, nombre `PANEL_CLAVE`. Que sea larga y nueva. No la compartas por chat ni por mail.

**6. Volver a publicar.** *Deployments → Retry deployment*, para que tome los bindings y el secreto.

**7. Probar.** Entrá a `radiocreciendo.com/admin` con la clave, agregá una nota y mirala en la portada.

## Fuentes de otros medios

1. Pestaña **Fuentes**, pegá la dirección del feed RSS (suele terminar en `/feed` o `/rss`) y tocá **Probar**. Si trae notas, **Agregar fuente**.
2. Las notas nuevas llegan a **Notas de otros medios**. Al abrir esa pestaña, el panel revisa las fuentes si pasaron más de 30 minutos desde la última vez.
3. Para que se revisen **solas aunque nadie abra el panel**, desplegá el Worker de `cron-worker/` (revisa cada 30 minutos):
   ```
   cd cron-worker
   npx wrangler deploy
   npx wrangler secret put PANEL_CLAVE
   ```
   Es opcional: sin él, el botón *Buscar notas nuevas* hace lo mismo.

**Reglas de la casa para republicar**
- El sistema guarda solo título, un resumen corto, el link y la fecha. No copia la nota completa.
- Al aceptar, reescribí el texto con tus palabras para la radio. Toda nota republicada sale con el nombre del medio y el link a la nota original, y no se puede quitar.
- Conviene pedir autorización a cada medio antes de cargar su feed, o elegir los que ofrecen sus notas para ser republicadas.
- Las fotos de otros medios no se copian; si querés ilustrar una nota, subí una foto propia.

## Historia de la radio

En el editor:
- Una línea en blanco separa los párrafos.
- Una línea que empieza con `## ` es un subtítulo.
- `[foto:2]` en su propia línea pone la foto 2 en ese lugar. El botón **En el texto** de cada foto lo inserta donde está el cursor.
- Las fotos que no pongas en el texto salen en una galería al final.
- La foto marcada como **Portada** encabeza la entrada y la tarjeta de la línea de tiempo.
- El número de **posición** ordena las entradas (menor = primero).

Las fotos se achican en el navegador antes de subir (1600 px, JPG), así que podés usar las del celular sin preocuparte por el peso.

## Seguridad y límites

- Todo el panel está protegido por `PANEL_CLAVE`, que viaja solo por https. Tras una clave incorrecta, el servidor demora la respuesta.
- `/admin` no se indexa en buscadores ni se guarda en caché.
- Las subidas se validan por el contenido del archivo, no por su extensión: solo JPG, PNG, WebP y MP3.
- Topes: fotos de hasta 4 MB (ya achicadas), audios de hasta 12 MB y 5 minutos.
- Si se pierde o se filtra la clave, se cambia en *Settings → Variables and Secrets* y se reintenta el deploy.
- Los planes gratuitos de Cloudflare (Pages Functions, D1 y R2) alcanzan de sobra para una radio local. Si el tráfico crece, revisá los límites vigentes en la documentación de Cloudflare.

## Lo que sigue usando el panel viejo

`panel.html` sigue sirviendo para **Sponsors** y **Farmacias**, que todavía funcionan con los JSON del repositorio. Las notas y los podcasts ya no se cargan ahí: se cargan en `/admin`. Los archivos `noticias.json` y `podcasts.json` quedan como respaldo: el sitio los usa solo si la base no responde.
