# 🔥 CONNECT-NASA

**Monitoreo en tiempo real de incendios activos y viento en Bolivia usando datos abiertos de la NASA (FIRMS, POWER y MERRA-2).**
**Real-time monitoring of active fires and wind in Bolivia using open NASA data (FIRMS, POWER and MERRA-2).**

---

## Selector de idioma / Language selector

- [Español](#español)
- [English](#english)

---

<a name="español"></a>

## Español

### Descripción / Overview

**CONNECT-NASA** es una aplicación web full‑stack que combina distintas fuentes de datos abiertos de la NASA para visualizar, en un mapa interactivo, los **focos de calor / incendios activos** detectados por los satélites de la constelación **FIRMS** (VIIRS y MODIS) junto con el **viento a 10 metros de altura** obtenido de **NASA POWER** y de reanálisis **MERRA-2**, con foco geográfico en **Bolivia** y sus departamentos.

El proyecto nació como una herramienta de monitoreo ambiental para correlacionar incendios forestales con condiciones de viento (velocidad y dirección), un factor clave para entender la propagación del fuego. El nombre del repositorio y el uso intensivo de APIs oficiales de la NASA (FIRMS, POWER, GES DISC/MERRA-2, GEOS-FP vía OPeNDAP) sugieren un origen relacionado con un desafío o hackathon de datos abiertos de la NASA, aunque el repositorio en su estado actual no incluye documentación explícita sobre el evento, equipo o categoría en la que participó.

**¿Para quién?** Investigadores, defensas civiles, ONGs ambientales o cualquier persona que necesite una vista rápida y visual de la actividad de incendios y viento en territorio boliviano, sin depender de herramientas de escritorio pesadas (GIS) para un vistazo operativo diario.

### Características principales

- **Mapa interactivo (Leaflet)** con múltiples capas base: OpenStreetMap, Satélite (Esri World Imagery), modo Oscuro y modo Claro (CARTO).
- **Capa de incendios activos** (FIRMS) con:
  - Agrupamiento de marcadores (`leaflet.markercluster`) que se expande al hacer zoom.
  - Colores y radios de marcador según el **nivel de confianza** de la detección (nominal, baja, media, alta, muy alta).
  - Cálculo de un **nivel de riesgo compuesto** a partir de confianza, brillo (`bright_ti4`/`bright_ti5`) y potencia radiativa del fuego (FRP).
  - Categorización automática del evento (foco de calor, incendio activo pequeño/moderado/grande) según FRP y área de píxel.
  - Conversión de horario UTC a horario local de Bolivia.
  - Popups con detalle completo de cada foco (satélite, instrumento, temperatura estimada, día/noche, etc.).
- **Selección de fuente satelital**: VIIRS S‑NPP, VIIRS NOAA‑20, VIIRS NOAA‑21, MODIS Terra & Aqua, o todas combinadas (`ALL`) con deduplicación de eventos.
- **Filtro por región**: Bolivia completa o por departamento (Santa Cruz, La Paz, Beni, Pando, Tarija, Cochabamba, Oruro, Potosí), o un `bbox` personalizado.
- **Estadísticas agregadas** (`/api/estadisticas`): totales por confianza, por satélite, por hora del día, por día, por severidad, promedios de confianza/FRP, área total afectada, tendencia (aumento/disminución respecto a las 24 h anteriores), focos más recientes y de mayor confianza.
- **Capa de viento en tiempo real (NASA POWER)**: consulta el endpoint `temporal/hourly` o `daily` de POWER para un punto (lat/lon), devolviendo series de `WS10M`, `WD10M`, `U10M`, `V10M`.
- **Capa de viento por reanálisis (MERRA-2 local)**: lectura directa de archivos NetCDF4 (`.nc4`) incluidos localmente mediante la librería `netcdfjs`, sin necesidad de conexión a internet para esta capa.
- **Animación de partículas de viento** sobre un `<canvas>` superpuesto al mapa, con control de reproducción (play/pausa), velocidad ajustable y selector de fuente (POWER vs MERRA‑2).
- **Cache en memoria** (`node-cache`) para reducir llamadas repetidas a las APIs externas (TTL de 5 min para eventos, 10 min para estadísticas).
- **Rate limiting básico** por IP (100 solicitudes/hora) para proteger el uso de la API key de FIRMS.
- **Endpoint de validación de API key** (`/api/validar`) y **endpoint de salud** (`/api/health`) para diagnóstico rápido del backend.
- **Scripts exploratorios en Python** (`geosfp_test.py`, `merra2_test.py`, `test_pydap.py`) para probar el acceso vía **OPeNDAP** a datasets **GEOS-FP** y **MERRA-2** directamente desde los servidores de la NASA (GES DISC / NCCS), usando `xarray` con los motores `netcdf4` y `pydap`. Estos scripts son utilidades de investigación independientes del servidor Node, útiles para explorar datos antes de integrarlos al backend.

### Stack tecnológico

**Backend** (`CONTROLLERFINALFINAL/backend`):
- **Node.js** (probado con v22.x) + **Express 5** — servidor HTTP y API REST.
- **node-fetch 2.x** — llamadas HTTP a las APIs de la NASA (FIRMS, POWER).
- **netcdfjs 0.7.x** — parseo de archivos NetCDF4 (MERRA‑2) en JavaScript puro.
- **node-cache** — cache en memoria con TTL.
- **cors** — configuración de CORS para desarrollo local.
- **dotenv** — carga de variables de entorno desde `.env`.
- **concurrently** + **serve** — orquestación del modo desarrollo (backend + estático del frontend).

**Frontend** (`CONTROLLERFINALFINAL/frontend`):
- HTML5 + CSS3 + **JavaScript vanilla** (sin framework, todo en `index.html`).
- **Leaflet 1.9.4** — motor de mapas interactivo.
- **Leaflet.markercluster 1.5.3** — agrupamiento de marcadores.
- Tiles de **OpenStreetMap**, **Esri World Imagery** y **CARTO** (dark/light).
- `<canvas>` nativo para la animación de partículas de viento.

**Módulo alternativo de viento** (`backend/src/`, usando ES Modules): `main.js`, `api/windAPI.js`, `api/merraAPI.js`, `layers/windLayer.js`, `layers/windReanalysis.js`, `utils/timeController.js` — una implementación paralela/experimental orientada a NASA POWER y MERRA‑2 vía Earthdata, pensada para integrarse o probarse por separado (`npm run merra`).

**Scripts de investigación en Python** (raíz del repo): `xarray`, `pydap` y/o `netCDF4` (no versionados en un `requirements.txt`; se asume un entorno con estas librerías instaladas, o el `venv` incluido en `CONTROLLERFINALFINAL/backend/nc4-tools/venv`).

**Fuentes de datos NASA utilizadas:**
- [FIRMS](https://firms.modaps.eosdis.nasa.gov/) — Fire Information for Resource Management System (incendios activos vía VIIRS/MODIS).
- [NASA POWER](https://power.larc.nasa.gov/) — Prediction Of Worldwide Energy Resources (viento a 10 m).
- [MERRA-2](https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/) — reanálisis atmosférico (GES DISC, vía OPeNDAP/Earthdata).
- [GEOS-FP](https://gmao.gsfc.nasa.gov/GMAO_products/NRT_products.php) — pronósticos operacionales (vía OPeNDAP, script exploratorio).

### Arquitectura / estructura de carpetas

```
CONNECT-NASA/
├── CONTROLLERFINALFINAL/
│   ├── backend/
│   │   ├── server.js              # Servidor Express principal: API REST + estático del frontend
│   │   ├── package.json           # Dependencias y scripts del backend
│   │   ├── .env                   # Variables de entorno (NO commitear valores reales)
│   │   ├── src/
│   │   │   ├── main.js            # Punto de entrada alternativo (módulo de viento, ES Modules)
│   │   │   ├── api/
│   │   │   │   ├── windAPI.js     # Cliente para NASA POWER
│   │   │   │   └── merraAPI.js    # Descarga de granulos MERRA-2 vía Earthdata (auth básica)
│   │   │   ├── layers/
│   │   │   │   ├── windLayer.js       # Construcción de la capa de viento (POWER)
│   │   │   │   └── windReanalysis.js  # Lectura de NetCDF local (MERRA-2)
│   │   │   ├── utils/
│   │   │   │   └── timeController.js  # Utilidades de rango de fechas
│   │   │   └── data/merra2/           # Archivos .nc4 de ejemplo (ignorados/LFS por tamaño)
│   │   └── nc4-tools/
│   │       └── venv/                  # Entorno virtual de Python para herramientas NetCDF
│   └── frontend/
│       └── index.html             # SPA de una sola página: mapa Leaflet + UI + lógica de cliente
├── geosfp_test.py                 # Script exploratorio: acceso OPeNDAP a GEOS-FP
├── merra2_test.py                 # Script exploratorio: acceso OPeNDAP a MERRA-2 (autenticado)
├── test_pydap.py                  # Script exploratorio: prueba genérica de pydap + xarray
├── package.json                   # Scripts raíz que orquestan instalación y arranque del backend
├── .gitattributes                 # Configuración de Git LFS para archivos .nc4
└── .gitignore                     # Excluye archivos .nc4 pesados del control de versiones
```

- **`CONTROLLERFINALFINAL/backend`**: corazón de la aplicación. Expone la API REST que consulta FIRMS y NASA POWER, sirve el frontend estático y lee archivos NetCDF locales para la capa MERRA‑2.
- **`CONTROLLERFINALFINAL/frontend`**: interfaz de usuario, un único `index.html` autocontenido con Leaflet y JavaScript vanilla que consume la API del backend.
- **Raíz del repo**: scripts de Python independientes usados para explorar/depurar el acceso a datasets NASA vía OPeNDAP, no forman parte del flujo de ejecución del servidor Node.

### Requisitos previos

- **Node.js 18+** (probado con Node 22).
- **npm** (incluido con Node.js).
- Una **API key gratuita de FIRMS** ([obtenerla aquí](https://firms.modaps.eosdis.nasa.gov/api/area/)) para el endpoint de incendios.
- (Opcional) Cuenta de **NASA Earthdata** si se desea descargar granulos MERRA‑2 remotos vía `merraAPI.js` o los scripts de Python.
- (Opcional, solo para los scripts Python) **Python 3.x** con `xarray`, `pydap` y/o `netCDF4` instalados.

### Instalación y configuración

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/jackson1939/connect-nasa.git
   cd connect-nasa
   ```

2. Configurar las variables de entorno del backend. Crear/editar `CONTROLLERFINALFINAL/backend/.env`:
   ```env
   FIRMS_MAP_KEY=tu_api_key_de_firms
   PORT=4000
   # Opcional, solo si se usa la descarga remota de MERRA-2:
   EARTHDATA_USER=tu_usuario_earthdata
   EARTHDATA_PASS=tu_password_earthdata
   ```

   > ⚠️ **Importante**: el repositorio actualmente tiene versionado el archivo `CONTROLLERFINALFINAL/backend/.env`. Se recomienda **rotar cualquier clave expuesta** en el historial de Git y añadir `**/.env` al `.gitignore` para evitar futuras filtraciones de credenciales.

3. Instalar dependencias y arrancar todo con un solo comando (desde la raíz):
   ```bash
   npm run start:all
   ```
   Esto ejecuta `npm install` dentro de `CONTROLLERFINALFINAL/backend` y luego inicia el servidor.

4. (Opcional) Entorno de desarrollo, con recarga del backend y servidor estático separado para el frontend:
   ```bash
   npm run dev:all
   ```

5. (Opcional) Para los scripts de Python de exploración OPeNDAP:
   ```bash
   cd CONTROLLERFINALFINAL/backend/nc4-tools
   # activar el entorno virtual incluido o crear uno nuevo
   python -m venv venv
   source venv/bin/activate   # En Windows: venv\Scripts\activate
   pip install xarray pydap netCDF4
   ```

### Uso / cómo correr el proyecto

1. Levantar el servidor (ver instalación). Por defecto queda disponible en `http://localhost:4000`.
2. Abrir `http://localhost:4000` en el navegador — el backend sirve el frontend directamente.
3. En la interfaz:
   - Elegir la **fuente satelital** (VIIRS S‑NPP, NOAA‑20, NOAA‑21, MODIS o todas).
   - Elegir la **región** (Bolivia o un departamento específico).
   - Ajustar el **rango de días** (hasta 10) a consultar en FIRMS.
   - Activar/desactivar las capas de **Incendios**, **Viento POWER** y **Viento MERRA‑2** desde el control de capas de Leaflet.
   - Usar el reproductor de viento (▶️/⏸️, control de velocidad y selector de fuente) para animar las partículas.
4. Consumir la API directamente (útil para integraciones o pruebas):
   ```bash
   # Incendios activos (VIIRS S-NPP, últimos 3 días, Bolivia)
   curl "http://localhost:4000/api/eventos?tipo=incendios&days=3&source=VIIRS_SNPP_NRT&region=bolivia"

   # Estadísticas agregadas de la última semana
   curl "http://localhost:4000/api/estadisticas?days=7&region=bolivia"

   # Viento NASA POWER en un punto
   curl "http://localhost:4000/api/wind/power?lat=-17.78&lon=-63.18&mode=hourly&days=1"

   # Viento MERRA-2 (archivo local incluido por defecto)
   curl "http://localhost:4000/api/wind/merra2?lat=-17.78&lon=-63.18"

   # Estado del servidor
   curl "http://localhost:4000/api/health"

   # Validar la API key de FIRMS configurada
   curl "http://localhost:4000/api/validar"
   ```
5. (Opcional) Ejecutar el módulo alternativo de viento (ES Modules):
   ```bash
   cd CONTROLLERFINALFINAL/backend
   npm run merra
   ```

### Variables de entorno

| Variable          | Requerida | Descripción                                                                 | Valor por defecto |
|-------------------|-----------|------------------------------------------------------------------------------|--------------------|
| `FIRMS_MAP_KEY`   | Sí        | Clave de la API de FIRMS, necesaria para `/api/eventos` y `/api/validar`.     | —                  |
| `PORT`            | No        | Puerto donde escucha el servidor Express.                                    | `4000`             |
| `EARTHDATA_USER`  | No        | Usuario de NASA Earthdata, usado por `merraAPI.js` para descargar MERRA‑2.    | —                  |
| `EARTHDATA_PASS`  | No        | Contraseña de NASA Earthdata (autenticación básica).                         | —                  |

### Datos locales incluidos

- `CONTROLLERFINALFINAL/backend/src/data/merra2/`: contiene (o espera) archivos de ejemplo `.nc4` de MERRA‑2.
- El endpoint `/api/wind/merra2` busca por defecto `MERRA2_400.tavg1_2d_slv_Nx.20240101.nc4`; se puede indicar otro archivo con el parámetro `file` (ej. `?file=/ruta/a/archivo.nc4`).
- Los archivos `.nc4` están configurados para **Git LFS** (`.gitattributes`) e ignorados en `.gitignore` por su tamaño; si el repositorio no incluye LFS habilitado o los binarios reales, será necesario descargarlos manualmente desde GES DISC.

### Estado del proyecto / roadmap

Este es un proyecto **funcional en etapa de prototipo/demo**: cubre el flujo completo (ingestión de datos NASA → API propia → visualización interactiva), pero conserva señales típicas de un desarrollo rápido tipo hackathon:

- El endpoint `/api/wind/merra2` asume un orden de dimensiones `[time, lat, lon]` fijo, sin manejo genérico de metadatos NetCDF.
- Existen dos implementaciones de la capa de viento (la integrada en `server.js` y el módulo ES Modules en `src/`) que no están unificadas.
- No hay suite de tests automatizados.
- El archivo `.env` con credenciales está versionado en el repositorio (ver advertencia de seguridad arriba).
- Los scripts de Python no tienen un `requirements.txt` propio.

Posibles mejoras futuras: unificar las dos capas de viento, agregar autenticación/roles, mover el `.env` fuera del control de versiones, añadir tests, y soportar más regiones fuera de Bolivia.

### Licencia

El repositorio **no incluye un archivo `LICENSE`**. Por lo tanto, y siguiendo el comportamiento por defecto de GitHub, todos los derechos están reservados por el autor — **no se otorga permiso explícito de uso, copia, modificación o distribución** salvo que el propietario indique lo contrario.

### Autor / contacto

- **GitHub**: [@jackson1939](https://github.com/jackson1939)
- Repositorio: [github.com/jackson1939/connect-nasa](https://github.com/jackson1939/connect-nasa)

---

<a name="english"></a>

## English

### Description / Overview

**CONNECT-NASA** is a full-stack web application that combines several open NASA data sources to visualize, on an interactive map, **active fire hotspots** detected by the **FIRMS** satellite constellation (VIIRS and MODIS) together with **10-meter wind data** from **NASA POWER** and **MERRA-2** reanalysis, geographically focused on **Bolivia** and its departments.

The project was built as an environmental monitoring tool to correlate wildfires with wind conditions (speed and direction), a key factor in understanding fire spread. The repository's name and its heavy use of official NASA APIs (FIRMS, POWER, GES DISC/MERRA-2, GEOS-FP via OPeNDAP) suggest an origin related to a NASA open-data challenge or hackathon, although the repository in its current state does not include explicit documentation about the event, team, or category it was submitted under.

**Who is it for?** Researchers, civil defense agencies, environmental NGOs, or anyone who needs a quick, visual snapshot of fire activity and wind in Bolivian territory without relying on heavy desktop GIS tools for day-to-day operational awareness.

### Key Features

- **Interactive map (Leaflet)** with multiple base layers: OpenStreetMap, Satellite (Esri World Imagery), Dark mode and Light mode (CARTO).
- **Active fire layer** (FIRMS) with:
  - Marker clustering (`leaflet.markercluster`) that expands on zoom.
  - Marker colors and sizes based on detection **confidence level** (nominal, low, medium, high, very high).
  - A **composite risk score** computed from confidence, brightness (`bright_ti4`/`bright_ti5`) and Fire Radiative Power (FRP).
  - Automatic event categorization (heat source, small/moderate/large active fire) based on FRP and pixel area.
  - UTC-to-Bolivia local time conversion.
  - Popups with full detail per hotspot (satellite, instrument, estimated temperature, day/night flag, etc.).
- **Satellite source selection**: VIIRS S-NPP, VIIRS NOAA-20, VIIRS NOAA-21, MODIS Terra & Aqua, or all combined (`ALL`) with event deduplication.
- **Region filtering**: all of Bolivia or a specific department (Santa Cruz, La Paz, Beni, Pando, Tarija, Cochabamba, Oruro, Potosí), or a custom `bbox`.
- **Aggregated statistics** (`/api/estadisticas`): totals by confidence, by satellite, by hour of day, by day, by severity, average confidence/FRP, total affected area, 24h trend (increasing/decreasing), most recent hotspots and highest-confidence hotspots.
- **Real-time wind layer (NASA POWER)**: queries POWER's `temporal/hourly` or `daily` endpoint for a given point (lat/lon), returning `WS10M`, `WD10M`, `U10M`, `V10M` series.
- **Reanalysis wind layer (local MERRA-2)**: direct parsing of local NetCDF4 (`.nc4`) files via the `netcdfjs` library, requiring no internet connection for this layer.
- **Animated wind particles** rendered on a `<canvas>` overlaid on the map, with playback controls (play/pause), adjustable speed and a source selector (POWER vs. MERRA-2).
- **In-memory caching** (`node-cache`) to reduce repeated calls to external APIs (5-minute TTL for events, 10-minute TTL for statistics).
- **Basic per-IP rate limiting** (100 requests/hour) to protect FIRMS API key usage.
- **API key validation endpoint** (`/api/validar`) and **health check endpoint** (`/api/health`) for quick backend diagnostics.
- **Exploratory Python scripts** (`geosfp_test.py`, `merra2_test.py`, `test_pydap.py`) to test **OPeNDAP** access to **GEOS-FP** and **MERRA-2** datasets directly from NASA servers (GES DISC / NCCS), using `xarray` with the `netcdf4` and `pydap` engines. These scripts are research utilities independent of the Node server, useful for exploring data before integrating it into the backend.

### Tech Stack

**Backend** (`CONTROLLERFINALFINAL/backend`):
- **Node.js** (tested with v22.x) + **Express 5** — HTTP server and REST API.
- **node-fetch 2.x** — HTTP calls to NASA APIs (FIRMS, POWER).
- **netcdfjs 0.7.x** — pure-JavaScript NetCDF4 parsing (MERRA-2).
- **node-cache** — in-memory TTL caching.
- **cors** — CORS configuration for local development.
- **dotenv** — environment variable loading from `.env`.
- **concurrently** + **serve** — orchestration of the development mode (backend + static frontend server).

**Frontend** (`CONTROLLERFINALFINAL/frontend`):
- HTML5 + CSS3 + **vanilla JavaScript** (no framework, everything in a single `index.html`).
- **Leaflet 1.9.4** — interactive map engine.
- **Leaflet.markercluster 1.5.3** — marker clustering.
- **OpenStreetMap**, **Esri World Imagery** and **CARTO** (dark/light) tile layers.
- Native `<canvas>` for the wind particle animation.

**Alternative wind module** (`backend/src/`, using ES Modules): `main.js`, `api/windAPI.js`, `api/merraAPI.js`, `layers/windLayer.js`, `layers/windReanalysis.js`, `utils/timeController.js` — a parallel/experimental implementation targeting NASA POWER and MERRA-2 via Earthdata, meant to be integrated or tested separately (`npm run merra`).

**Python research scripts** (repo root): `xarray`, `pydap` and/or `netCDF4` (not pinned in a `requirements.txt`; assumes an environment with these libraries installed, or the `venv` bundled at `CONTROLLERFINALFINAL/backend/nc4-tools/venv`).

**NASA data sources used:**
- [FIRMS](https://firms.modaps.eosdis.nasa.gov/) — Fire Information for Resource Management System (active fires via VIIRS/MODIS).
- [NASA POWER](https://power.larc.nasa.gov/) — Prediction Of Worldwide Energy Resources (10m wind).
- [MERRA-2](https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/) — atmospheric reanalysis (GES DISC, via OPeNDAP/Earthdata).
- [GEOS-FP](https://gmao.gsfc.nasa.gov/GMAO_products/NRT_products.php) — operational forecasts (via OPeNDAP, exploratory script).

### Architecture / Folder Structure

```
CONNECT-NASA/
├── CONTROLLERFINALFINAL/
│   ├── backend/
│   │   ├── server.js              # Main Express server: REST API + static frontend
│   │   ├── package.json           # Backend dependencies and scripts
│   │   ├── .env                   # Environment variables (do NOT commit real values)
│   │   ├── src/
│   │   │   ├── main.js            # Alternative entry point (wind module, ES Modules)
│   │   │   ├── api/
│   │   │   │   ├── windAPI.js     # NASA POWER client
│   │   │   │   └── merraAPI.js    # MERRA-2 granule download via Earthdata (basic auth)
│   │   │   ├── layers/
│   │   │   │   ├── windLayer.js       # Wind layer builder (POWER)
│   │   │   │   └── windReanalysis.js  # Local NetCDF reader (MERRA-2)
│   │   │   ├── utils/
│   │   │   │   └── timeController.js  # Date range utilities
│   │   │   └── data/merra2/           # Sample .nc4 files (ignored/LFS due to size)
│   │   └── nc4-tools/
│   │       └── venv/                  # Python virtual environment for NetCDF tools
│   └── frontend/
│       └── index.html             # Single-page app: Leaflet map + UI + client-side logic
├── geosfp_test.py                 # Exploratory script: OPeNDAP access to GEOS-FP
├── merra2_test.py                 # Exploratory script: authenticated OPeNDAP access to MERRA-2
├── test_pydap.py                  # Exploratory script: generic pydap + xarray test
├── package.json                   # Root scripts orchestrating backend install/start
├── .gitattributes                 # Git LFS configuration for .nc4 files
└── .gitignore                     # Excludes large .nc4 files from version control
```

- **`CONTROLLERFINALFINAL/backend`**: the heart of the application. Exposes the REST API that queries FIRMS and NASA POWER, serves the static frontend, and reads local NetCDF files for the MERRA-2 layer.
- **`CONTROLLERFINALFINAL/frontend`**: the user interface, a single self-contained `index.html` with Leaflet and vanilla JavaScript that consumes the backend API.
- **Repo root**: standalone Python scripts used to explore/debug OPeNDAP access to NASA datasets; not part of the Node server's runtime flow.

### Prerequisites

- **Node.js 18+** (tested with Node 22).
- **npm** (bundled with Node.js).
- A free **FIRMS API key** ([get one here](https://firms.modaps.eosdis.nasa.gov/api/area/)) for the fire events endpoint.
- (Optional) A **NASA Earthdata** account if you want to download remote MERRA-2 granules via `merraAPI.js` or the Python scripts.
- (Optional, Python scripts only) **Python 3.x** with `xarray`, `pydap` and/or `netCDF4` installed.

### Installation and Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/jackson1939/connect-nasa.git
   cd connect-nasa
   ```

2. Configure the backend environment variables. Create/edit `CONTROLLERFINALFINAL/backend/.env`:
   ```env
   FIRMS_MAP_KEY=your_firms_api_key
   PORT=4000
   # Optional, only needed for remote MERRA-2 downloads:
   EARTHDATA_USER=your_earthdata_username
   EARTHDATA_PASS=your_earthdata_password
   ```

   > ⚠️ **Important**: the repository currently has `CONTROLLERFINALFINAL/backend/.env` committed to version control. It is strongly recommended to **rotate any exposed key** found in the Git history and add `**/.env` to `.gitignore` to prevent future credential leaks.

3. Install dependencies and start everything with a single command (from the repo root):
   ```bash
   npm run start:all
   ```
   This runs `npm install` inside `CONTROLLERFINALFINAL/backend` and then starts the server.

4. (Optional) Development mode, with a separate static server for the frontend:
   ```bash
   npm run dev:all
   ```

5. (Optional) For the OPeNDAP exploration Python scripts:
   ```bash
   cd CONTROLLERFINALFINAL/backend/nc4-tools
   # activate the bundled virtual environment or create a new one
   python -m venv venv
   source venv/bin/activate   # On Windows: venv\Scripts\activate
   pip install xarray pydap netCDF4
   ```

### Usage

1. Start the server (see Installation). By default it's available at `http://localhost:4000`.
2. Open `http://localhost:4000` in your browser — the backend serves the frontend directly.
3. In the UI:
   - Choose the **satellite source** (VIIRS S-NPP, NOAA-20, NOAA-21, MODIS, or all combined).
   - Choose the **region** (all of Bolivia or a specific department).
   - Adjust the **day range** (up to 10) to query from FIRMS.
   - Toggle the **Fires**, **POWER Wind** and **MERRA-2 Wind** layers from Leaflet's layer control.
   - Use the wind player (▶️/⏸️, speed control, and source selector) to animate the particles.
4. Consume the API directly (useful for integrations or testing):
   ```bash
   # Active fires (VIIRS S-NPP, last 3 days, Bolivia)
   curl "http://localhost:4000/api/eventos?tipo=incendios&days=3&source=VIIRS_SNPP_NRT&region=bolivia"

   # Aggregated statistics for the last week
   curl "http://localhost:4000/api/estadisticas?days=7&region=bolivia"

   # NASA POWER wind at a point
   curl "http://localhost:4000/api/wind/power?lat=-17.78&lon=-63.18&mode=hourly&days=1"

   # MERRA-2 wind (default bundled local file)
   curl "http://localhost:4000/api/wind/merra2?lat=-17.78&lon=-63.18"

   # Server health
   curl "http://localhost:4000/api/health"

   # Validate the configured FIRMS API key
   curl "http://localhost:4000/api/validar"
   ```
5. (Optional) Run the alternative wind module (ES Modules):
   ```bash
   cd CONTROLLERFINALFINAL/backend
   npm run merra
   ```

### Environment Variables

| Variable          | Required | Description                                                                | Default |
|-------------------|----------|-------------------------------------------------------------------------------|---------|
| `FIRMS_MAP_KEY`   | Yes      | FIRMS API key, required for `/api/eventos` and `/api/validar`.               | —       |
| `PORT`            | No       | Port the Express server listens on.                                          | `4000`  |
| `EARTHDATA_USER`  | No       | NASA Earthdata username, used by `merraAPI.js` to download MERRA-2 data.      | —       |
| `EARTHDATA_PASS`  | No       | NASA Earthdata password (basic authentication).                              | —       |

### Bundled Local Data

- `CONTROLLERFINALFINAL/backend/src/data/merra2/`: holds (or expects) sample MERRA-2 `.nc4` files.
- The `/api/wind/merra2` endpoint defaults to `MERRA2_400.tavg1_2d_slv_Nx.20240101.nc4`; a different file can be specified with the `file` query parameter (e.g. `?file=/path/to/file.nc4`).
- `.nc4` files are configured for **Git LFS** (`.gitattributes`) and ignored via `.gitignore` due to their size; if the repository does not have LFS enabled or the actual binaries, they will need to be downloaded manually from GES DISC.

### Project Status / Roadmap

This is a **functional prototype/demo-stage project**: it covers the full flow (NASA data ingestion → custom API → interactive visualization), but retains typical signs of rapid, hackathon-style development:

- The `/api/wind/merra2` endpoint assumes a fixed `[time, lat, lon]` dimension order, without generic NetCDF metadata handling.
- There are two separate wind layer implementations (the one integrated into `server.js` and the ES Modules module under `src/`) that are not unified.
- No automated test suite exists.
- The `.env` file with credentials is committed to the repository (see the security warning above).
- The Python scripts have no dedicated `requirements.txt`.

Possible future improvements: unify the two wind layers, add authentication/roles, remove `.env` from version control, add tests, and support regions beyond Bolivia.

### License

The repository **does not include a `LICENSE` file**. Therefore, following GitHub's default behavior, all rights are reserved by the author — **no explicit permission is granted to use, copy, modify, or distribute** this code unless the owner states otherwise.

### Author / Contact

- **GitHub**: [@jackson1939](https://github.com/jackson1939)
- Repository: [github.com/jackson1939/connect-nasa](https://github.com/jackson1939/connect-nasa)
