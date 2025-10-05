// backend/server.js
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const NodeCache = require('node-cache');
const path = require('path');

const app = express();

// CORS configurado explícitamente para entornos locales comunes
const allowedOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  `http://localhost:${process.env.PORT || 4000}`
];
app.use(cors({
  origin: function(origin, callback) {
    // Permitir herramientas locales sin origin (e.g., curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, true); // mantener abierto durante desarrollo
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 4000;
const FIRMS_KEY = process.env.FIRMS_MAP_KEY;
const POWER_BASE_URL = 'https://power.larc.nasa.gov/api/temporal';
const fs = require('fs');

// Cache con diferentes TTL según tipo de dato
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
const statsCache = new NodeCache({ stdTTL: 600 }); // 10 min para stats

// Configuración expandida
const CONFIG = {
  SOURCES: {
    'VIIRS_SNPP_NRT': 'VIIRS S-NPP',
    'VIIRS_NOAA20_NRT': 'VIIRS NOAA-20',
    'MODIS_NRT': 'MODIS Terra & Aqua',
    'VIIRS_NOAA21_NRT': 'VIIRS NOAA-21'
  },
  BBOX: {
    bolivia: '-69.6,-22.9,-57.5,-9.7',
    santaCruz: '-64.0,-20.0,-58.0,-15.0',
    laPaz: '-69.0,-17.0,-66.0,-14.0',
    beni: '-67.0,-16.0,-63.0,-10.0',
    pando: '-69.5,-13.0,-65.0,-9.0',
    tarija: '-65.0,-23.0,-62.0,-20.5',
    cochabamba: '-67.0,-18.5,-64.0,-16.0',
    oruro: '-68.5,-19.5,-66.0,-17.0',
    potosi: '-68.0,-22.0,-65.0,-19.0',
    custom: null
  },
  CONFIDENCE_LEVELS: {
    'nominal': { min: 0, max: 30, label: 'Nominal', color: '#84cc16' },
    'low': { min: 30, max: 50, label: 'Baja', color: '#fbbf24' },
    'medium': { min: 50, max: 70, label: 'Media', color: '#f59e0b' },
    'high': { min: 70, max: 85, label: 'Alta', color: '#dc2626' },
    'very_high': { min: 85, max: 100, label: 'Muy Alta', color: '#7f1d1d' }
  },
  MAX_DAYS: 10,
  RATE_LIMIT: 100 // requests por hora
};

// Contador de requests para rate limiting básico
const requestCounts = new Map();

// Middleware de logging mejorado
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Middleware de rate limiting simple
function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hora
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }
  
  const requests = requestCounts.get(ip).filter(time => now - time < windowMs);
  
  if (requests.length >= CONFIG.RATE_LIMIT) {
    return res.status(429).json({
      error: 'Demasiadas solicitudes',
      mensaje: 'Por favor espera un momento antes de volver a intentar'
    });
  }
  
  requests.push(now);
  requestCounts.set(ip, requests);
  next();
}

// Parser CSV mejorado con validación
function parseCsv(text) {
  try {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      console.warn('CSV vacío o sin datos');
      return [];
    }
    
    const headers = lines[0].split(',').map(h => 
      h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    );
    
    const requiredFields = ['latitude', 'longitude', 'acq_date', 'confidence'];
    const hasRequired = requiredFields.every(field => headers.includes(field));
    
    if (!hasRequired) {
      console.error('CSV no tiene los campos requeridos:', headers);
      return [];
    }
    
    return lines.slice(1).map((line, idx) => {
      try {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] || "";
        });
        
        // Validar datos críticos
        if (!obj.latitude || !obj.longitude || isNaN(parseFloat(obj.latitude)) || isNaN(parseFloat(obj.longitude))) {
          return null;
        }
        
        return obj;
      } catch (e) {
        console.error(`Error en línea ${idx + 2}:`, e.message);
        return null;
      }
    }).filter(row => row !== null);
  } catch (e) {
    console.error('Error crítico parseando CSV:', e);
    return [];
  }
}

// Conversión UTC a Bolivia Time
function parseUTCtoBoliviaTime(dateStr, timeStr) {
  try {
    if (!dateStr || !timeStr) {
      console.warn('Fecha u hora faltante');
      return new Date();
    }
    
    const [year, month, day] = dateStr.split('-').map(Number);
    const hour = parseInt(timeStr.slice(0, 2)) || 0;
    const minute = parseInt(timeStr.slice(2, 4)) || 0;
    
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const boliviaDate = new Date(utcDate.getTime() - 4 * 60 * 60 * 1000);
    
    if (isNaN(boliviaDate.getTime())) {
      console.warn('Fecha inválida generada');
      return new Date();
    }
    
    return boliviaDate;
  } catch (e) {
    console.error('Error parseando fecha:', e);
    return new Date();
  }
}

