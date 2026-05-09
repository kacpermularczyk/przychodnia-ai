# backend/ai/rf_trainer.py
import os
import joblib
import numpy as np
import pandas as pd

from django.conf import settings
from django.db import transaction
from django.db.models import Q

from sklearn.ensemble import RandomForestClassifier
from sklearn.utils.class_weight import compute_class_weight

from main_app.models import DiagnosisModel


MODEL_PATH = os.path.join(settings.BASE_DIR, "ai", "ai_models", "final_model_rf.pkl")
FEATURES_PATH = os.path.join(settings.BASE_DIR, "ai", "db", "features.pkl")
LE_PATH = os.path.join(settings.BASE_DIR, "ai", "label_encoder.pkl")


@transaction.atomic
def retrain_rf_from_db(n_estimators=200, random_state=42):
    """
    Trenuje NOWY RandomForest na danych z bazy.

    y =
      - predicted_diagnosis        jeśli is_correct = True
      - doctor_diagnosis           jeśli is_correct = False i doctor_diagnosis ∈ label_encoder

    NADPISUJE TYLKO model RF
    NIE rusza features.pkl ani label_encoder.pkl
    """

    if not (os.path.exists(FEATURES_PATH) and os.path.exists(LE_PATH)):
        return {"ok": False, "detail": "Brak features.pkl lub label_encoder.pkl"}

    FEATURES_MODEL = joblib.load(FEATURES_PATH)      # np. ["bol przy nagryzaniu", ...]
    label_encoder = joblib.load(LE_PATH)
    VALID_LABELS = set(label_encoder.classes_)

    # Mapowanie: MODEL (spacje) <-> DB (underscore)
    FEATURES_DB = [f.replace(" ", "_") for f in FEATURES_MODEL]
    FEATURE_MAP_DB_TO_MODEL = dict(zip(FEATURES_DB, FEATURES_MODEL))

    # sprawdź czy pola istnieją w modelu Django
    model_fields = {f.name for f in DiagnosisModel._meta.get_fields()}
    missing = [c for c in FEATURES_DB if c not in model_fields]
    if missing:
        return {"ok": False, "detail": f"Brakujące pola w DiagnosisModel: {missing}"}

    # bierzemy:
    # - poprawne predykcje
    # - błędne, ale z doctor_diagnosis
    qs = DiagnosisModel.objects.filter(
        Q(is_correct=True) |
        Q(is_correct=False, doctor_diagnosis__isnull=False)
    )

    rows = list(qs.values(
        *FEATURES_DB,
        "predicted_diagnosis",
        "doctor_diagnosis",
        "is_correct",
    ))

    if not rows:
        return {"ok": False, "detail": "Brak danych do treningu"}

    df = pd.DataFrame(rows)

    # bool -> int
    for c in FEATURES_DB:
        df[c] = df[c].astype(int)

    # zamiana nazw kolumn na wersję modelową (spacje)
    df.rename(columns=FEATURE_MAP_DB_TO_MODEL, inplace=True)

    # wybór etykiety końcowej
    def choose_label(row):
        if row["is_correct"]:
            return row["predicted_diagnosis"]
        doc = row.get("doctor_diagnosis")
        if isinstance(doc, str) and doc in VALID_LABELS:
            return doc
        return None

    df["y_final"] = df.apply(choose_label, axis=1)
    df = df[df["y_final"].notna()]

    if df.empty:
        return {"ok": False, "detail": "Brak rekordów z etykietami zgodnymi z LabelEncoder"}

    X = df[FEATURES_MODEL]
    y = df["y_final"].astype(str)

    try:
        y_enc = label_encoder.transform(y)
    except ValueError as e:
        return {"ok": False, "detail": f"Błąd LabelEncoder: {str(e)}"}

    classes = np.unique(y_enc)
    weights = compute_class_weight(
        class_weight="balanced",
        classes=classes,
        y=y_enc
    )
    class_weight_dict = dict(zip(classes, weights))

    model = RandomForestClassifier(
        n_estimators=n_estimators,
        random_state=random_state,
        class_weight=class_weight_dict,
    )
    model.fit(X, y_enc)

    # bezpieczny zapis modelu
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    tmp_path = MODEL_PATH + ".tmp"
    joblib.dump(model, tmp_path)
    os.replace(tmp_path, MODEL_PATH)

    # oznacz nowe rekordy jako skonsumowane
    updated = (
        DiagnosisModel.objects
        .filter(is_new_rf=True)
        .update(is_new_rf=False)
    )

    return {
        "ok": True,
        "trained_on": int(len(df)),
        "new_rows_consumed": int(updated),
    }
