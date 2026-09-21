# Radio Creciendo 102.1 — sitio web y app

Todo el sitio son archivos estáticos. No hace falta base de datos, ni PHP, ni
servidor especial: se sube por FTP y anda.

```
index.html              el sitio (reproductor + feed)
noticias.json           las notas del día ← este es el archivo que se actualiza
podcasts.json           los episodios publicados
podcasts/               acá van los MP3 de los episodios
sponsors.json           los auspiciantes al aire
farmacias.json          el cronograma de turnos del mes
img/sponsors/           acá van los JPG de la publicidad (1920x400)
panel.html              panel para cargar notas y episodios, y bajar los JSON
manifest.webmanifest    datos de la app (nombre, íconos, colores)
sw.js                   hace que abra rápido y funcione sin señal
robots.txt
img/                    logo e íconos
```

---

## Paso 1 — El stream (ya contratado)

La radio está en **Genex**, con panel SonicPanel. Dos direcciones distintas que
conviene no confundir:

- `genexservicios.com:2000` → el **panel de administración**. Ahí entrás vos.
- `genexservicios.com:8064` → el **servidor de tu emisora**. De ahí sale el audio.

Los datos del OptiCodec (servidor, puerto 8064 y contraseña) son para
**transmitir**. Esa contraseña no va nunca en los archivos del sitio.

### La dirección de escucha

Ya está cargada y probada. En `index.html`, cerca del final:

```js
const STREAM_URLS = [
  "https://genexservicios.com:2000/stream/fmcreciendo"
];
```

Es el proxy con SSL de SonicPanel. Suena por https, que es justamente lo que
el sitio necesita.

Si alguna vez Genex cambia algo y el botón deja de sonar, abrí
**test-stream.html**: prueba diez variantes posibles y te marca en verde la que
esté activa. La agregás a esa lista y listo.

### Si probás en la vista previa de Claude y no suena

Es normal: esa vista corre en un entorno cerrado que sólo deja cargar recursos
de una lista corta de dominios, y genexservicios.com no está ahí. Por eso la
cortina de los podcasts sí suena (va incrustada en el archivo) y el vivo no.

Para probar de verdad, abrí `index.html` desde tu computadora haciendo doble
clic, o directamente subí el sitio al hosting.

### Por qué importaba el https

Si el stream fuera `http`, el navegador lo bloquearía en silencio dentro de un
sitio `https` y parecería que el reproductor está roto. Con la dirección de
arriba eso ya está resuelto: SonicPanel entrega el audio cifrado.

## Paso 2 — Subir a radiocreciendo.com

El dominio ya está registrado en GoDaddy. Falta el hosting, que puede ser el de
GoDaddy o cualquier otro; el sitio es tan liviano que el plan más barato sirve.

1. Entrar al panel de hosting y abrir el **Administrador de archivos** (o conectarse
   por FTP con FileZilla).
2. Subir **todo el contenido de esta carpeta** dentro de `public_html`
   (o `httpdocs`, según el proveedor). Que `index.html` quede en la raíz.
3. Activar el **certificado SSL gratuito** desde el panel de GoDaddy. Sin https no
   se puede instalar como app ni reproducir audio seguro.
4. Entrar a `https://radiocreciendo.com` y probar el botón.

**Alternativa sin contratar hosting:** subir la carpeta a *Netlify* o *Cloudflare
Pages* (los dos tienen plan gratis con https incluido) y en GoDaddy apuntar los
DNS del dominio hacia ahí. Es gratis, más rápido y se actualiza arrastrando la
carpeta al navegador.

---

## Paso 3 — Cargar las notas del día

1. Entrar a `https://radiocreciendo.com/panel.html`
2. Tocar **Cargar las del sitio** para traer lo que ya está publicado.
3. Escribir, editar o borrar notas. El contador avisa cuándo el cuerpo queda en
   las cuatro líneas justas (entre 300 y 480 caracteres).
4. Tocar **Bajar noticias.json** y subir ese archivo a la raíz del sitio,
   reemplazando el anterior.

El panel guarda un borrador en el navegador, así que se puede cerrar y seguir
después. No toca el sitio publicado hasta que se sube el archivo.

> Si querés que el panel quede privado, poné una contraseña a esa dirección desde
> el panel de hosting (la opción suele llamarse *Directory Privacy* o
> *Protección de directorios*).

---

## Los podcasts