// Calcular nivel de riesgo
function calcularNivelRiesgo(confianza, bright_ti4, bright_ti5, frp) {
  let riesgo = confianza;
  
  if (bright_ti4 > 330) riesgo += 10;
  if (bright_ti5 > 320) riesgo += 5;
  if (frp > 50) riesgo += 15;
  if (frp > 100) riesgo += 10;
  
  return Math.min(100, Math.max(0, riesgo));
}

// Categorizar incendio
function categorizarIncendio(row) {
  const frp = parseFloat(row.frp) || 0;
  const scan = parseFloat(row.scan) || 0;
  const track = parseFloat(row.track) || 0;
  
  let categoria = 'Foco de calor';
  let severidad = 'baja';
  
  if (frp > 100) {
    categoria = 'Incendio activo grande';
    severidad = 'muy_alta';
  } else if (frp > 50) {
    categoria = 'Incendio activo moderado';
    severidad = 'alta';
  } else if (frp > 10) {
    categoria = 'Incendio activo pequeño';
    severidad = 'media';
  }
  
  const pixelArea = scan * track;
  if (pixelArea > 2) {
    categoria += ' (área extensa)';
  }
  
  return { categoria, severidad };
}

// Mapear fila FIRMS
function mapFirmsRow(r) {
  const confianza = parseInt(r.confidence) || 0;
  const boliviaTime = parseUTCtoBoliviaTime(r.acq_date, r.acq_time);
  
  const bright_ti4 = parseFloat(r.bright_ti4) || 0;
  const bright_ti5 = parseFloat(r.bright_ti5) || 0;
  const frp = parseFloat(r.frp) || 0;
  const scan = parseFloat(r.scan) || 0;
  const track = parseFloat(r.track) || 0;
  
  const nivelRiesgo = calcularNivelRiesgo(confianza, bright_ti4, bright_ti5, frp);
  const { categoria, severidad } = categorizarIncendio(r);
  
  let nivelConfianza = 'nominal';
  for (const [key, value] of Object.entries(CONFIG.CONFIDENCE_LEVELS)) {
    if (confianza >= value.min && confianza < value.max) {
      nivelConfianza = key;
      break;
    }
  }
  
  return {
    lat: parseFloat(r.latitude),
    lng: parseFloat(r.longitude),
    fechaUTC: r.acq_date,
    horaUTC: `${r.acq_time.slice(0,2)}:${r.acq_time.slice(2,4) || '00'}`,
    fechaLocal: boliviaTime.toLocaleDateString('es-BO'),
    horaLocal: boliviaTime.toLocaleTimeString('es-BO', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    }),
    timestamp: boliviaTime.getTime(),
    confianza,
    nivelConfianza,
    nivelRiesgo,
    categoria,
    severidad,
    descripcion: `${categoria} - ${r.instrument || 'FIRMS'}`,
    satellite: r.satellite || 'Desconocido',
    instrument: r.instrument || 'Desconocido',
    bright_ti4,
    bright_ti5,
    frp,
    scan,
    track,
    daynight: r.daynight || 'D',
    version: r.version || '',
    pixelArea: (scan * track).toFixed(2),
    temperaturaEstimada: bright_ti4 ? `${(bright_ti4 - 273.15).toFixed(1)}°C` : 'N/A'
  };
}

