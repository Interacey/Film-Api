# Film- & Serien-API mit Bewertungen

REST-API (Node.js + Express) für Filme und Serien, die bewertet werden können (1–10 Punkte).
Enthält eine Handy-Web-App (Bonus) unter `/`.

## Starten

```bash
npm install
npm start          # http://localhost:3000
npm test           # testet alle Endpunkte
```

## Dokumentation

Interaktive API-Doku (Swagger UI) unter **`/docs`**, Rohdaten unter `/docs.json`.
Mit **Try it out** lassen sich alle Endpunkte direkt im Browser ausprobieren.

## Endpunkte

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/titles` | Liste. Filter: `type`, `genre`, `q`, `sort` (title/year/rating), `order`, `page`, `limit` |
| GET | `/api/titles/:id` | Ein Titel inkl. aller Bewertungen und Durchschnitt |
| POST | `/api/titles` | Neuen Film/Serie anlegen |
| PUT | `/api/titles/:id` | Titel komplett ersetzen |
| PATCH | `/api/titles/:id` | Einzelne Felder ändern |
| DELETE | `/api/titles/:id` | Titel samt Bewertungen löschen |
| GET | `/api/titles/:id/ratings` | Bewertungen eines Titels |
| POST | `/api/titles/:id/ratings` | Bewertung abgeben |
| GET | `/api/ratings/:id` | Eine Bewertung |
| PUT | `/api/ratings/:id` | Bewertung ändern |
| DELETE | `/api/ratings/:id` | Bewertung löschen |
| GET | `/api/health` | Statuscheck |

Statuscodes: `200` OK, `201` erstellt, `204` gelöscht, `400` ungültige Eingabe, `404` nicht gefunden.

## Beispiele

```bash
# Alle Serien, beste zuerst
curl "http://localhost:3000/api/titles?type=series&sort=rating&order=desc"

# Film anlegen
curl -X POST http://localhost:3000/api/titles -H "Content-Type: application/json" \
  -d '{"type":"movie","title":"Interstellar","year":2014,"genres":["Sci-Fi"],"director":"Christopher Nolan","durationMinutes":169}'

# Serie anlegen
curl -X POST http://localhost:3000/api/titles -H "Content-Type: application/json" \
  -d '{"type":"series","title":"Severance","year":2022,"seasons":2,"genres":["Thriller"]}'

# Bewerten
curl -X POST http://localhost:3000/api/titles/t1/ratings -H "Content-Type: application/json" \
  -d '{"score":9,"author":"Anna","comment":"Super!"}'

# Löschen
curl -X DELETE http://localhost:3000/api/titles/t1
```

### Felder eines Titels

`type` (`movie` | `series`, Pflicht), `title` (Pflicht), `year` (Pflicht), `genres` (Liste), `director`, `description`,
Filme: `durationMinutes` · Serien: `seasons`, `episodes`.

## Online stellen (GitHub + Render)

1. Projekt auf GitHub hochladen (`git init`, `git add .`, `git commit`, `git push`).
2. Auf render.com: **New → Web Service**, das Repository auswählen. Die `render.yaml` setzt alles automatisch
   (Build: `npm install`, Start: `npm start`).
3. Nach dem Deploy ist die API unter `https://<dein-name>.onrender.com/api/titles` erreichbar, die App unter `/`.

Hinweis: Der Gratis-Plan von Render hat keinen dauerhaften Speicher. Die Daten in `data/db.json` werden bei
einem Neustart auf die Startdaten zurückgesetzt. Für dauerhafte Daten später auf SQLite/PostgreSQL wechseln.
