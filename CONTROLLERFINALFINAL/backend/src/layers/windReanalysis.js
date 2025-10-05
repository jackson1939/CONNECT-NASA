import fs from "fs";
import { NetCDFReader } from "netcdfjs";

export function readMERRA2Wind(filePath) {
  // Leer archivo binario
  const data = fs.readFileSync(filePath);
  const reader = new NetCDFReader(data);

  // Variables de viento a 10m
  const u10m = reader.getDataVariable("U10M"); // componente zonal
  const v10m = reader.getDataVariable("V10M"); // componente meridional
  const lats = reader.getDataVariable("lat");
  const lons = reader.getDataVariable("lon");
  const time = reader.getDataVariable("time"); // horas del día

  return { u10m, v10m, lats, lons, time };
}
