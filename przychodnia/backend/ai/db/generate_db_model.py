# INSTRUKCJA
# cd backend
# python ai/db/generate_db_model.py
# wkleic do models.py
# polaczyc diagnosisModel z visist id diagnosis jako fk w visit

import joblib
import os

# Ścieżka do pliku features.pkl
features_path = os.path.join(os.path.dirname(__file__), "features.pkl")

# Wczytanie cech
features = joblib.load(features_path)

# Nazwa modelu
model_name = "DiagnosisModel"

# Ścieżka do pliku wyjściowego (txt)
output_file = os.path.join(os.path.dirname(__file__), "generated_model.txt")

# Tworzymy kod modelu
model_code = f"""
from django.db import models

class {model_name}(models.Model):
"""

# Dodajemy pola 1/0 dla każdej cechy
for feature in features:
    field_name = feature.strip().replace(" ", "_").replace("-", "_")
    model_code += f"    {field_name} = models.BooleanField(default=0)\n"

# Dodatkowe pola
model_code += """
    predicted_diagnosis = models.CharField(max_length=255)
    is_new = models.BooleanField(default=0)

    def __str__(self):
        return f"{self.predicted_diagnosis} (New: {{self.is_new}})"
"""

# Zapisujemy kod do pliku TXT (zamiast models.py)
with open(output_file, "w", encoding="utf-8") as f:
    f.write(model_code)

print(f"✅ Model code saved to: {output_file}")
