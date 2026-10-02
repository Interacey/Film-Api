const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const swaggerUi = require("swagger-ui-express");
const openapi = require("./openapi");

const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "data", "db.json");

/* ------------------------------------------------------------------ */
/* Speicher: einfache JSON-Datei (kein Datenbank-Server nötig)         */
/* ------------------------------------------------------------------ */

const seed = () => ({
  titles: [
    { id: "t1", type: "movie", title: "Inception", year: 2010, genres: ["Sci-Fi", "Thriller"], director: "Christopher Nolan", durationMinutes: 148, description: "Ein Dieb stiehlt Geheimnisse direkt aus den Träumen seiner Opfer." },
    { id: "t2", type: "movie", title: "Der Pate", year: 1972, genres: ["Krimi", "Drama"], director: "Francis Ford Coppola", durationMinutes: 175, description: "Aufstieg und Fall einer New Yorker Mafia-Familie." },
    { id: "t3", type: "movie", title: "Parasite", year: 2019, genres: ["Thriller", "Drama"], director: "Bong Joon-ho", durationMinutes: 132, description: "Eine arme Familie schleicht sich in den Haushalt einer reichen Familie ein." },
    { id: "t4", type: "series", title: "Breaking Bad", year: 2008, genres: ["Krimi", "Drama"], seasons: 5, episodes: 62, description: "Ein Chemielehrer wird zum Drogenboss." },
    { id: "t5", type: "series", title: "Dark", year: 2017, genres: ["Sci-Fi", "Mystery"], seasons: 3, episodes: 26, description: "Das Verschwinden von Kindern enthüllt Zeitreisen und Familiengeheimnisse." },
    { id: "t6", type: "series", title: "The Office (US)", year: 2005, genres: ["Comedy"], seasons: 9, episodes: 201, description: "Der Alltag in einer Papierfirma in Scranton." }
  ],
  ratings: [
    { id: "r1", titleId: "t1", score: 9, author: "Anna", comment: "Kopfkino pur.", createdAt: new Date().toISOString() },
    { id: "r2", titleId: "t1", score: 8, author: "Ben", comment: "Etwas verwirrend, aber stark.", createdAt: new Date().toISOString() },
    { id: "r3", titleId: "t4", score: 10, author: "Anna", comment: "Beste Serie überhaupt.", createdAt: new Date().toISOString() },
    { id: "r4", titleId: "t5", score: 9, author: "Chris", comment: "Man muss aufpassen!", createdAt: new Date().toISOString() },
    { id: "r5", titleId: "t3", score: 9, author: "Ben", comment: "", createdAt: new Date().toISOString() }
  ]
});

let db;
function load() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    db = seed();
    save();
  }
}
function save() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
const newId = (prefix) => prefix + crypto.randomBytes(4).toString("hex");

/* ------------------------------------------------------------------ */
/* Hilfsfunktionen                                                     */
/* ------------------------------------------------------------------ */

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function withStats(t) {
  const rs = db.ratings.filter((r) => r.titleId === t.id);
  const sum = rs.reduce((s, r) => s + r.score, 0);
  return {
    ...t,
    ratingCount: rs.length,
    averageRating: rs.length ? Math.round((sum / rs.length) * 10) / 10 : null
  };
}

/** Prüft Titel-Daten. `partial` = bei PUT/PATCH sind alle Felder optional. */
function validateTitle(body, partial = false) {
  const errors = [];
  const out = {};
  const has = (k) => body[k] !== undefined;

  if (!partial || has("type")) {
    if (!["movie", "series"].includes(body.type)) errors.push("type muss 'movie' oder 'series' sein");
    else out.type = body.type;
  }
  if (!partial || has("title")) {
    if (typeof body.title !== "string" || !body.title.trim()) errors.push("title ist erforderlich");
    else out.title = body.title.trim();
  }
  if (!partial || has("year")) {
    const y = Number(body.year);
    if (!Number.isInteger(y) || y < 1888 || y > new Date().getFullYear() + 5) errors.push("year muss eine gültige Jahreszahl sein");
    else out.year = y;
  }
  if (has("genres")) {
    if (!Array.isArray(body.genres) || body.genres.some((g) => typeof g !== "string")) errors.push("genres muss eine Liste von Texten sein");
    else out.genres = body.genres.map((g) => g.trim()).filter(Boolean);
  } else if (!partial) out.genres = [];

  for (const k of ["director", "description"]) {
    if (has(k)) {
      if (typeof body[k] !== "string") errors.push(`${k} muss Text sein`);
      else out[k] = body[k].trim();
    }
  }
  for (const k of ["durationMinutes", "seasons", "episodes"]) {
    if (has(k)) {
      const n = Number(body[k]);
      if (!Number.isInteger(n) || n < 1) errors.push(`${k} muss eine positive ganze Zahl sein`);
      else out[k] = n;
    }
  }
  if (errors.length) throw new HttpError(400, "Ungültige Eingabe", errors);
  return out;
}

