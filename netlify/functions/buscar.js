// Proxy serverless: evita bloqueos CORS y oculta la API key de Congress.gov.
// Cobertura: Espana (BOE), Brasil (LexML), Reino Unido (legislation.gov.uk),
// Estados Unidos (Congress.gov, requiere CONGRESS_API_KEY en variables de
// entorno de Netlify) y Union Europea (EUR-Lex/CELLAR via SPARQL).
// Chile (BCN) y Alemania no tienen API publica de busqueda por palabra
// clave sin registro; para esos paises el portal usa la matriz curada.

async function buscarBOE(q) {
  const palabra = q.replace(/"/g, "").split(/\s+/)[0] || q;
  const queryObj = { query: { query_string: { query: "titulo:" + palabra } } };
  const url = "https://www.boe.es/datosabiertos/api/legislacion-consolidada?query=" + encodeURIComponent(JSON.stringify(queryObj)) + "&limit=5";
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("BOE " + r.status);
  const data = await r.json();
  const items = Array.isArray(data && data.data) ? data.data : [];
  return items.slice(0, 5).map((it) => ({
    pais: "Espana",
    titulo: it.titulo || it.identificador || "Norma BOE",
    url: it.url_html_consolidada || it.url_eli || ("https://www.boe.es/buscar/act.php?id=" + it.identificador),
    fecha: it.fecha_publicacion || it.fecha_disposicion || null,
  }));
}

async function buscarLexML(q) {
  const url = "https://www.lexml.gov.br/busca/SRU?operation=searchRetrieve&query=" + encodeURIComponent(q) + "&maximumRecords=5";
  const r = await fetch(url);
  if (!r.ok) throw new Error("LexML " + r.status);
  const text = await r.text();
  const matches = [...text.matchAll(/<identifier>([^<]+)<\/identifier>/g)].slice(0, 5);
  return matches.map((m) => ({ pais: "Brasil", titulo: m[1], url: m[1], fecha: null }));
}

async function buscarUK(q) {
  // legislation.gov.uk: feed Atom, sin token. Estructura documentada en /developer.
  const url = "https://www.legislation.gov.uk/all/data.feed?text=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: { Accept: "application/atom+xml" } });
  if (!r.ok) throw new Error("UK " + r.status);
  const text = await r.text();
  const entries = [...text.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, 5);
  return entries.map((e) => {
    const block = e[1];
    const title = (block.match(/<title[^>]*>([^<]+)<\/title>/) || [])[1] || "Norma UK";
    const link = (block.match(/<link[^>]*href="([^"]+)"/) || [])[1] || "https://www.legislation.gov.uk/";
    const updated = (block.match(/<updated>([^<]+)<\/updated>/) || [])[1] || null;
    return { pais: "Reino Unido", titulo: title, url: link, fecha: updated ? updated.slice(0, 10) : null };
  });
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
    fecha: (it.latestAction && it.latestAction.actionDate) || it.introducedDate || null,
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
    fecha: null,
  }));
}


async function buscarFrancia(q) {
  const clientId = process.env.LEGIFRANCE_CLIENT_ID;
  const clientSecret = process.env.LEGIFRANCE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Francia: falta LEGIFRANCE_CLIENT_ID / LEGIFRANCE_CLIENT_SECRET en variables de entorno de Netlify (registro gratis en piste.gouv.fr)");

  const tokenResp = await fetch("https://oauth.piste.gouv.fr/api/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&client_id=" + encodeURIComponent(clientId) + "&client_secret=" + encodeURIComponent(clientSecret) + "&scope=openid",
  });
  if (!tokenResp.ok) throw new Error("Francia (oauth) " + tokenResp.status);
  const tokenData = await tokenResp.json();
  const token = tokenData.access_token;

  const searchBody = {
    recherche: {
      champs: [{ typeChamp: "ALL", criteres: [{ typeRecherche: "UN_DES_MOTS", valeur: q, operateur: "ET" }], operateur: "ET" }],
      pageNumber: 1,
      pageSize: 5,
      sort: "PERTINENCE",
      typePagination: "DEFAUT",
    },
    fond: "LODA_DATE",
  };
  const r = await fetch("https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/search", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(searchBody),
  });
  if (!r.ok) throw new Error("Francia (search) " + r.status);
  const data = await r.json();
  const items = (data && data.results) || [];
  return items.slice(0, 5).map((it) => ({
    pais: "Francia",
    titulo: it.titre || it.title || "Norma Legifrance",
    url: it.url || "https://www.legifrance.gouv.fr/",
    fecha: it.dateDebut || null,
  }));
}

async function buscarNuevaZelanda(q) {
  const apiKey = process.env.NZ_LEGISLATION_API_KEY;
  if (!apiKey) throw new Error("Nueva Zelanda: falta NZ_LEGISLATION_API_KEY en variables de entorno de Netlify (se solicita por correo a contact@pco.govt.nz)");
  const url = "https://api.legislation.govt.nz/search?keywords=" + encodeURIComponent(q) + "&results-per-page=5";
  const r = await fetch(url, { headers: { Accept: "application/json", "x-api-key": apiKey } });
  if (!r.ok) throw new Error("Nueva Zelanda " + r.status);
  const data = await r.json();
  const items = (data && data.results) || (data && data.items) || [];
  return items.slice(0, 5).map((it) => ({
    pais: "Nueva Zelanda",
    titulo: it.title || it.name || "Norma NZ",
    url: it.link || it.url || "https://www.legislation.govt.nz/",
    fecha: it.date || it.year || null,
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
    ["Francia", buscarFrancia],
    ["Nueva Zelanda", buscarNuevaZelanda],
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
