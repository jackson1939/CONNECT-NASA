# test_pydap.py
# Prueba limpia de acceso OPeNDAP con pydap + xarray

import xarray as xr

# URL del dataset de prueba
url = "http://test.opendap.org/dap/data/nc/coads_climatology.nc"

# Abrir el dataset con pydap, desactivando decode_times para evitar errores de fechas
ds = xr.open_dataset(url, engine="pydap", decode_times=False)

# Mostrar información general
print("\n=== Información del dataset ===")
print(ds)

# Listar variables disponibles
print("\n=== Variables disponibles ===")
print(list(ds.data_vars))

# Ejemplo de subsetting flexible
sst = ds["SST"]

# Primer mes (índice 0)
sst_january = sst.isel(TIME=0)

# Recorte espacial (lon 0–50, lat 0–30)
sst_subset = sst.isel(COADSX=slice(0, 50), COADSY=slice(0, 30))

print("\n=== Subset shape ===")
print(sst_subset.shape)
