// --- Imports arriba ---
import { createWindLayer } from "./layers/windLayer.js";
import { getDateRange } from "./utils/timeController.js";
import { readMERRA2Wind } from "./layers/windReanalysis.js";

// --- Bloque 1: NASA POWER (API JSON) ---
(async () => {
  const { start, end } = getDateRange(3); // últimos 3 días
  const wind = await createWindLayer({
    lat: -17.7833,
    lon: -63.1833,
    start,
    end,
    mode: "hourly",
  });

  console.log("Capa de viento (NASA POWER):", wind);
})();

// --- Bloque 2: MERRA-2 (archivo NetCDF local) ---
const file = "./backend/data/merra2/MERRA2_400.tavg1_2d_slv_Nx.20240101.nc4";

const { u10m, v10m, lats, lons, time } = readMERRA2Wind(file);

console.log("Latitudes:", lats.slice(0, 5));
console.log("Longitudes:", lons.slice(0, 5));
console.log("Primeras horas:", time.slice(0, 3));
console.log("Primeros valores U10M:", u10m.slice(0, 5));
console.log("Primeros valores V10M:", v10m.slice(0, 5));
