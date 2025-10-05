import xarray as xr

# URL de un gránulo real de MERRA-2 (ejemplo: 15 julio 2020)
url = "https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/MERRA2/M2T1NXSLV.5.12.4/2020/07/MERRA2_400.tavg1_2d_slv_Nx.20200715.nc4"

# Abrir con pydap y autenticación vía .netrc
ds = xr.open_dataset(url, engine="pydap", decode_times=False)

print("\n=== Variables disponibles ===")
print(list(ds.data_vars))

# Seleccionar variables de viento a 10m
u10 = ds["U10M"]
v10 = ds["V10M"]

# Recorte espacial sobre Bolivia
u10_bolivia = u10.sel(lat=slice(-23, -9), lon=slice(-70, -57))
v10_bolivia = v10.sel(lat=slice(-23, -9), lon=slice(-70, -57))

print("\n=== U10M Bolivia shape ===", u10_bolivia.shape)
print("=== V10M Bolivia shape ===", v10_bolivia.shape)

# Ejemplo: primer timestep
print("\n=== U10M Bolivia (primer timestep) ===")
print(u10_bolivia.isel(time=0))

