// Einfacher Test aller Endpunkte (Node 18+, keine zusätzlichen Pakete)
process.env.DB_FILE = require("path").join(require("os").tmpdir(), `film-test-${Date.now()}.json`);
const assert = require("assert");
const app = require("./server");

const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}/api`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: res.status === 204 ? null : await res.json() };
  };
  try {
    let r = await call("GET", "/titles");
    assert.equal(r.status, 200); assert.equal(r.data.total, 6);

    r = await call("GET", "/titles?type=series&sort=rating&order=desc");
    assert(r.data.data.every((t) => t.type === "series")); assert.equal(r.data.data[0].title, "Breaking Bad");

    r = await call("POST", "/titles", { type: "movie", title: "Test", year: 2020 });
    assert.equal(r.status, 201); const id = r.data.id;

    r = await call("POST", "/titles", { type: "x", title: "", year: 1 });
    assert.equal(r.status, 400);

    r = await call("PUT", "/titles/" + id, { type: "series", title: "Test 2", year: 2021, seasons: 2 });
    assert.equal(r.data.title, "Test 2");

    r = await call("POST", `/titles/${id}/ratings`, { score: 7, author: "Tester" });
    assert.equal(r.status, 201); const rid = r.data.id;
    await call("POST", `/titles/${id}/ratings`, { score: 8 });

    r = await call("POST", `/titles/${id}/ratings`, { score: 11 });
    assert.equal(r.status, 400);

    r = await call("GET", "/titles/" + id);
    assert.equal(r.data.averageRating, 7.5); assert.equal(r.data.ratingCount, 2);

    r = await call("PUT", "/ratings/" + rid, { score: 9, author: "Tester" });
    assert.equal(r.data.score, 9);

    r = await call("DELETE", "/ratings/" + rid); assert.equal(r.status, 204);
    r = await call("DELETE", "/titles/" + id); assert.equal(r.status, 204);
    r = await call("GET", "/titles/" + id); assert.equal(r.status, 404);

    const docs = await fetch(base.replace("/api", "") + "/docs/");
    assert.equal(docs.status, 200);
    const spec = await (await fetch(base.replace("/api", "") + "/docs.json")).json();
    assert.equal(spec.openapi, "3.0.3");

    console.log("Alle Tests bestanden ✔");
  } catch (e) { console.error("Test fehlgeschlagen:", e); process.exitCode = 1; }
  server.close();
});