function validateRating(body, partial = false) {
  const errors = [];
  const out = {};
  if (!partial || body.score !== undefined) {
    const s = Number(body.score);
    if (!Number.isInteger(s) || s < 1 || s > 10) errors.push("score muss eine ganze Zahl von 1 bis 10 sein");
    else out.score = s;
  }
  if (body.author !== undefined) {
    if (typeof body.author !== "string") errors.push("author muss Text sein");
    else out.author = body.author.trim() || "Anonym";
  } else if (!partial) out.author = "Anonym";
  if (body.comment !== undefined) {
    if (typeof body.comment !== "string" || body.comment.length > 1000) errors.push("comment muss Text mit max. 1000 Zeichen sein");
    else out.comment = body.comment.trim();
  } else if (!partial) out.comment = "";
  if (errors.length) throw new HttpError(400, "Ungültige Eingabe", errors);
  return out;
}

const findTitle = (id) => {
  const t = db.titles.find((x) => x.id === id);
  if (!t) throw new HttpError(404, `Titel '${id}' nicht gefunden`);
  return t;
};
const findRating = (id) => {
  const r = db.ratings.find((x) => x.id === id);
  if (!r) throw new HttpError(404, `Bewertung '${id}' nicht gefunden`);
  return r;
};

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

const app = express();
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public"))); // Bonus: Handy-Web-App

// API-Dokumentation: /docs (Swagger UI) und /docs.json (OpenAPI-Rohdaten)
app.get("/docs.json", (req, res) => res.json(openapi));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: "Film- & Serien-API – Doku" }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

/* ---- Titel (Filme & Serien) --------------------------------------- */

// GET /api/titles?type=movie&genre=Sci-Fi&q=inc&sort=rating&order=desc&page=1&limit=20
app.get("/api/titles", (req, res) => {
  const { type, genre, q, sort = "title", order = "asc" } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

  let list = db.titles.map(withStats);
  if (type) list = list.filter((t) => t.type === type);
  if (genre) list = list.filter((t) => t.genres?.some((g) => g.toLowerCase() === String(genre).toLowerCase()));
  if (q) list = list.filter((t) => t.title.toLowerCase().includes(String(q).toLowerCase()));

  const key = { rating: "averageRating", year: "year", title: "title" }[sort] || "title";
  const dir = order === "desc" ? -1 : 1;
  list.sort((a, b) => {
    const x = a[key], y = b[key];
    if (x === y) return 0;
    if (x === null) return 1; // unbewertete Titel immer ans Ende
    if (y === null) return -1;
    return (x > y ? 1 : -1) * dir;
  });

  const total = list.length;
  res.json({ total, page, limit, data: list.slice((page - 1) * limit, page * limit) });
});

app.get("/api/titles/:id", (req, res) => {
  const t = findTitle(req.params.id);
  res.json({ ...withStats(t), ratings: db.ratings.filter((r) => r.titleId === t.id) });
});

app.post("/api/titles", (req, res) => {
  const data = validateTitle(req.body);
  const t = { id: newId("t"), ...data };
  db.titles.push(t);
  save();
  res.status(201).location(`/api/titles/${t.id}`).json(withStats(t));
});

// PUT ersetzt den Titel komplett (id bleibt erhalten)
app.put("/api/titles/:id", (req, res) => {
  const old = findTitle(req.params.id);
  const data = validateTitle(req.body);
  const idx = db.titles.indexOf(old);
  db.titles[idx] = { id: old.id, ...data };
  save();
  res.json(withStats(db.titles[idx]));
});

// PATCH ändert nur die mitgeschickten Felder
app.patch("/api/titles/:id", (req, res) => {
  const t = findTitle(req.params.id);
  Object.assign(t, validateTitle(req.body, true));
  save();
  res.json(withStats(t));
});

app.delete("/api/titles/:id", (req, res) => {
  const t = findTitle(req.params.id);
  db.titles = db.titles.filter((x) => x !== t);
  db.ratings = db.ratings.filter((r) => r.titleId !== t.id); // Bewertungen mitlöschen
  save();
  res.status(204).end();
});

/* ---- Bewertungen --------------------------------------------------- */

app.get("/api/titles/:id/ratings", (req, res) => {
  const t = findTitle(req.params.id);
  res.json(db.ratings.filter((r) => r.titleId === t.id));
});

app.post("/api/titles/:id/ratings", (req, res) => {
  const t = findTitle(req.params.id);
  const r = { id: newId("r"), titleId: t.id, ...validateRating(req.body), createdAt: new Date().toISOString() };
  db.ratings.push(r);
  save();
  res.status(201).location(`/api/ratings/${r.id}`).json(r);
});

app.get("/api/ratings/:id", (req, res) => res.json(findRating(req.params.id)));

app.put("/api/ratings/:id", (req, res) => {
  const old = findRating(req.params.id);
  const data = validateRating(req.body);
  Object.assign(old, data, { updatedAt: new Date().toISOString() });
  save();
  res.json(old);
});

app.delete("/api/ratings/:id", (req, res) => {
  const r = findRating(req.params.id);
  db.ratings = db.ratings.filter((x) => x !== r);
  save();
  res.status(204).end();
});

/* ---- Fehlerbehandlung --------------------------------------------- */

app.use("/api", (req, res) => res.status(404).json({ error: "Route nicht gefunden" }));

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Ungültiges JSON" });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  console.error(err);
  res.status(500).json({ error: "Interner Serverfehler" });
});

load();
if (require.main === module) {
  app.listen(PORT, () => console.log(`API läuft auf http://localhost:${PORT}`));
}
module.exports = app;