El sitio tiene un botón **Podcasts** arriba, al lado de "Notas del día", que
cambia el feed por la lista de episodios. Cada uno se escucha ahí mismo, sin
salir de la página, y si empezás un episodio se corta el vivo (y al revés).

El límite son **5 minutos por episodio**. El panel lo controla solo: cuando
elegís el MP3 te mide la duración y te avisa si se pasa.

### Cómo cargar un episodio

Un sitio estático no puede recibir archivos, así que el audio y los datos van
por caminos distintos:

1. Grabás el episodio y lo exportás en MP3, 96 o 128 kbps (mono alcanza y sobra
   para voz sola; un episodio de 5 minutos pesa menos de 4 MB).
2. Entrás a `panel.html`, pestaña **Podcasts**, y tocás "Episodio nuevo".
3. Elegís el archivo con el botón verde. El panel **no lo sube**: sólo lo mide y
   te arma el nombre sugerido. Completás título, descripción y sección.
4. Subís el MP3 a la carpeta `podcasts/` del sitio, por FTP o desde el
   administrador de archivos del hosting.
5. Bajás el `podcasts.json` y lo subís a la raíz, reemplazando el anterior.

### Cuando tengas el VPS andando

AzuraCast trae gestión de podcasts incorporada: subís el episodio desde su
interfaz web, queda alojado en el servidor y genera solo un feed RSS público
compatible con Spotify, Apple Podcasts y el resto de los agregadores.

Con eso el paso 4 de arriba desaparece: en vez de subir el MP3 por FTP, lo
cargás en AzuraCast y en el campo "Ruta del audio" del panel pegás la URL
pública que te da. Conviene hacerlo así apenas el servidor esté listo, porque
además te suma la distribución en las plataformas de podcast.

### Las secciones de episodios

`actualidad`, `general` (interés general), `deportes` y `cultura`. Para agregar
más, editá `CAT_POD` en `index.html` y en `panel.html`.

---

## El zócalo de auspiciantes

Debajo del botón de escuchar en vivo hay una franja a todo el ancho con la
publicidad. Va rotando sola cada 7 segundos, con puntitos para saltar a un
aviso puntual. Se frena cuando el dedo o el mouse están encima, cuando el
oyente cambia de pestaña, y también si el sistema tiene activada la opción de
reducir movimiento.

Cada visita baraja el orden, así que ningún comercio queda siempre último. La
excepción son los marcados como **Siempre primero** en el panel: esos abren
siempre, en el orden en que están cargados. Es el lugar que le corresponde al
sponsor principal, el que paga la exclusividad de la primera posición.

### La medida del arte

**1920 × 400 píxeles**, JPG, siempre la misma. La página lo escala sola: en un
celular de 390 px de ancho queda en 390 × 81. No hace falta preparar versiones
para móvil.

Para que se lea en el celular, pedile a quien diseñe el aviso:

- El nombre del comercio en **100 px de alto como mínimo** sobre ese lienzo
  (en un celular eso termina siendo unos 20 px reales).
- El texto secundario en **50 px como mínimo**.
- Nada importante pegado a los bordes: dejá unos 80 px de margen.
- Evitar párrafos: en un zócalo de esta proporción sólo entra un nombre, una
  línea corta y un teléfono.

Si querés otra proporción, cambiá `--zocalo-prop` en el CSS de `index.html`
(por ejemplo `1920 / 480` para que sea más alto). No hay que tocar nada más.

### Cargar un auspiciante

1. Panel, pestaña **Sponsors**, botón "Auspiciante nuevo".
2. "Revisar el arte" y elegís el JPG: el panel te confirma si vino en la medida
   correcta o te dice en cuánto llegó.
3. Completás nombre y, si querés, un enlace (la web del comercio o un
   `https://wa.me/549299...` para que abra WhatsApp).
4. La casilla **Al aire** te deja sacar un aviso sin borrarlo, para cuando se
   vence el contrato y capaz vuelve. La casilla **Siempre primero** lo saca de
   la rotación aleatoria y lo fija al inicio.
5. Subís el JPG a `img/sponsors/` y bajás el `sponsors.json` a la raíz.

El campo "Segundos por aviso" cambia la velocidad de rotación para todos.

Si no hay ningún auspiciante activo, la franja entera desaparece sola: no queda
un hueco vacío en la página.

---

## Farmacias de turno

Debajo de la publicidad hay una franja verde que muestra **la farmacia que está
de turno en este momento**. Tocándola se abre la pestaña Farmacias con el mes
completo, cada dirección enlazada a Google Maps.

