# Ten plik dodaje do bazy danych wiersze juz znane dla rf i nn. Stare = juz nauczone

#Zeby uruchomic w powershell:
# 1) cd backend
# 2) python manage.py shell 
# 3) exec(open("ai/db/insertOldData.py").read())

import pandas as pd
from main_app.models import DiagnosisModel

# wczytaj csv
df = pd.read_csv("ai/db/dane500.csv")

# normalizacja (na wszelki wypadek)
df["diagnoza"] = df["diagnoza"].astype(str).str.strip()

objects = []

for _, row in df.iterrows():
    obj = DiagnosisModel(
        bol_przy_nagryzaniu = bool(row["bol przy nagryzaniu"]),
        bol_na_zimno = bool(row["bol na zimno"]),
        obrzek_policzka = bool(row["obrzek policzka"]),
        wysoka_temperatura = bool(row["wysoka temperatura"]),
        zab_sie_rusza = bool(row["zab sie rusza"]),
        zab_zciemnial = bool(row["zab zciemnial"]),
        reakcja_na_slodkie = bool(row["reakcja na slodkie"]),
        bol_samoistny = bool(row["bol samoistny"]),
        silny_bol_podczas_picia_goracych_napojow = bool(row["silne bole samoistne ktore lagodzi zimny napoj"]),
        bol_dziasla = bool(row["bol dziasla"]),
        nadwrazliwy_zab = bool(row["nadwrazliwy zab"]),
        bol_na_slodkie = bool(row["bol na slodkie"]),
        reakcja_na_zimno = bool(row["reakcja na zimno"]),
        bol_na_cieplo = bool(row["bol na cieplo"]),
        bol_zeba_od_kilku_dni = bool(row["bol zeba od kilku dni"]),
        krwawienie_z_dziasel = bool(row["krwawienie z dziasel"]),
        silne_bole_samoistne_ktore_lagodzi_zimny_napoj = bool(row["silne bole samoistne ktore lagodzi zimny napoj"]),
        reakcja_na_cieplo = bool(row["reakcja na cieplo"]),
        brzydki_zapach_z_ust = bool(row["brzydki zapach z ust"]),
        krwawienie_z_dziasel_przy_myciu_zebow = bool(row["krwawienie z dziasel przy myciu zebow"]),
        wrazliwosc_na_zimno = bool(row["wrazliwosc na zimno"]),

        predicted_diagnosis = row["diagnoza"],
        is_correct = True,
        is_new_rf = False,
        is_new_nn = False
    )
    objects.append(obj)

# zapis hurtowy (szybki!)
DiagnosisModel.objects.bulk_create(objects)

print(f"Zapisano {len(objects)} rekordów")