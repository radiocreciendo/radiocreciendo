-- Radio Creciendo · esquema de la base (Cloudflare D1)
-- Se pega una sola vez en D1 → Console. Es seguro volver a correrlo.

CREATE TABLE IF NOT EXISTS fuentes (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  feed_url      TEXT NOT NULL UNIQUE,
  sitio_url     TEXT,
  cat_default   TEXT NOT NULL DEFAULT 'nacional',
  activa        INTEGER NOT NULL DEFAULT 1,
  ultimo_chequeo TEXT,
  ultimo_error  TEXT,
  creada_en     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cola (
  id          TEXT PRIMARY KEY,
  fuente_id   TEXT NOT NULL REFERENCES fuentes(id) ON DELETE CASCADE,
  guid        TEXT NOT NULL,
  titulo      TEXT NOT NULL,
  resumen     TEXT,
  link        TEXT NOT NULL,
  imagen      TEXT,
  fecha       TEXT NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'pendiente',   -- pendiente | aceptada | rechazada
  creada_en   TEXT NOT NULL,
  UNIQUE (fuente_id, guid)
);
CREATE INDEX IF NOT EXISTS idx_cola_estado ON cola (estado, fecha DESC);

CREATE TABLE IF NOT EXISTS noticias (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  titulo        TEXT NOT NULL,
  cuerpo        TEXT NOT NULL,
  cat           TEXT NOT NULL DEFAULT 'altovalle',
  region        INTEGER NOT NULL DEFAULT 0,
  imagen        TEXT,                               -- clave en R2
  origen        TEXT NOT NULL DEFAULT 'propia',     -- propia | republicada
  fuente_nombre TEXT,
  fuente_url    TEXT,
  cola_id       TEXT,
  estado        TEXT NOT NULL DEFAULT 'publicada',  -- publicada | borrador
  publicada_en  TEXT NOT NULL,
  creada_en     TEXT NOT NULL,
  actualizada_en TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_noticias_pub ON noticias (estado, publicada_en DESC);

CREATE TABLE IF NOT EXISTS podcasts (
  id           TEXT PRIMARY KEY,
  titulo       TEXT NOT NULL,
  descripcion  TEXT,
  cat          TEXT NOT NULL DEFAULT 'actualidad',
  audio_key    TEXT NOT NULL,                       -- clave en R2
  duracion     INTEGER NOT NULL DEFAULT 0,
  bytes        INTEGER NOT NULL DEFAULT 0,
  estado       TEXT NOT NULL DEFAULT 'publicado',   -- publicado | borrador
  publicado_en TEXT NOT NULL,
  creado_en    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_podcasts_pub ON podcasts (estado, publicado_en DESC);

CREATE TABLE IF NOT EXISTS historia (
  id        TEXT PRIMARY KEY,
  slug      TEXT NOT NULL UNIQUE,
  titulo    TEXT NOT NULL,
  etiqueta  TEXT,                                   -- "1989", "Los años 90", etc.
  bajada    TEXT,
  cuerpo    TEXT NOT NULL,
  fotos     TEXT NOT NULL DEFAULT '[]',             -- JSON: [{key, epigrafe}]
  portada   INTEGER NOT NULL DEFAULT 0,             -- posición de la foto de portada
  orden     INTEGER NOT NULL DEFAULT 0,
  estado    TEXT NOT NULL DEFAULT 'publicada',
  creada_en TEXT NOT NULL,
  actualizada_en TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_historia_orden ON historia (estado, orden, creada_en);
