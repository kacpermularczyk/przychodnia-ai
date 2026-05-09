# przychodnia-ai
Aplikacja webowa wspomagająca zarządzanie przychodnią z wykorzystaniem modułu AI.


# Uruchomienie aplikacji

## Backend (Django)

Przejdź do folderu backend:

```bash
cd backend
```

Utwórz środowisko wirtualne:

```bash
python -m venv venv
```

Aktywuj środowisko:

### Windows

```bash
venv\Scripts\activate
```

Zainstaluj wymagane biblioteki:

```bash
pip install -r requirements.txt
```

Uruchom backend:

```bash
python manage.py runserver
```

Backend powinien działać pod adresem:

```text
http://127.0.0.1:8000/
```

---

## Frontend (React + Vite)

Przejdź do folderu frontend:

```bash
cd frontend
```

Zainstaluj zależności:

```bash
npm install
```

Uruchom aplikację:

```bash
npm run dev
```

Frontend powinien działać pod adresem wyświetlonym w terminalu, najczęściej:

```text
http://localhost:5173/
```
