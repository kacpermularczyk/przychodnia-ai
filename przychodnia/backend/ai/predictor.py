import os
import joblib
import pandas as pd

from main_app.models import SystemSettings
from tensorflow.keras.models import load_model


BASE_DIR = os.path.dirname(__file__)

RF_MODEL_PATH = os.path.join(BASE_DIR, "ai_models/final_model_rf.pkl")
NN_MODEL_PATH = os.path.join(BASE_DIR, "ai_models/final_model_nn.keras")

encoder_path = os.path.join(BASE_DIR, "label_encoder.pkl")
features_path = os.path.join(BASE_DIR, "db/features.pkl")

# Wspólne artefakty
label_encoder = joblib.load(encoder_path)
features = joblib.load(features_path)

# Prosty cache (żeby nie ładować z dysku przy każdej predykcji)
_MODEL_CACHE = {"algo": None, "model": None}


def get_model():
    """Wybiera i ładuje model na podstawie ustawień systemu (z cache)."""
    algo = SystemSettings.get().diagnosis_algorithm

    if _MODEL_CACHE["algo"] == algo and _MODEL_CACHE["model"] is not None:
        return _MODEL_CACHE["model"]

    if algo == SystemSettings.NN:
        model = load_model(NN_MODEL_PATH)
    else:
        model = joblib.load(RF_MODEL_PATH)

    _MODEL_CACHE["algo"] = algo
    _MODEL_CACHE["model"] = model
    return model


def predict_diagnosis(input_vector):
    """
    Przyjmuje słownik cech (0/1 lub True/False) i zwraca przewidywaną diagnozę (string).
    """
    # 1) bool -> int
    input_vector = {k: int(v) if isinstance(v, bool) else v for k, v in input_vector.items()}

    # 2) "_" -> " " żeby dopasować do nazw cech
    input_vector = {k.replace("_", " "): v for k, v in input_vector.items()}

    # 3) ułóż wektor w tej samej kolejności co features
    if isinstance(input_vector, dict):
        input_data = [input_vector.get(f, 0) for f in features]
    else:
        input_data = input_vector

    # (opcjonalnie) debug kolejności
    print("\nKOLEJNOŚĆ WEKTORA WEJŚCIOWEGO:")
    for i, (f, v) in enumerate(zip(features, input_data), start=1):
        print(f"{i:02d}. {f:<50} -> {v}")
    print("-" * 70)

    df = pd.DataFrame([input_data], columns=features)

    algo = SystemSettings.get().diagnosis_algorithm
    model = get_model()

    # 4) predykcja zależnie od modelu
    if algo == SystemSettings.NN:
        probs = model.predict(df, verbose=0)  # shape: (1, num_classes)
        predicted_class = probs.argmax(axis=1)  # np.array([class_id])
    else:
        predicted_class = model.predict(df)     # np.array([class_id])

    diagnosis = label_encoder.inverse_transform(predicted_class)[0]
    return diagnosis
