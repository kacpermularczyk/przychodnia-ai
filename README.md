# Przychodnia-AI
Aplikacja webowa wspomagająca zarządzanie przychodnią z wykorzystaniem modułu AI.

## Wymagane wersje

Projekt był uruchamiany przy użyciu:
- Python 3.11.9
- Node.js 22.14.0

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

## Konta testowe

### Administrator
- login: `email@email.com`
- hasło: `123`

### Lekarz
- login: `doctor@doctor.com`
- hasło: `Haslo123!`

### Pracownik
- login: `user8989@email.com`
- hasło: `Testing321`

### Użytkownik
- login: `agata@agata.com`
- hasło: `Haslo123!`


## Panel administracyjny

Panel administracyjny Django jest dostępny po uruchomieniu backendu pod adresem:

`http://127.0.0.1:8000/admin`

Do panelu można zalogować się za pomocą konta administratora podanego w sekcji **Konta testowe**.