// Estadísticas mejoradas
function obtenerEstadisticas(data) {
  if (!data.length) {
    return {
      total: 0,
      mensaje: 'No hay datos disponibles'
    };
  }
  
  const stats = {
    total: data.length,
    porConfianza: {},
    porSatelite: {},
    porHora: {},
    porDia: {},
    porSeveridad: { baja: 0, media: 0, alta: 0, muy_alta: 0 },
    promedioConfianza: 0,
    promedioFRP: 0,
    maxFRP: 0,
    areaTotalAfectada: 0,
    focosMasRecientes: [],
    focosMaximaConfianza: [],
    tendencia: null
  };
  
  for (let i = 0; i < 24; i++) {
    stats.porHora[i] = 0;
  }
  
  Object.keys(CONFIG.CONFIDENCE_LEVELS).forEach(level => {
    stats.porConfianza[level] = 0;
  });
  
  let sumaConfianza = 0;
  let sumaFRP = 0;
  let sumaArea = 0;
  let maxFRP = 0;
  
  data.forEach(item => {
    stats.porConfianza[item.nivelConfianza]++;
    stats.porSatelite[item.satellite] = (stats.porSatelite[item.satellite] || 0) + 1;
    
    const hora = new Date(item.timestamp).getHours();
    stats.porHora[hora]++;
    
    const dia = item.fechaLocal;
    stats.porDia[dia] = (stats.porDia[dia] || 0) + 1;
    
    if (item.severidad) {
      stats.porSeveridad[item.severidad]++;
    }
    
    sumaConfianza += item.confianza;
    sumaFRP += item.frp || 0;
    sumaArea += parseFloat(item.pixelArea) || 0;
    maxFRP = Math.max(maxFRP, item.frp || 0);
  });
  
  stats.promedioConfianza = (sumaConfianza / data.length).toFixed(1);
  stats.promedioFRP = (sumaFRP / data.length).toFixed(1);
  stats.maxFRP = maxFRP.toFixed(1);
  stats.areaTotalAfectada = sumaArea.toFixed(2);
  
  // Calcular tendencia (últimas 24h vs anteriores)
  const ahora = Date.now();
  const ultimas24h = data.filter(d => (ahora - d.timestamp) < 24 * 60 * 60 * 1000).length;
  const anteriores24h = data.filter(d => {
    const diff = ahora - d.timestamp;
    return diff >= 24 * 60 * 60 * 1000 && diff < 48 * 60 * 60 * 1000;
  }).length;
  
  if (anteriores24h > 0) {
    const cambio = ((ultimas24h - anteriores24h) / anteriores24h * 100).toFixed(1);
    stats.tendencia = {
      ultimas24h,
      anteriores24h,
      cambioPorc: cambio,
      direccion: cambio > 0 ? 'aumentando' : cambio < 0 ? 'disminuyendo' : 'estable'
    };
  }
  
  stats.focosMasRecientes = data
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map(f => ({
      lat: f.lat,
      lng: f.lng,
      tiempo: `${f.fechaLocal} ${f.horaLocal}`,
      confianza: f.confianza,
      categoria: f.categoria,
      frp: f.frp
    }));
  
  stats.focosMaximaConfianza = data
    .sort((a, b) => b.confianza - a.confianza)
    .slice(0, 10)
    .map(f => ({
      lat: f.lat,
      lng: f.lng,
      confianza: f.confianza,
      categoria: f.categoria,
      frp: f.frp
    }));
  
  return stats;
}

