// src/api/merraAPI.js
export async function fetchMERRA2Daily(date = "20251001") {
  const base = "https://goldsmr4.gesdisc.eosdis.nasa.gov/data/MERRA2/M2T1NXSLV.5.12.4";
  const year = date.slice(0, 4);
  const month = date.slice(4, 6);
  const file = `MERRA2_400.tavg1_2d_slv_Nx.${date}.nc4`;
  const url = `${base}/${year}/${month}/${file}`;

  const user = process.env.EARTHDATA_USER;
  const pass = process.env.EARTHDATA_PASS;
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`MERRA-2 fetch error ${res.status}: ${res.statusText}`);
  const buffer = await res.arrayBuffer();
  return buffer; // NetCDF binario
}
