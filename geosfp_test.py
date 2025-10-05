# geosfp_test.py
# Acceso a GEOS-FP forecast vía OPeNDAP (GDS) con fallback entre netCDF4 y pydap

import xarray as xr

# URL estable del alias "latest" para el dataset inst1_2d_hwl_Nx
BASE_URL = "https://opendap.nccs.nasa.gov/dods/GEOS-5/fp/0.25_deg/fcast/inst1_2d_hwl_Nx.latest"

def open_geosfp():
    # Intento 1: netCDF4 (suele ser más robusto con GDS)
    try:
        ds = xr.open_dataset(BASE_URL, engine="netcdf4", decode_times=False)
        print("Usando engine=netcdf4")
        return ds
    except Exception as e1:
        print(f"Falló netCDF4: {e1}")

    # Intento 2: pydap forzando DAP2
    try:
        ds = xr.open_dataset("dap2://" + BASE_URL.replace("https://", ""), engine="pydap", decode_times=False)
        print("Usando engine=pydap (DAP2)")
        return ds
    except Exception as e2:
        print(f"Falló pydap: {e2}")
        raise RuntimeError("No se pudo abrir el dataset GEOS-FP con ninguno de los motores.")

def main():
    ds = open_geosfp()

    print("\n=== Información del dataset ===")
    print(ds)

    print("\n=== Dimensiones ===")
    print(ds.dims)

    print("\n=== Variables disponibles ===")
    print(list(ds.data_vars))

    # Selección de viento a 10 m si existe en este producto
    has_u10 = "U10M" in ds.data_vars
    has_v10 = "V10M" in ds.data_vars

    if has_u10 and has_v10:
        u10 = ds["U10M"]
        v10 = ds["V10M"]

        # Recorte espacial sobre Bolivia
        u10_bo = u10.sel(lat=slice(-23, -9), lon=slice(-70, -57))
        v10_bo = v10.sel(lat=slice(-23, -9), lon=slice(-70, -57))

        print("\n=== U10M Bolivia shape ===", u10_bo.shape)
        print("=== V10M Bolivia shape ===", v10_bo.shape)

        # Si hay dimensión temporal, muestra primer timestep
        if "time" in u10_bo.dims:
            print("\n=== U10M Bolivia (primer timestep) ===")
            print(u10_bo.isel(time=0))
        else:
            print("\nEste dataset no tiene dimensión 'time' explícita o es un solo timestep.")
    else:
        print("\n⚠️ Este producto no contiene U10M/V10M.")
        print("Variables disponibles:", list(ds.data_vars))

if __name__ == "__main__":
    main() 
    