### El detalle que importa

El turno va de las 08:30 a las 08:30 del día siguiente. El sitio tiene eso en
cuenta: **a las 3 de la mañana del día 16 sigue mostrando la farmacia del 15**,
que es la que realmente está abierta. Y ese es justo el horario en que la gente
entra a buscar el dato, así que no es un detalle menor.

La franja se recalcula sola si alguien dejó la pestaña abierta toda la noche.

### Actualizarlo cada mes

1. Panel, pestaña **Farmacias**.
2. Elegí mes y año, y pegá el cronograma en el cuadro grande, una línea por día:

```
1: Norte - La Esmeralda 1604 / Del Centro - Roca 607
2: Limay - San Martín 702 / Cruz del Sur - Alem 1899
5: Del Pueblo - España 252
```

El día, dos puntos, y cada farmacia con su dirección separada por un guion. Si
hay dos, van con barra en el medio. Si es una sola, sin barra.

3. Abajo del cuadro te va avisando si falta algún día o si alguna farmacia quedó
   sin dirección. Cuando diga que el mes está completo, bajá el `farmacias.json`
   y subilo a la raíz.

Si el calendario cargado es de un mes ya vencido, la franja deja de mostrar una
farmacia puntual y pasa a invitar a ver el cronograma, en vez de dar un dato
equivocado.

---

## Paso 4 — La app de Android

El sitio ya es una **PWA**: cualquiera puede entrar desde el celular y elegir
"Agregar a pantalla de inicio". Queda con ícono propio, sin barra de navegador y
con los controles del reproductor en la pantalla bloqueada.

Para publicarla en **Google Play** hay que envolverla en una TWA (Trusted Web
Activity), que es básicamente la misma web adentro de un APK:

1. Entrar a **pwabuilder.com** y pegar `https://radiocreciendo.com`
2. Elegir *Android · Google Play* y descargar el paquete. Sale un `.aab` firmado
   y un archivo `assetlinks.json`.
3. Subir `assetlinks.json` al sitio, en la ruta `/.well-known/assetlinks.json`.
   Ese archivo es el que le demuestra a Android que la app y el dominio son tuyos;
   sin él la app abre con barra de navegador arriba.
4. Crear la cuenta de **Google Play Console** (pago único de 25 dólares), cargar el
   `.aab`, las capturas, el ícono y la descripción, y mandar a revisión.

La revisión suele tardar unos días. Un detalle a tener en cuenta: Google pide que
una app de radio aporte algo más que el stream solo, y el feed de noticias
justamente cumple con eso.

Para iOS el camino es distinto y más caro (99 dólares al año y hay que compilar
con Xcode). Conviene arrancar por Android y dejar iOS para más adelante: en
iPhone, mientras tanto, la PWA se instala igual desde Safari.

---

## Sobre las notas que vienen cargadas

El `noticias.json` viene con quince notas de ejemplo armadas con temas reales del
14 y 15 de septiembre, escritas con nuestras propias palabras a modo de muestra
del formato. **Antes de publicar, conviene chequear cada dato contra la fuente
original y reescribir lo que haga falta**, como con cualquier material de agencia.

## Detalles del feed

Cada nota es un bloque así:

```json
{
  "id": "n01",
  "cat": "altovalle",
  "hora": "2026-09-15T09:00:00-03:00",
  "region": true,
  "titulo": "El título, una línea",
  "cuerpo": "Cuatro oraciones cortas."
}
```

- `cat` puede ser: `altovalle`, `neuquen`, `bariloche`, `energia`, `nacional`,
  `internacional`, `deportes`, `economia`, `comunidad`, `eventos`.
- `hora` siempre con `-03:00` al final. El sitio muestra hora argentina aunque el
  oyente esté en otro país.
- `region` es opcional: ponelo en `true` cuando la nota sea de la zona aunque la
  sección sea general. Es lo que enciende el puntito verde y la incluye en el
  filtro "De la región".

Para sumar secciones nuevas, agregarlas en `CATEGORIAS` y `FILTROS` dentro de
`index.html`, y también en `CATEGORIAS` dentro de `panel.html`.

## Si cambiás archivos y no se ven los cambios

El `sw.js` guarda una copia local para que el sitio abra rápido. Cuando toques el
diseño, subí el número de versión en la primera línea:

```js
const VERSION = "creciendo-v2";
```

El `noticias.json` no necesita eso: siempre se pide fresco a la red.
