// layers/windLayer.js
import { fetchWindData } from "../api/windAPI.js";

export async function createWindLayer({ lat, lon, start, end, mode }) {
  const data = await fetchWindData(lat, lon, start, end, mode);
  if (!data) return null;

  // Extraemos velocidad y dirección
  const ws = data.WS10M; // Velocidad
  const wd = data.WD10M; // Dirección
  const u  = data.U10M;  // Componente zonal
  const v  = data.V10M;  // Componente meridional

  // Por ahora devolvemos un objeto simple
  return { ws, wd, u, v };
}
