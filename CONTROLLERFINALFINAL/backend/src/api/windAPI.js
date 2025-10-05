// api/windAPI.js
export async function fetchWindData(lat, lon, start, end, mode = "hourly") {
  const baseUrl = "https://power.larc.nasa.gov/api/temporal";
  const params = ["WS10M", "WD10M", "U10M", "V10M"].join(",");

  const url = `${baseUrl}/${mode}/point?parameters=${params}&community=RE&latitude=${lat}&longitude=${lon}&start=${start}&end=${end}&format=JSON`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.properties.parameter; // Devuelve WS10M, WD10M, U10M, V10M
  } catch (err) {
    console.error("Error al obtener datos de viento:", err);
    return null;
  }
}
