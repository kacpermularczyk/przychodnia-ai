# backend/ai/nn_trainer.py
import os
import random
import joblib
import numpy as np
import pandas as pd

from django.conf import settings
from django.db import transaction
from django.db.models import Q, Case, When, CharField

import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.callbacks import EarlyStopping

from sklearn.utils.class_weight import compute_class_weight

from main_app.models import DiagnosisModel


MODEL_PATH = os.path.join(settings.BASE_DIR, "ai", "ai_models", "final_model_nn.keras")
FEATURES_PATH = os.path.join(settings.BASE_DIR, "ai", "db", "features.pkl")
LE_PATH = os.path.join(settings.BASE_DIR, "ai", "label_encoder.pkl")


def _set_seed(seed: int = 42) -> None:
    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)


def _choose_label(row: dict, valid_labels: set[str]) -> str | None:
    """
    Zgodnie z RF:
      - predicted_diagnosis jeśli is_correct=True
      - doctor_diagnosis jeśli is_correct=False i należy do valid_labels
    """
    if row.get("is_correct") is True:
        return row.get("predicted_diagnosis")
    doc = row.get("doctor_diagnosis")
    if isinstance(doc, str) and doc in valid_labels:
        return doc
    return None


@transaction.atomic
def retrain_nn_from_db(
    values: dict,
    random_state: int = 42,
    replay_ratio: float = 1.0,
    batch_size: int = 8,
    epochs: int = 100,
    patience: int = 20,
    learning_rate: float | None = None,
):
    """
    Doucza istniejący model NN (Keras).

    NEW:
      - per label bierzemy min(values[label], dostępne) rekordów z is_new_nn=True

    OLD (replay):
      - per label bierzemy round(REALNIE_WZIĘTE_NEW * replay_ratio) rekordów z is_new_nn=False

    Zasada: jeśli NIE udało się pobrać żadnych nowych rekordów (is_new_nn=True),
    to NIE trenujemy (żadnego replay-only).

    Konsumujemy (is_new_nn=False) tylko te nowe rekordy, które faktycznie weszły do treningu.
    """

    _set_seed(random_state)

    if not (os.path.exists(FEATURES_PATH) and os.path.exists(LE_PATH)):
        return {"ok": False, "detail": "Brak features.pkl lub label_encoder.pkl"}

    if not os.path.exists(MODEL_PATH):
        return {"ok": False, "detail": "Brak zapisanego modelu NN (final_model_nn.keras)"}

    if not isinstance(values, dict) or len(values) == 0:
        return {"ok": False, "detail": "Brak payloadu values={label: liczba}."}

    # wczytaj features + label encoder
    FEATURES_MODEL = joblib.load(FEATURES_PATH)
    label_encoder = joblib.load(LE_PATH)
    VALID_LABELS = set(label_encoder.classes_)

    # (opcjonalnie) czyść kolejkę z rekordów, które NIGDY nie przejdą przez LabelEncoder
    DiagnosisModel.objects.filter(is_new_nn=True).exclude(
        Q(is_correct=True, predicted_diagnosis__in=VALID_LABELS) |
        Q(is_correct=False, doctor_diagnosis__in=VALID_LABELS)
    ).update(is_new_nn=False)

    # Mapowanie: MODEL (spacje) <-> DB (underscore)
    FEATURES_DB = [f.replace(" ", "_") for f in FEATURES_MODEL]
    FEATURE_MAP_DB_TO_MODEL = dict(zip(FEATURES_DB, FEATURES_MODEL))

    # sprawdź czy pola istnieją w modelu Django
    model_fields = {f.name for f in DiagnosisModel._meta.get_fields()}
    missing = [c for c in FEATURES_DB if c not in model_fields]
    if missing:
        return {"ok": False, "detail": f"Brakujące pola w DiagnosisModel: {missing}"}

    # załaduj model
    model = load_model(MODEL_PATH)

    # sanity-check: liczba klas
    num_classes = len(label_encoder.classes_)
    try:
        out_units = int(model.output_shape[-1])
    except Exception:
        out_units = None

    if out_units is not None and out_units != num_classes:
        return {
            "ok": False,
            "detail": (
                f"Niezgodna liczba klas: model ma {out_units}, LabelEncoder ma {num_classes}. "
                "Nie da się douczyć bez przebudowy warstwy wyjściowej."
            ),
        }

    # opcjonalnie zmień learning rate
    if learning_rate is not None:
        try:
            model.optimizer.learning_rate.assign(float(learning_rate))
        except Exception:
            pass

    # przygotuj adnotację train_label (jak wcześniej)
    base_qs = (
        DiagnosisModel.objects
        .filter(
            Q(is_correct=True) |
            Q(is_correct=False, doctor_diagnosis__isnull=False)
        )
        .annotate(
            train_label=Case(
                When(is_correct=True, then="predicted_diagnosis"),
                When(is_correct=False, then="doctor_diagnosis"),
                output_field=CharField(),
            )
        )
    )

    all_rows: list[dict] = []
    consumed_new_ids: list[int] = []
    per_label_new_used: dict[str, int] = {}
    per_label_old_used: dict[str, int] = {}

    for label, n in values.items():
        if label not in VALID_LABELS:
            continue

        try:
            n_new_requested = int(n)
        except (TypeError, ValueError):
            continue

        if n_new_requested <= 0:
            # jeśli chcesz raportować zera, możesz dodać:
            # per_label_new_used[label] = 0
            # per_label_old_used[label] = 0
            continue

        # -------- NEW --------
        new_qs = (
            base_qs
            .filter(is_new_nn=True, train_label=label)
            .order_by("id")
        )[:n_new_requested]

        new_rows = list(new_qs.values(
            "id",
            *FEATURES_DB,
            "predicted_diagnosis",
            "doctor_diagnosis",
            "is_correct",
        ))

        new_used = len(new_rows)
        per_label_new_used[label] = new_used

        if new_used == 0:
            per_label_old_used[label] = 0
            continue

        all_rows.extend(new_rows)
        consumed_new_ids.extend([r["id"] for r in new_rows])

        # -------- OLD replay (LICZONY OD REALNIE POBRANYCH NOWYCH) --------
        n_old = int(round(new_used * float(replay_ratio)))
        if n_old <= 0:
            per_label_old_used[label] = 0
            continue

        old_qs = (
            base_qs
            .filter(is_new_nn=False, train_label=label)
            .order_by("-id")
        )[:n_old]

        old_rows = list(old_qs.values(
            "id",
            *FEATURES_DB,
            "predicted_diagnosis",
            "doctor_diagnosis",
            "is_correct",
        ))

        per_label_old_used[label] = len(old_rows)
        if old_rows:
            all_rows.extend(old_rows)

    # ✅ NIE trenuj, jeśli nie ma żadnych nowych danych
    if not consumed_new_ids:
        return {"ok": False, "detail": "Brak nowych danych (is_new_nn=True) do douczenia."}

    if not all_rows:
        return {"ok": False, "detail": "Brak danych do douczenia (po zastosowaniu limitów)."}

    df = pd.DataFrame(all_rows)

    # bool -> int
    for c in FEATURES_DB:
        df[c] = df[c].astype(int)

    # kolumny -> wersja modelowa (spacje)
    df.rename(columns=FEATURE_MAP_DB_TO_MODEL, inplace=True)

    # finalna etykieta (jak RF)
    df["y_final"] = df.apply(lambda r: _choose_label(r, VALID_LABELS), axis=1)
    df = df[df["y_final"].notna()]

    if df.empty:
        return {"ok": False, "detail": "Brak rekordów z etykietami zgodnymi z LabelEncoder."}

    X = df[FEATURES_MODEL].to_numpy(dtype=np.float32)
    y = df["y_final"].astype(str).to_numpy()

    try:
        y_enc = label_encoder.transform(y)
    except ValueError as e:
        return {"ok": False, "detail": f"Błąd LabelEncoder: {str(e)}"}

    # class_weight (jak w RF)
    classes = np.unique(y_enc)
    if len(classes) >= 2:
        weights = compute_class_weight(
            class_weight="balanced",
            classes=classes,
            y=y_enc
        )
        class_weight = dict(zip(classes, weights))
    else:
        class_weight = None

    early_stop = EarlyStopping(monitor="loss", patience=patience, restore_best_weights=True)

    history = model.fit(
        X,
        y_enc,
        epochs=epochs,
        batch_size=batch_size,
        callbacks=[early_stop],
        class_weight=class_weight,
        verbose=0,
        shuffle=True,
    )

    # bezpieczny zapis Keras
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    tmp_path = MODEL_PATH + ".tmp.keras"
    model.save(tmp_path)
    os.replace(tmp_path, MODEL_PATH)

    # konsumuj tylko użyte NOWE
    updated = (
        DiagnosisModel.objects
        .filter(id__in=consumed_new_ids, is_new_nn=True)
        .update(is_new_nn=False)
    )

    return {
        "ok": True,
        "trained_on": int(len(df)),
        "new_rows_consumed": int(updated),
        "per_label_new_used": per_label_new_used,
        "per_label_old_used": per_label_old_used,
        "epochs_ran": int(len(history.history.get("loss", []))),
    }
