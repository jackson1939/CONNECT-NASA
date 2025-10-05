Proyecto NASA 2.0 – Monitoreo de Incendios y Viento (FIRMS, POWER, MERRA-2)

Requisitos
- Node.js 18+
- (Opcional) Cuenta NASA Earthdata si deseas descargar MERRA‑2 desde la API

Estructura
- `CONTROLLERFINALFINAL/backend`: servidor Express que sirve la API y el frontend
- `CONTROLLERFINALFINAL/frontend`: aplicación Leaflet que consume la API

Arranque rápido (un solo comando)
- Instalar dependencias y arrancar todo:
  - En la raíz: `npm run start:all`
- Modo desarrollo (backend + servidor estático para frontend):
  - En la raíz: `npm run dev:all`

Variables de entorno (`CONTROLLERFINALFINAL/backend/.env`)
- `FIRMS_MAP_KEY`: clave de FIRMS para `/api/eventos`
- (Opcional) `EARTHDATA_USER` y `EARTHDATA_PASS`: credenciales para descargar MERRA‑2 vía API (si se habilita uso remoto)
- `PORT` (opcional): por defecto 4000

Endpoints principales
- Incendios (FIRMS): `GET /api/eventos?tipo=incendios&days=3&source=VIIRS_SNPP_NRT&region=bolivia`
- Estadísticas: `GET /api/estadisticas?days=7&region=bolivia`
- Salud: `GET /api/health`
- Viento POWER (punto): `GET /api/wind/power?lat=-17.78&lon=-63.18&mode=hourly&days=1`
- Viento MERRA‑2 local: `GET /api/wind/merra2?lat=-17.78&lon=-63.18`

Visualización
- El mapa soporta capas base (OSM, Satélite, Claro, Oscuro) y overlays:
  - `🔥 Incendios` (clúster + popups)
  - `💨 Viento (10m) POWER` (flecha en centro del mapa)
  - `💨 Viento (MERRA‑2)` (flecha en centro del mapa desde NetCDF local)

Datos locales MERRA‑2
- Archivos de ejemplo: `CONTROLLERFINALFINAL/backend/src/data/merra2/`
- El endpoint local busca por defecto `MERRA2_400.tavg1_2d_slv_Nx.20240101.nc4`
- Puedes pasar `file` por query si deseas un path específico: `GET /api/wind/merra2?lat=..&lon=..&file=C:/ruta/archivo.nc4`

Notas
- Si no configuras `FIRMS_MAP_KEY`, `/api/eventos` devolverá error de key faltante.
- El frontend se sirve desde el backend en producción (ruta `/`).