// ============= RUTAS =============

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get("/api", (req, res) => {
  res.json({
    status: 'online',
    message: 'Servidor de monitoreo de incendios FIRMS',
    version: '2.1.0',
    uptime: process.uptime(),
    memoria: {
      usada: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    },
    cache: {
      keys: cache.keys().length,
      stats: cache.getStats()
    },
    endpoints: {
      incendios: '/api/eventos?tipo=incendios&days=3&source=VIIRS_SNPP_NRT&region=bolivia',
      estadisticas: '/api/estadisticas?days=7&region=bolivia',
      fuentes: '/api/fuentes',
      regiones: '/api/regiones',
      validar: '/api/validar',
      health: '/api/health'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKey: FIRMS_KEY ? 'configurada' : 'faltante',
    cache: cache.getStats(),
    uptime: Math.floor(process.uptime())
  };
  res.json(health);
});

// Endpoint principal con rate limiting
app.get('/api/eventos', rateLimiter, async (req, res) => {
  const { tipo, source, days, bbox, region } = req.query;
  
  if (tipo !== 'incendios') {
    return res.status(400).json({ 
      error: 'Tipo no soportado',
      tiposValidos: ['incendios']
    });
  }
  
  if (!FIRMS_KEY) {
    return res.status(500).json({
      error: 'API Key no configurada',
      mensaje: 'Configura FIRMS_MAP_KEY en el archivo .env'
    });
  }
  
  const SOURCE = source || 'VIIRS_SNPP_NRT';
  const DAYS = Math.min(parseInt(days) || 1, CONFIG.MAX_DAYS);
  const BBOX = region && CONFIG.BBOX[region] ? CONFIG.BBOX[region] : (bbox || CONFIG.BBOX.bolivia);
  
  const cacheKey = `${SOURCE}-${DAYS}-${BBOX}`;
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    console.log(`📦 Cache hit: ${cacheKey}`);
    return res.json(cachedData);
  }
  
  const urls = [];
  if (source === 'ALL') {
    Object.keys(CONFIG.SOURCES).forEach(src => {
      urls.push({
        source: src,
        url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/${src}/${BBOX}/${DAYS}`
      });
    });
  } else {
    urls.push({
      source: SOURCE,
      url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/${SOURCE}/${BBOX}/${DAYS}`
    });
  }
  
  try {
    const allData = [];
    const errors = [];
    
    for (const { source, url } of urls) {
      console.log(`🔍 Consultando ${source}...`);
      
      try {
        const response = await fetch(url, { timeout: 10000 });
        const text = await response.text();
        
        if (text.trim() === 'Invalid MAP_KEY.') {
          errors.push({ source, error: 'API Key inválida' });
          continue;
        }
        
        if (!text.includes('latitude')) {
          console.log(`⚠️ Sin datos: ${source}`);
          continue;
        }
        
        const rows = parseCsv(text);
        const data = rows.map(row => ({
          ...mapFirmsRow(row),
          source: CONFIG.SOURCES[source] || source
        }));
        
        allData.push(...data);
        console.log(`✅ ${source}: ${data.length} focos`);
        
      } catch (err) {
        console.error(`❌ Error con ${source}:`, err.message);
        errors.push({ source, error: err.message });
      }
    }
    
    if (allData.length === 0) {
      return res.json({
        datos: [],
        mensaje: 'No se encontraron incendios activos en el área y período seleccionados',
        errores: errors.length > 0 ? errors : undefined
      });
    }
    
    const uniqueData = [];
    const seen = new Set();
    
    allData.forEach(item => {
      const key = `${item.lat.toFixed(4)}-${item.lng.toFixed(4)}-${item.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueData.push(item);
      }
    });
    
    uniqueData.sort((a, b) => b.timestamp - a.timestamp);
    
    cache.set(cacheKey, uniqueData);
    
    console.log(`🔥 Total únicos: ${uniqueData.length}`);
    res.json(uniqueData);
    
  } catch (err) {
    console.error('❌ Error general:', err);
    res.status(500).json({ 
      error: 'Error obteniendo incendios', 
      detalle: err.message 
    });
  }
});

// Estadísticas con cache
app.get('/api/estadisticas', async (req, res) => {
  const { source, days, bbox, region } = req.query;
  
  const cacheKey = `stats-${source || 'default'}-${days || 1}-${region || bbox || 'bolivia'}`;
  const cached = statsCache.get(cacheKey);
  
  if (cached) {
    console.log(`📊 Stats desde cache: ${cacheKey}`);
    return res.json(cached);
  }
  
  try {
    const params = new URLSearchParams({
      tipo: 'incendios',
      source: source || 'VIIRS_SNPP_NRT',
      days: days || '1',
      region: region || '',
      bbox: bbox || ''
    });
    
    const response = await fetch(`http://localhost:${PORT}/api/eventos?${params}`);
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return res.status(500).json({ error: 'Error obteniendo datos' });
    }
    
    const stats = obtenerEstadisticas(data);
    statsCache.set(cacheKey, stats);
    
    res.json(stats);
    
  } catch (err) {
    console.error('Error calculando estadísticas:', err);
    res.status(500).json({ 
      error: 'Error calculando estadísticas', 
      detalle: err.message 
    });
  }
});

// Alias /api/incendios que redirige conservando query params
app.get('/api/incendios', (req, res) => {
  const params = new URLSearchParams(req.query);
  params.set('tipo', 'incendios');
  return res.redirect(307, `/api/eventos?${params.toString()}`);
});

// Endpoint simple para ver si el backend responde sin tocar NASA
app.get('/incendios', (req, res) => {
  res.json({ ok: true, mensaje: 'Backend activo', ejemplo: '/api/incendios?days=3&source=VIIRS_SNPP_NRT&region=bolivia' });
});

app.get('/api/fuentes', (req, res) => {
  res.json({
    fuentes: CONFIG.SOURCES,
    nivelesConfianza: CONFIG.CONFIDENCE_LEVELS,
    descripcion: {
      'VIIRS_SNPP_NRT': 'Satélite Suomi NPP con sensor VIIRS. Resolución: 375m. Actualización: cada 3 horas.',
      'VIIRS_NOAA20_NRT': 'Satélite NOAA-20 con sensor VIIRS. Resolución: 375m. Cobertura global diaria.',
      'MODIS_NRT': 'Satélites Terra y Aqua con sensor MODIS. Resolución: 1km. Histórico desde 2000.',
      'VIIRS_NOAA21_NRT': 'Satélite NOAA-21 (más reciente). Resolución: 375m. Mayor frecuencia de paso.'
    }
  });
});

app.get('/api/regiones', (req, res) => {
  res.json({
    regiones: Object.keys(CONFIG.BBOX).filter(k => k !== 'custom'),
    coordenadas: CONFIG.BBOX,
    descripcion: {
      'bolivia': 'Todo el territorio boliviano',
      'santaCruz': 'Departamento de Santa Cruz y alrededores',
      'laPaz': 'Departamento de La Paz y alrededores',
      'beni': 'Departamento del Beni y alrededores',
      'pando': 'Departamento de Pando',
      'tarija': 'Departamento de Tarija',
      'cochabamba': 'Departamento de Cochabamba',
      'oruro': 'Departamento de Oruro',
      'potosi': 'Departamento de Potosí'
    }
  });
});

app.get('/api/validar', async (req, res) => {
  if (!FIRMS_KEY) {
    return res.status(500).json({ 
      valido: false, 
      error: 'MAP_KEY no configurado en .env' 
    });
  }
  
  try {
    const testUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/VIIRS_SNPP_NRT/-69,-17,-68,-16/1`;
    const response = await fetch(testUrl, { timeout: 5000 });
    const text = await response.text();
    
    if (text.includes('Invalid MAP_KEY')) {
      return res.json({ valido: false, error: 'MAP_KEY inválido' });
    }
    
    res.json({ 
      valido: true, 
      mensaje: 'API key válida y funcionando',
      limite: 'Sin límite para uso académico/investigación'
    });
    
  } catch (err) {
    res.status(500).json({ 
      valido: false, 
      error: 'Error validando API key',
      detalle: err.message
    });
  }
});

// ================= VIENTO (NASA POWER) =================
// Normaliza datos de viento devolviendo lista {timestamp, u, v, ws, wd}
function normalizarVientoPOWER(properties) {
  if (!properties || !properties.parameter) return [];
  const { U10M = {}, V10M = {}, WS10M = {}, WD10M = {} } = properties.parameter;
  const timestamps = new Set([
    ...Object.keys(U10M || {}),
    ...Object.keys(V10M || {}),
    ...Object.keys(WS10M || {}),
    ...Object.keys(WD10M || {})
  ]);
  return Array.from(timestamps)
    .sort()
    .map(ts => ({
      timestamp: ts,
      u: Number(U10M[ts] ?? 0),
      v: Number(V10M[ts] ?? 0),
      ws: Number(WS10M[ts] ?? Math.hypot(Number(U10M[ts] ?? 0), Number(V10M[ts] ?? 0))),
      wd: Number(WD10M[ts] ?? 0)
    }));
}

// Helper: fechas YYYYMMDD por defecto últimos 3 días
function rangoFechasYYYYMMDD(dias = 3) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (Math.max(1, dias) - 1) * 24 * 60 * 60 * 1000);
  const fmt = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return { start: fmt(startDate), end: fmt(endDate) };
}

// Endpoint proxy a NASA POWER para viento a 10m
// GET /api/wind/power?lat=-17.78&lon=-63.18&start=20250101&end=20250103&mode=hourly
app.get('/api/wind/power', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const mode = (req.query.mode || 'hourly').toLowerCase();
    const dias = parseInt(req.query.days || '3', 10);
    const { start, end } = {
      start: req.query.start,
      end: req.query.end
    }.start && req.query.end ? { start: req.query.start, end: req.query.end } : rangoFechasYYYYMMDD(dias);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ error: 'Parámetros inválidos: lat/lon requeridos' });
    }

    const params = ['WS10M', 'WD10M', 'U10M', 'V10M'].join(',');
    const url = `${POWER_BASE_URL}/${mode}/point?parameters=${params}&community=RE&latitude=${lat}&longitude=${lon}&start=${start}&end=${end}&format=JSON`;

    const response = await fetch(url, { timeout: 15000 });
    if (!response.ok) {
      return res.status(response.status).json({ error: `POWER HTTP ${response.status}` });
    }
    const json = await response.json();
    const series = normalizarVientoPOWER(json.properties);

    return res.json({
      meta: {
        source: 'NASA POWER',
        mode,
        lat,
        lon,
        start,
        end,
        count: series.length
      },
      series
    });
  } catch (err) {
    console.error('Error /api/wind/power:', err);
    return res.status(500).json({ error: 'Error obteniendo viento POWER', detalle: err.message });
  }
});

// ================= VIENTO (MERRA-2 local) =================
function nearestIndex(value, arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(Number(arr[i]) - value);
    if (d < bestDiff) { bestDiff = d; bestIdx = i; }
  }
  return bestIdx;
}

app.get('/api/wind/merra2', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const fileParam = req.query.file;
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ error: 'Parámetros inválidos: lat/lon requeridos' });
    }

    // Ruta por defecto al archivo de ejemplo incluido
    const defaultFile = path.join(__dirname, 'src/data/merra2/MERRA2_400.tavg1_2d_slv_Nx.20240101.nc4');
    const filePath = fileParam ? path.resolve(fileParam) : defaultFile;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo MERRA-2 no encontrado', filePath });
    }

    // Carga CJS/UMD de netcdfjs
    const { NetCDFReader } = require('netcdfjs');

    const data = fs.readFileSync(filePath);
    const reader = new NetCDFReader(data);

    const uVar = reader.variables.find(v => v.name === 'U10M');
    const vVar = reader.variables.find(v => v.name === 'V10M');
    const latVar = reader.variables.find(v => v.name === 'lat');
    const lonVar = reader.variables.find(v => v.name === 'lon');
    const timeVar = reader.variables.find(v => v.name === 'time');

    if (!uVar || !vVar || !latVar || !lonVar || !timeVar) {
      return res.status(500).json({ error: 'Variables requeridas no presentes en NetCDF' });
    }

    const lats = reader.getDataVariable('lat');
    const lons = reader.getDataVariable('lon');
    const times = reader.getDataVariable('time');
    const uData = reader.getDataVariable('U10M');
    const vData = reader.getDataVariable('V10M');

    const ny = latVar.dimensions[0].size;
    const nx = lonVar.dimensions[0].size;
    const nt = timeVar.dimensions[0].size;

    const j = nearestIndex(lat, Array.from(lats));
    const i = nearestIndex(lon, Array.from(lons));

    // Suponiendo orden [time, lat, lon]
    const strideTL = ny * nx;
    const strideL = nx;

    const series = [];
    for (let t = 0; t < nt; t++) {
      const idx = t * strideTL + j * strideL + i;
      const uu = Number(uData[idx]);
      const vv = Number(vData[idx]);
      const speed = Math.hypot(uu, vv);
      let dir = Math.atan2(-uu, -vv) * 180 / Math.PI; // meteo
      if (dir < 0) dir += 360;
      series.push({ tIndex: t, u: uu, v: vv, ws: speed, wd: dir });
    }

    return res.json({
      meta: {
        source: 'MERRA-2 local',
        file: path.basename(filePath),
        grid: { nx, ny, nt },
        nearest: { lat: Number(lats[j]), lon: Number(lons[i]), j, i },
        timeUnits: timeVar.attributes.find(a => a.name === 'units')?.value || ''
      },
      series
    });
  } catch (err) {
    console.error('Error /api/wind/merra2:', err);
    return res.status(500).json({ error: 'Error leyendo MERRA-2', detalle: err.message });
  }
});

// Limpiar cache manualmente
app.post('/api/cache/clear', (req, res) => {
  const keysDeleted = cache.keys().length;
  cache.flushAll();
  statsCache.flushAll();
  
  res.json({
    mensaje: 'Cache limpiado',
    keysEliminadas: keysDeleted
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    disponibles: ['/api', '/api/eventos', '/api/estadisticas', '/api/fuentes', '/api/regiones']
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    mensaje: process.env.NODE_ENV === 'development' ? err.message : 'Ocurrió un error inesperado',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
    🔥 Servidor de Monitoreo de Incendios FIRMS
    ============================================
    🚀 Servidor: http://localhost:${PORT}
    🌐 Frontend: http://localhost:${PORT}
    📊 API Info: http://localhost:${PORT}/api
    🔑 API Key: ${FIRMS_KEY ? 'Configurada ✅' : 'No configurada ❌'}
    💾 Cache: Activo (TTL: 5min datos, 10min stats)
    🛡️ Rate Limit: ${CONFIG.RATE_LIMIT} req/hora
    📅 Servidor: ${new Date().toLocaleString('es-BO')}
    ============================================
  `);
  
  if (!FIRMS_KEY) {
    console.warn('⚠️  ADVERTENCIA: FIRMS_MAP_KEY no configurada');
    console.warn('    Obtén tu key en: https://firms.modaps.eosdis.nasa.gov/api/area/');
  }
}); 