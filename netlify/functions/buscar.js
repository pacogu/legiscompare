// Proxy serverless: evita bloqueos CORS y oculta la API key de Congress.gov.
// Cobertura: Espana (BOE), Brasil (LexML), Reino Unido (legislation.gov.uk),
// Estados Unidos (Congress.gov, requiere CONGRESS_API_KEY en variables de
// entorno de Netlify) y Union Europea (EUR-Lex/CELLAR via SPARQL).
// Chile (BCN) y Alemania no tienen API publica de busqueda por palabra
// clave sin registro; para esos paises el portal usa la matriz curada.

async function buscarBOE(q) {
  const url = "https://www.boe.es/datosabiertos/api/legislacion-consolidada?query=" + encodeURIComponent(q) + "&limit=5";
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("BOE " + r.status);
  const data = await r.json();
  const items = (data && data.data && data.data.legislacion_consolidada) || [];
  return items.slice(0, 5).map((it) => ({
    pais: "Espana",
    titulo: it.titulo || it.identificador || "Norma BOE",
    url: it.url_html_consolidada || it.url_eli || ("https://www.boe.es/buscar/act.php?id=" + it.identificador),
  }));
}

async function buscarLexML(q) {
  const url = "https://www.lexml.gov.br/busca/SRU?operation=searchRetrieve&query=" + encodeURIComponent(q) + "&maximumRecords=5";
  const r = await fetch(url);
  if (!r.ok) throw new Error("LexML " + r.status);
  const text = await r.text();
  const matches = [...text.matchAll(/<identifier>([^<]+)<\/identifier>/g)].slice(0, 5);
  return matches.map((m) => ({ pais: "Brasil", titulo: m[1], url: m[1] }));
}

async function buscarUK(q) {
  // legislation.gov.uk: feed Atom, sin token. Estructura documentada en /developer.
  const url = "https://www.legislation.gov.uk/all/data.feed?text=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: { Accept: "application/atom+xml" } });
  if (!r.ok) throw new Error("UK " + r.status);
  const text = await r.text();
  const entries = [...text.matchAll(/<entry>[\s\S]*?<title[^>]*>([^<]+)<\/title>[\s\S]*?<link[^>]*href="([^"]+)"/g)].slice(0, 5);
  return entries.map((m) => ({ pais: "Reino Unido", titulo: m[1], url: m[2] }));
}

async function buscarUSCongress(q) {
  const key = process.env.CONGRESS_API_KEY;
  if (!key) throw new Error("EE.UU.: falta CONGRESS_API_KEY en variables de entorno de Netlify");
  const url = "https://api.congress.gov/v3/bill?query=" + encodeURIComponent(q) + "&limit=5&api_key=" + key;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("Congress.gov " + r.status);
  const data = await r.json();
  const items = (data && data.bills) || [];
  return items.slice(0, 5).map((it) => ({
    pais: "Estados Unidos",
    titulo: (it.type || "") + " " + (it.number || "") + " - " + (it.title || ""),
    url: it.url || "https://www.congress.gov/",
  }));
}

async function buscarEurLex(q) {
  // SPARQL publico de CELLAR. Consulta simple por titulo (rdfs:label) que contenga el texto.
  const sparql = `
    SELECT ?work ?title WHERE {
      ?work a <http://publications.europa.eu/ontology/cdm#work> ;
            <http://purl.org/dc/elements/1.1/title> ?title .
      FILTER(CONTAINS(LCASE(STR(?title)), LCASE("${q.replace(/"/g, '\\"')}")))
    } LIMIT 5`;
  const url = "https://publications.europa.eu/webapi/rdf/sparql?query=" + encodeURIComponent(sparql) + "&format=application%2Fsparql-results%2Bjson";
  const r = await fetch(url, { headers: { Accept: "application/sparql-results+json" } });
  if (!r.ok) throw new Error("EUR-Lex " + r.status);
  const data = await r.json();
  const bindings = (data && data.results && data.results.bindings) || [];
  return bindings.slice(0, 5).map((b) => ({
    pais: "Union Europea",
    titulo: b.title ? b.title.value : "Documento EUR-Lex",
    url: b.work ? b.work.value : "https://eur-lex.europa.eu/",
  }));
}

exports.handler = async function (event) {
  const q = (event.queryStringParameters && event.queryStringParameters.q) || "";
  if (!q) {
    return { statusCode: 400, body: JSON.stringify({ error: "falta parametro q" }) };
  }
  const resultados = [];
  const errores = [];
  const fuentes = [
    ["BOE", buscarBOE],
    ["LexML", buscarLexML],
    ["UK", buscarUK],
    ["Congress.gov", buscarUSCongress],
    ["EUR-Lex", buscarEurLex],
  ];
  for (const [nombre, fn] of fuentes) {
    try {
      const r = await fn(q);
      resultados.push(...r);
    } catch (e) {
      errores.push(nombre + ": " + e.message);
    }
  }

  errores.push("Chile: sin API publica de busqueda por palabra clave (BCN no expone una).");
  errores.push("Alemania: sin API publica de busqueda por palabra clave (gesetze-im-internet solo ofrece indice, no busqueda).");

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ resultados, errores }),
  };
};
