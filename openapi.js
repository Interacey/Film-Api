// OpenAPI-3-Beschreibung der API. Wird unter /docs (Swagger UI) und /docs.json ausgeliefert.

const errorResponse = (description) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
});

const idParam = (name, example) => ({
  name, in: "path", required: true, schema: { type: "string" }, example,
  description: name === "id" ? "ID (z. B. `t1` für Titel oder `r1` für Bewertungen)" : name
});

module.exports = {
  openapi: "3.0.3",
  info: {
    title: "Film- & Serien-API",
    version: "1.0.0",
    description:
      "REST-API für Filme und Serien, die mit 1–10 Punkten bewertet werden können.\n\n" +
      "Klicke bei einem Endpunkt auf **Try it out**, um ihn direkt hier auszuprobieren.\n\n" +
      "**Hinweis:** Beim Gratis-Plan von Render schläft der Server nach 15 Minuten. Der erste Aufruf kann bis zu einer Minute dauern."
  },
  servers: [{ url: "/", description: "Dieser Server" }],
  tags: [
    { name: "Titel", description: "Filme und Serien" },
    { name: "Bewertungen", description: "Punkte und Kommentare zu Titeln" },
    { name: "System", description: "Statuscheck" }
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["System"], summary: "Statuscheck",
        responses: { 200: { description: "Server läuft", content: { "application/json": { example: { status: "ok" } } } } }
      }
    },

    "/api/titles": {
      get: {
        tags: ["Titel"], summary: "Titel auflisten",
        description: "Liefert Filme und Serien mit Durchschnittsbewertung. Filter lassen sich kombinieren. Titel ohne Bewertung stehen bei der Sortierung nach Bewertung immer am Ende.",
        parameters: [
          { name: "type", in: "query", schema: { type: "string", enum: ["movie", "series"] }, description: "Nur Filme oder nur Serien" },
          { name: "genre", in: "query", schema: { type: "string" }, example: "Sci-Fi", description: "Genau ein Genre (Groß-/Kleinschreibung egal)" },
          { name: "q", in: "query", schema: { type: "string" }, example: "dark", description: "Suche im Titel (Teilwort genügt)" },
          { name: "sort", in: "query", schema: { type: "string", enum: ["title", "year", "rating"], default: "title" }, description: "Sortierfeld" },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "asc" }, description: "Richtung. Für die besten zuerst: `sort=rating&order=desc`" },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "Seite" },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }, description: "Einträge pro Seite (max. 100)" }
        ],
        responses: {
          200: {
            description: "Liste der Titel",
            content: { "application/json": { schema: {
              type: "object",
              properties: {
                total: { type: "integer", example: 66 },
                page: { type: "integer", example: 1 },
                limit: { type: "integer", example: 20 },
                data: { type: "array", items: { $ref: "#/components/schemas/Title" } }
              }
            } } }
          }
        }
      },
      post: {
        tags: ["Titel"], summary: "Film oder Serie anlegen",
        description: "Pflichtfelder: `type`, `title`, `year`.",
        requestBody: { required: true, content: { "application/json": {
          schema: { $ref: "#/components/schemas/TitleInput" },
          examples: {
            film: { summary: "Film", value: { type: "movie", title: "Interstellar", year: 2014, genres: ["Sci-Fi", "Drama"], director: "Christopher Nolan", durationMinutes: 169, description: "Eine Reise durch ein Wurmloch." } },
            serie: { summary: "Serie", value: { type: "series", title: "Severance", year: 2022, genres: ["Thriller"], seasons: 2, episodes: 19 } }
          }
        } } },
        responses: {
          201: { description: "Angelegt. Der `Location`-Header zeigt auf den neuen Titel.", content: { "application/json": { schema: { $ref: "#/components/schemas/Title" } } } },
          400: errorResponse("Ungültige Eingabe")
        }
      }
    },

    "/api/titles/{id}": {
      parameters: [idParam("id", "t1")],
      get: {
        tags: ["Titel"], summary: "Einen Titel mit allen Bewertungen abrufen",
        responses: {
          200: { description: "Titel inkl. Bewertungen", content: { "application/json": { schema: { $ref: "#/components/schemas/TitleDetail" } } } },
          404: errorResponse("Titel nicht gefunden")
        }
      },
      put: {
        tags: ["Titel"], summary: "Titel komplett ersetzen",
        description: "Alle Pflichtfelder (`type`, `title`, `year`) müssen mitgeschickt werden. Felder, die fehlen, werden entfernt. Die ID bleibt gleich. Bewertungen bleiben erhalten.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/TitleInput" } } } },
        responses: {
          200: { description: "Geänderter Titel", content: { "application/json": { schema: { $ref: "#/components/schemas/Title" } } } },
          400: errorResponse("Ungültige Eingabe"),
          404: errorResponse("Titel nicht gefunden")
        }
      },
      patch: {
        tags: ["Titel"], summary: "Einzelne Felder eines Titels ändern",
        description: "Nur die mitgeschickten Felder werden geändert.",
        requestBody: { required: true, content: { "application/json": {
          schema: { $ref: "#/components/schemas/TitleInput" },
          example: { description: "Neue Beschreibung" }
        } } },
        responses: {
          200: { description: "Geänderter Titel", content: { "application/json": { schema: { $ref: "#/components/schemas/Title" } } } },
          400: errorResponse("Ungültige Eingabe"),
          404: errorResponse("Titel nicht gefunden")
        }
      },
      delete: {
        tags: ["Titel"], summary: "Titel löschen",
        description: "Löscht auch alle Bewertungen dieses Titels.",
        responses: { 204: { description: "Gelöscht (keine Antwort)" }, 404: errorResponse("Titel nicht gefunden") }
      }
    },

    "/api/titles/{id}/ratings": {
      parameters: [idParam("id", "t1")],
      get: {
        tags: ["Bewertungen"], summary: "Bewertungen eines Titels auflisten",
        responses: {
          200: { description: "Liste der Bewertungen", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Rating" } } } } },
          404: errorResponse("Titel nicht gefunden")
        }
      },
      post: {
        tags: ["Bewertungen"], summary: "Bewertung abgeben",
        description: "Pflichtfeld: `score` (ganze Zahl 1 bis 10). Ohne `author` wird „Anonym“ eingetragen.",
        requestBody: { required: true, content: { "application/json": {
          schema: { $ref: "#/components/schemas/RatingInput" },
          example: { score: 9, author: "Anna", comment: "Super!" }
        } } },
        responses: {
          201: { description: "Bewertung gespeichert", content: { "application/json": { schema: { $ref: "#/components/schemas/Rating" } } } },
          400: errorResponse("Ungültige Eingabe, z. B. score außerhalb von 1–10"),
          404: errorResponse("Titel nicht gefunden")
        }
      }
    },

    "/api/ratings/{id}": {
      parameters: [idParam("id", "r1")],
      get: {
        tags: ["Bewertungen"], summary: "Eine Bewertung abrufen",
        responses: {
          200: { description: "Die Bewertung", content: { "application/json": { schema: { $ref: "#/components/schemas/Rating" } } } },
          404: errorResponse("Bewertung nicht gefunden")
        }
      },
      put: {
        tags: ["Bewertungen"], summary: "Bewertung ändern",
        description: "`score` ist Pflicht.",
        requestBody: { required: true, content: { "application/json": {
          schema: { $ref: "#/components/schemas/RatingInput" },
          example: { score: 10, author: "Anna", comment: "Doch 10 Punkte" }
        } } },
        responses: {
          200: { description: "Geänderte Bewertung", content: { "application/json": { schema: { $ref: "#/components/schemas/Rating" } } } },
          400: errorResponse("Ungültige Eingabe"),
          404: errorResponse("Bewertung nicht gefunden")
        }
      },
      delete: {
        tags: ["Bewertungen"], summary: "Bewertung löschen",
        responses: { 204: { description: "Gelöscht (keine Antwort)" }, 404: errorResponse("Bewertung nicht gefunden") }
      }
    }
  },

  components: {
    schemas: {
      TitleInput: {
        type: "object",
        required: ["type", "title", "year"],
        properties: {
          type: { type: "string", enum: ["movie", "series"], example: "movie" },
          title: { type: "string", example: "Inception" },
          year: { type: "integer", example: 2010 },
          genres: { type: "array", items: { type: "string" }, example: ["Sci-Fi", "Thriller"] },
          director: { type: "string", example: "Christopher Nolan" },
          description: { type: "string" },
          durationMinutes: { type: "integer", minimum: 1, description: "Nur bei Filmen", example: 148 },
          seasons: { type: "integer", minimum: 1, description: "Nur bei Serien", example: 5 },
          episodes: { type: "integer", minimum: 1, description: "Nur bei Serien", example: 62 }
        }
      },
      Title: {
        allOf: [
          { $ref: "#/components/schemas/TitleInput" },
          { type: "object", properties: {
            id: { type: "string", example: "t1" },
            averageRating: { type: "number", nullable: true, description: "Durchschnitt, `null` ohne Bewertungen", example: 8.5 },
            ratingCount: { type: "integer", example: 2 }
          } }
        ]
      },
      TitleDetail: {
        allOf: [
          { $ref: "#/components/schemas/Title" },
          { type: "object", properties: { ratings: { type: "array", items: { $ref: "#/components/schemas/Rating" } } } }
        ]
      },
      RatingInput: {
        type: "object",
        required: ["score"],
        properties: {
          score: { type: "integer", minimum: 1, maximum: 10, example: 9 },
          author: { type: "string", example: "Anna" },
          comment: { type: "string", maxLength: 1000, example: "Kopfkino pur." }
        }
      },
      Rating: {
        allOf: [
          { $ref: "#/components/schemas/RatingInput" },
          { type: "object", properties: {
            id: { type: "string", example: "r1" },
            titleId: { type: "string", example: "t1" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          } }
        ]
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Ungültige Eingabe" },
          details: { type: "array", items: { type: "string" }, example: ["score muss eine ganze Zahl von 1 bis 10 sein"] }
        }
      }
    }
  }
};
