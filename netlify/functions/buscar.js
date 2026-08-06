// Busqueda de legislacion comparada combinando:
// 1) Conectores reales a APIs oficiales gratuitas (sin llave, sin costo)
//    para los paises donde existen: Brasil (Camara de Diputados) y
//    Reino Unido (legislation.gov.uk). Estos devuelven el NOMBRE REAL de
//    proyectos/leyes, sin usar IA.
// 2) Para el resto de paises, Groq (gratis, sin tarjeta) analiza el
//    catalogo curado de fuentes oficiales y redacta una nota de que
//    buscar en cada una - sin inventar el nombre de una norma que no
//    pueda verificar.

const CONECTORES_REALES = new Set([
  "brasil", "reino unido", "union europea", "irlanda",
  "colombia", "panama", "paises bajos", "suecia",
  "dinamarca", "suiza", "nueva zelanda", "canada", "polonia", "japon",
  "israel", "noruega", "espana", "luxemburgo", "austria",
]);

exports.handler = async function (event) {
  const q = (event.queryStringParameters && event.queryStringParameters.q) || "";
  const fuentesParam = (event.queryStringParameters && event.queryStringParameters.fuentes) || "";
  if (!q) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "falta parametro q" }) };
  }

  let fuentesLista = [];
  try { fuentesLista = fuentesParam ? JSON.parse(fuentesParam) : []; } catch (e) { fuentesLista = []; }

  if (!fuentesLista.length) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["No hay fuentes oficiales para los paises seleccionados."] }) };
  }

  const fuentesConConector = fuentesLista.filter((f) => CONECTORES_REALES.has(normalizar(f.pais)));
  const fuentesSinConector = fuentesLista.filter((f) => !CONECTORES_REALES.has(normalizar(f.pais)));

  const errores = [];
  let resultadosReales = [];

  const paisesConConector = [...new Set(fuentesConConector.map((f) => normalizar(f.pais)))];
  for (const pais of paisesConConector) {
    try {
      if (pais === "brasil") resultadosReales = resultadosReales.concat(await buscarBrasil(q));
      else if (pais === "reino unido") resultadosReales = resultadosReales.concat(await buscarReinoUnido(q));
      else if (pais === "union europea") resultadosReales = resultadosReales.concat(await buscarUnionEuropea(q));
      else if (pais === "irlanda") resultadosReales = resultadosReales.concat(await buscarIrlanda(q));
      else if (pais === "colombia") resultadosReales = resultadosReales.concat(await buscarCKAN(q, "Colombia", "https://www.datos.gov.co"));
      else if (pais === "panama") resultadosReales = resultadosReales.concat(await buscarCKAN(q, "Panama", "https://www.datosabiertos.gob.pa"));
      else if (pais === "paises bajos") resultadosReales = resultadosReales.concat(await buscarPaisesBajos(q));
      else if (pais === "suecia") resultadosReales = resultadosReales.concat(await buscarSuecia(q));
      else if (pais === "dinamarca") resultadosReales = resultadosReales.concat(await buscarDinamarca(q));
      else if (pais === "suiza") resultadosReales = resultadosReales.concat(await buscarSuiza(q));
      else if (pais === "nueva zelanda") resultadosReales = resultadosReales.concat(await buscarNuevaZelanda(q));
      else if (pais === "canada") resultadosReales = resultadosReales.concat(await buscarCanada(q));
      else if (pais === "polonia") resultadosReales = resultadosReales.concat(await buscarPolonia(q));
      else if (pais === "japon") resultadosReales = resultadosReales.concat(await buscarJapon(q));
      else if (pais === "israel") resultadosReales = resultadosReales.concat(await buscarIsrael(q));
      else if (pais === "noruega") resultadosReales = resultadosReales.concat(await buscarNoruega(q));
      else if (pais === "espana") resultadosReales = resultadosReales.concat(await buscarEspana(q));
      else if (pais === "luxemburgo") resultadosReales = resultadosReales.concat(await buscarLuxemburgo(q));
      else if (pais === "austria") resultadosReales = resultadosReales.concat(await buscarAustria(q));
    } catch (e) {
      errores.push("Conector de " + pais + ": " + e.message);
    }
  }

  let resultadosGroq = [];
  if (fuentesSinConector.length) {
    const out = await analizarConGroq(q, fuentesSinConector);
    resultadosGroq = out.resultados;
    if (out.error) errores.push(out.error);
    if (out.tipoError) {
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: resultadosReales, errores: errores.length ? errores : [out.error], tipoError: resultadosReales.length ? undefined : out.tipoError }) };
    }
  }

  const resultados = resultadosReales.concat(resultadosGroq).slice(0, 30);
  return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados, errores }) };
};

// --- Conector real: Camara de Diputados de Brasil (dadosabertos.camara.leg.br) ---
async function buscarBrasil(q) {
  const url = "https://dadosabertos.camara.leg.br/api/v2/proposicoes?keywords=" +
    encodeURIComponent(q) + "&itens=8&ordem=DESC&ordenarPor=id";
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API Camara Brasil " + r.status);
  const data = await r.json();
  const dados = (data && data.dados) || [];
  return dados.map((it) => ({
    pais: "Brasil",
    titulo: (it.siglaTipo || "") + " " + it.numero + "/" + it.ano + " - " + (it.ementa || "").slice(0, 140),
    url: "https://www.camara.leg.br/propostas-legislativas/" + it.id,
    fecha: it.dataApresentacao ? it.dataApresentacao.slice(0, 10) : null,
    resumen: it.ementa || null,
    relevancia: null,
  }));
}

// --- Conector real: legislation.gov.uk (feed Atom oficial) ---
async function buscarReinoUnido(q) {
  const url = "https://www.legislation.gov.uk/all/data.feed?text=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: { accept: "application/atom+xml" } });
  if (!r.ok) throw new Error("API legislation.gov.uk " + r.status);
  const xml = await r.text();
  const entradas = xml.split("<entry>").slice(1).slice(0, 8);
  return entradas.map((frag) => {
    const titulo = (frag.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "Norma sin titulo";
    const link = (frag.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/) || frag.match(/<id>([^<]+)<\/id>/) || [])[1] || null;
    const fecha = (frag.match(/<updated>([^<]+)<\/updated>/) || [])[1];
    return {
      pais: "Reino Unido",
      titulo: decodificarEntidades(titulo),
      url: link,
      fecha: fecha ? fecha.slice(0, 10) : null,
      resumen: null,
      relevancia: null,
    };
  });
}

// --- Conector real: EUR-Lex / CELLAR (SPARQL publico, sin llave) ---
// Cubre normativa de la Union Europea (reglamentos, directivas, decisiones).
async function buscarUnionEuropea(q) {
  const termino = q.toLowerCase().replace(/"/g, "");
  const sparql =
    "PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>\n" +
    "SELECT DISTINCT ?work ?title WHERE {\n" +
    "  ?exp cdm:expression_title ?title .\n" +
    "  ?exp cdm:expression_belongs_to_work ?work .\n" +
    "  ?exp cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> .\n" +
    "  FILTER(CONTAINS(LCASE(STR(?title)), \"" + termino + "\"))\n" +
    "} LIMIT 8";
  const url = "https://publications.europa.eu/webapi/rdf/sparql?format=json&query=" + encodeURIComponent(sparql);
  const r = await fetch(url, { headers: { accept: "application/sparql-results+json" } });
  if (!r.ok) throw new Error("EUR-Lex SPARQL " + r.status);
  const data = await r.json();
  const filas = (data && data.results && data.results.bindings) || [];
  return filas.map((fila) => {
    const workUri = fila.work ? fila.work.value : null;
    const celex = workUri ? (workUri.match(/celex\/([^/]+)/) || [])[1] : null;
    return {
      pais: "Union Europea",
      titulo: fila.title ? fila.title.value : "Norma sin titulo",
      url: celex ? "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:" + celex : workUri,
      fecha: null,
      resumen: null,
      relevancia: null,
    };
  });
}

// --- Conector real: Oireachtas (parlamento de Irlanda, api.oireachtas.ie) ---
async function buscarIrlanda(q) {
  const url = "https://api.oireachtas.ie/v1/legislation?bill_title=" + encodeURIComponent(q) + "&limit=8";
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API Oireachtas " + r.status);
  const data = await r.json();
  const resultados = (data && data.results) || [];
  return resultados.map((it) => {
    const b = it.bill || {};
    const version = (b.versions && b.versions[0] && b.versions[0].version) || {};
    return {
      pais: "Irlanda",
      titulo: (b.shortTitleEn || "Proyecto de ley sin titulo") + (b.billNo ? " (" + b.billNo + "/" + b.billYear + ")" : ""),
      url: version.formats && version.formats.pdf ? version.formats.pdf.uri : (b.uri || null),
      fecha: b.contextDate || null,
      resumen: b.longTitleEn ? b.longTitleEn.replace(/<[^>]+>/g, "").slice(0, 220) : null,
      relevancia: null,
    };
  });
}

// --- Conector real: CKAN (patron estandar de datos abiertos, usado por
// Colombia, Panama y muchos otros gobiernos con el mismo formato) ---
async function buscarCKAN(q, pais, baseUrl) {
  const url = baseUrl + "/api/3/action/package_search?q=" + encodeURIComponent(q) + "&rows=8";
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API CKAN " + pais + " " + r.status);
  const data = await r.json();
  const items = (data && data.result && data.result.results) || [];
  return items.map((it) => ({
    pais,
    titulo: it.title || "Conjunto de datos sin titulo",
    url: baseUrl + "/dataset/" + it.name,
    fecha: it.metadata_modified ? it.metadata_modified.slice(0, 10) : null,
    resumen: it.notes ? it.notes.replace(/\s+/g, " ").slice(0, 200) : null,
    relevancia: null,
  }));
}

// --- Conector real: Tweede Kamer (parlamento de Paises Bajos, OData) ---
async function buscarPaisesBajos(q) {
  const url = "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Document?$filter=" +
    encodeURIComponent("contains(Onderwerp,'" + q.replace(/'/g, "") + "')") + "&$top=8";
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API Tweede Kamer " + r.status);
  const data = await r.json();
  const items = (data && data.value) || [];
  return items.map((it) => ({
    pais: "Paises Bajos",
    titulo: it.Onderwerp || it.Titel || "Documento sin titulo",
    url: it.Id ? "https://www.tweedekamer.nl/kamerstukken/detail?id=" + it.Id : null,
    fecha: it.Datum ? it.Datum.slice(0, 10) : null,
    resumen: null,
    relevancia: null,
  }));
}

// --- Conector real: Riksdagen (parlamento de Suecia) ---
async function buscarSuecia(q) {
  const url = "https://data.riksdagen.se/dokumentlista/?sok=" + encodeURIComponent(q) + "&utformat=json&sz=8";
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API Riksdagen " + r.status);
  const data = await r.json();
  const items = (data && data.dokumentlista && data.dokumentlista.dokument) || [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.filter(Boolean).map((it) => ({
    pais: "Suecia",
    titulo: it.titel || it.sokdata_titel || "Documento sin titulo",
    url: it.dokument_url_html || it.dokumentstatus_url_xml || null,
    fecha: it.datum ? it.datum.slice(0, 10) : null,
    resumen: it.summary || null,
    relevancia: null,
  }));
}

// --- Conector real: Retsinformation.dk (Dinamarca, REST v2) ---
async function buscarDinamarca(q) {
  const url = "https://api.retsinformation.dk/v2/documents?q=" + encodeURIComponent(q) + "&limit=8";
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API Retsinformation " + r.status);
  const data = await r.json();
  const items = (data && (data.items || data.documents || data.results)) || [];
  return items.map((it) => ({
    pais: "Dinamarca",
    titulo: it.title || it.titel || "Norma sin titulo",
    url: it.htmlUrl || it.url || (it.id ? "https://www.retsinformation.dk/eli/lta/" + it.id : null),
    fecha: (it.publicationDate || it.dato || "").slice(0, 10) || null,
    resumen: null,
    relevancia: null,
  }));
}

// --- Conector real: OpenParlData (Suiza, REST) ---
async function buscarSuiza(q) {
  const url = "https://api.openparldata.ch/v1/documents?search=" + encodeURIComponent(q) + "&limit=8";
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API OpenParlData Suiza " + r.status);
  const data = await r.json();
  const items = (data && (data.data || data.results || data.documents)) || [];
  return items.map((it) => ({
    pais: "Suiza",
    titulo: it.title || it.titel || it.titre || "Documento sin titulo",
    url: it.url || it.link || null,
    fecha: (it.date || it.datum || "").slice(0, 10) || null,
    resumen: null,
    relevancia: null,
  }));
}

// --- Conector real: New Zealand Legislation (REST OpenAPI v0) ---
async function buscarNuevaZelanda(q) {
  const url = "https://api.legislation.govt.nz/v0/legislation.json?search=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API legislation.govt.nz " + r.status);
  const data = await r.json();
  const items = (data && (data.results || data.items)) || [];
  return items.slice(0, 8).map((it) => ({
    pais: "Nueva Zelanda",
    titulo: it.title || it.Title || "Norma sin titulo",
    url: it.link || it.Link || null,
    fecha: (it.pubDate || it.date || "").slice(0, 10) || null,
    resumen: null,
    relevancia: null,
  }));
}

// --- Conector real: Justice Laws Website (Canada, OData) ---
async function buscarCanada(q) {
  const filtro = "contains(ShortTitle,'" + q.replace(/'/g, "") + "') or contains(LongTitle,'" + q.replace(/'/g, "") + "')";
  const url = "https://laws-lois-api.justice.gc.ca/eng/Legislation?$filter=" + encodeURIComponent(filtro) + "&$top=8";
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API Justice Laws Canada " + r.status);
  const data = await r.json();
  const items = (data && data.value) || [];
  return items.map((it) => ({
    pais: "Canada",
    titulo: it.ShortTitle || it.LongTitle || "Norma sin titulo",
    url: it.ConsolidatedNumber ? "https://laws-lois.justice.gc.ca/eng/acts/" + it.ConsolidatedNumber : null,
    fecha: (it.LastAmendedDate || "").slice(0, 10) || null,
    resumen: null,
    relevancia: null,
  }));
}

// --- Conector real: Sejm/ELI API (Polonia, REST, verificado en vivo) ---
async function buscarPolonia(q) {
  const url = "https://api.sejm.gov.pl/eli/acts/search?title=" + encodeURIComponent(q) + "&limit=8";
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API Sejm/ELI Polonia " + r.status);
  const data = await r.json();
  const items = (data && data.items) || [];
  return items.map((it) => ({
    pais: "Polonia",
    titulo: it.title || "Norma sin titulo",
    url: it.ELI ? "https://api.sejm.gov.pl/eli/acts/" + it.ELI + "/text.pdf" : (it.address ? "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=" + it.address : null),
    fecha: it.promulgation || it.announcementDate || null,
    resumen: it.type ? it.type + (it.status ? " - " + it.status : "") : null,
    relevancia: null,
  }));
}

// --- Conector real: e-Gov Law API v1 (Japon), formato JSON confirmado
// por documentacion oficial (LawNumbers[].LawName/LawId/PromulgationDate) ---
async function buscarJapon(q) {
  const url = "https://laws.e-gov.go.jp/api/1/keyword?keyword=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API e-Gov Japon " + r.status);
  const data = await r.json();
  const items = (data && data.LawNumbers) || [];
  return items.slice(0, 8).map((it) => ({
    pais: "Japon",
    titulo: it.LawName || "Norma sin titulo",
    url: it.LawId ? "https://laws.e-gov.go.jp/law/" + it.LawId : null,
    fecha: formatearFechaJapon(it.PromulgationDate),
    resumen: it.LawNo || null,
    relevancia: null,
  }));
}

// --- Conector real: Knesset OData (Israel, KNS_Bill, sin llave) ---
async function buscarIsrael(q) {
  const termino = q.replace(/'/g, "");
  const filtro = "substringof('" + termino + "',Name)";
  const url = "https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_Bill?$filter=" +
    encodeURIComponent(filtro) + "&$top=8&$format=json";
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API Knesset Israel " + r.status);
  const data = await r.json();
  const items = (data && data.value) || (data && data.d && data.d.results) || [];
  return items.map((it) => ({
    pais: "Israel",
    titulo: it.Name || "Proyecto de ley sin titulo",
    url: it.BillID ? "https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=lawsuggestionssearch&lawitemid=" + it.BillID : null,
    fecha: it.PublicationDate ? String(it.PublicationDate).slice(0, 10) : (it.LastUpdatedDate ? String(it.LastUpdatedDate).slice(0, 10) : null),
    resumen: it.SubTypeDesc || null,
    relevancia: null,
  }));
}

// --- Conector real: Stortinget (Noruega, data.stortinget.no) - la API no
// tiene busqueda de texto en el servidor, asi que se trae la lista de
// "saker" (proyectos/casos) de la sesion actual y se filtra por palabra
// clave del lado del conector, sobre datos 100% reales. ---
async function buscarNoruega(q) {
  const sesiones = sesionesStortingCandidatas();
  const termino = q.toLowerCase();
  for (const sesionid of sesiones) {
    const url = "https://data.stortinget.no/eksport/saker?sesjonid=" + sesionid + "&format=json";
    let r;
    try {
      r = await fetch(url, { headers: { accept: "application/json" } });
    } catch (e) {
      continue;
    }
    if (!r.ok) continue;
    const data = await r.json();
    const items = (data && (data.saker_liste || data.saker || data)) || [];
    const arr = Array.isArray(items) ? items : [];
    if (!arr.length) continue;
    const coincidencias = arr.filter((it) =>
      ((it.tittel || "") + " " + (it.korttittel || "")).toLowerCase().includes(termino)
    );
    if (!coincidencias.length) continue;
    return coincidencias.slice(0, 8).map((it) => ({
      pais: "Noruega",
      titulo: it.korttittel || it.tittel || "Sak sin titulo",
      url: it.id ? "https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=" + it.id : null,
      fecha: parsearFechaStorting(it.sist_oppdatert_dato),
      resumen: it.status || null,
      relevancia: null,
    }));
  }
  return [];
}

function sesionesStortingCandidatas() {
  const hoy = new Date();
  const anio = hoy.getUTCFullYear();
  const mes = hoy.getUTCMonth() + 1;
  const inicio = mes >= 8 ? anio : anio - 1;
  return [inicio + "-" + (inicio + 1), (inicio - 1) + "-" + inicio];
}

function parsearFechaStorting(s) {
  if (!s) return null;
  const m = String(s).match(/\/Date\((\d+)/);
  if (!m) return null;
  return new Date(Number(m[1])).toISOString().slice(0, 10);
}

// --- Conector real: BOE - Agencia Estatal Boletin Oficial del Estado
// (España), API de legislacion consolidada, oficial, sin llave, con
// busqueda de texto libre en el parametro "query". ---
async function buscarEspana(q) {
  const url = "https://www.boe.es/datosabiertos/api/legislacion-consolidada?query=" +
    encodeURIComponent(q) + "&limit=8";
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("API BOE " + r.status);
  const data = await r.json();
  const items = (data && data.data && (data.data.legislacion_consolidada || data.data)) || (data && data.results) || [];
  const arr = Array.isArray(items) ? items : (Array.isArray(data) ? data : []);
  return arr.slice(0, 8).map((it) => ({
    pais: "España",
    titulo: it.titulo || it.identificador || "Norma sin titulo",
    url: it.url_html_consolidada || it.url_eli || (it.identificador ? "https://www.boe.es/buscar/act.php?id=" + it.identificador : null),
    fecha: it.fecha_actualizacion || it.fecha_publicacion || null,
    resumen: it.rango || null,
    relevancia: null,
  }));
}

// --- Conector real: Legilux (Luxemburgo), SPARQL publico sobre la
// ontologia JOLux, mismo patron que el conector de la Union Europea. ---
async function buscarLuxemburgo(q) {
  const termino = q.toLowerCase().replace(/"/g, "");
  const sparql =
    "PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>\n" +
    "SELECT DISTINCT ?act ?title WHERE {\n" +
    "  ?expr jolux:title ?title .\n" +
    "  ?act jolux:isRealizedBy ?expr .\n" +
    "  FILTER(CONTAINS(LCASE(STR(?title)), \"" + termino + "\"))\n" +
    "} LIMIT 8";
  const url = "https://data.legilux.public.lu/sparql?format=json&query=" + encodeURIComponent(sparql);
  const r = await fetch(url, { headers: { accept: "application/sparql-results+json" } });
  if (!r.ok) throw new Error("Legilux SPARQL " + r.status);
  const data = await r.json();
  const filas = (data && data.results && data.results.bindings) || [];
  return filas.map((fila) => ({
    pais: "Luxemburgo",
    titulo: fila.title ? fila.title.value : "Norma sin titulo",
    url: fila.act ? fila.act.value : null,
    fecha: null,
    resumen: null,
    relevancia: null,
  }));
}

// --- Conector real: RIS-OGDService (Austria), SOAP oficial sin llave
// (data.bka.gv.at/ris/OGDService.asmx), documentado en el manual tecnico
// oficial del RIS. Busca por Suchworte (texto libre) en Bundesrecht
// consolidado. La respuesta viene como XML doblemente escapado dentro
// del sobre SOAP, se desescapa y parsea con expresiones regulares. ---
async function buscarAustria(q) {
  const termino = escaparXml(q);
  const innerXml =
    '<OGDSearchRequest xmlns="http://ris.bka.gv.at/Search/1.3/OGD" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<Suchworte xsi:type="PhraseSearchExpression"><Value>' + termino + "</Value></Suchworte>" +
    "<DokumenteProSeite>Ten</DokumenteProSeite><Seitennummer>1</Seitennummer>" +
    "</OGDSearchRequest>";
  const soapBody =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    "<soap:Body><request xmlns=\"http://ogd.bka.gv.at/\"><application>Br</application><query>" +
    escaparXml(innerXml) + "</query></request></soap:Body></soap:Envelope>";

  const r = await fetch("http://data.bka.gv.at/ris/OGDService.asmx", {
    method: "POST",
    headers: {
      "content-type": "text/xml; charset=utf-8",
      soapaction: "http://ogd.bka.gv.at/request",
    },
    body: soapBody,
  });
  if (!r.ok) throw new Error("API RIS Austria " + r.status);
  let xml = await r.text();
  xml = desescaparXml(xml);
  const bloques = xml.split("<OGDDocumentReference>").slice(1).slice(0, 8);
  return bloques.map((frag) => {
    const titulo = (frag.match(/<Kurzinformation>([\s\S]*?)<\/Kurzinformation>/) || [])[1] || "Norma sin titulo";
    const url = (frag.match(/<DokumentUrl>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/DokumentUrl>/) || [])[1] || null;
    const parte = (frag.match(/<ArtikelParagraphAnlage>([\s\S]*?)<\/ArtikelParagraphAnlage>/) || [])[1] || null;
    return {
      pais: "Austria",
      titulo,
      url,
      fecha: null,
      resumen: parte,
      relevancia: null,
    };
  });
}

function escaparXml(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function desescaparXml(s) {
  return (s || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function formatearFechaJapon(s) {
  if (!s || s.length !== 8) return null;
  return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
}

function decodificarEntidades(s) {
  return (s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function normalizar(t) {
  return (t || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// --- Groq: analisis del catalogo para paises sin conector real ---
async function analizarConGroq(q, fuentesLista) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { resultados: [], error: "Falta GROQ_API_KEY en variables de entorno de Netlify." };

  const listaFuentesTexto = fuentesLista.map((f, i) =>
    (i + 1) + ". Pais: " + f.pais + " | Fuente: " + (f.fuente || "s/d") +
    " | Tipo de normas que cubre: " + (f.tipo || "s/d") +
    " | URL: " + (f.url || "s/d")
  ).join("\n");

  const prompt = "Eres un asistente de investigacion juridica para una biblioteca parlamentaria. " +
    "Un analista quiere investigar: \"" + q + "\". " +
    "A continuacion tienes el catalogo de fuentes oficiales de legislacion disponibles para los paises consultados. " +
    "IMPORTANTE: no inventes el titulo de ninguna ley especifica que no este listada aqui explicitamente; solo tienes el " +
    "nombre del PORTAL/fuente oficial, no el texto de las normas. Para cada fuente de la lista, escribe una nota breve " +
    "(1-2 oraciones, en espanol, tono tecnico y cauteloso) explicando que tipo de norma relacionada con la consulta " +
    "el analista deberia buscar en ese portal especifico, basandote en el tipo de fuente indicado. Si el tipo de fuente " +
    "no parece relacionado con la consulta, dilo explicitamente en vez de forzar una relacion.\n\n" +
    "Fuentes:\n" + listaFuentesTexto + "\n\n" +
    "Ademas, para cada fuente estima que tan relevante es su tipo de norma para la consulta, como numero entero de 0 a 100 " +
    "(100 = muy relevante, 0 = nada relevante). Es una estimacion tuya basada solo en el tipo de fuente, no una metrica exacta. " +
    "Responde UNICAMENTE con un bloque de codigo JSON (sin texto antes ni despues), un elemento por cada fuente listada, " +
    "en el mismo orden, con este formato exacto: " +
    "[{\"pais\": \"nombre del pais\", \"titulo\": \"nombre de la fuente oficial (copialo tal cual)\", \"url\": \"la URL indicada\", \"resumen\": \"tu nota de 1-2 oraciones\", \"relevancia\": 85}]";

  try {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const body = JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2500,
      temperature: 0.3,
    });

    let r;
    let intentos = 0;
    const maxIntentos = 3;
    while (true) {
      intentos++;
      r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + apiKey },
        body,
      });
      if (r.status !== 429 || intentos >= maxIntentos) break;
      await new Promise((resolve) => setTimeout(resolve, 1500 * intentos));
    }

    if (!r.ok) {
      const t = await r.text();
      if (r.status === 429) {
        return { resultados: [], error: "Se alcanzo el limite de uso gratuito de Groq por ahora.", tipoError: "quota" };
      }
      return { resultados: [], error: "Groq API " + r.status + ": " + t.slice(0, 300), tipoError: "error" };
    }

    const data = await r.json();
    let texto = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    texto = texto.trim();
    const bloqueJson = texto.match(/```json\s*([\s\S]*?)```/i) || texto.match(/(\[[\s\S]*\])\s*$/);
    if (bloqueJson) texto = bloqueJson[1].trim();
    texto = texto.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "").trim();

    let resultados = [];
    try {
      resultados = JSON.parse(texto);
      if (!Array.isArray(resultados)) resultados = [];
    } catch (e) {
      return { resultados: [], error: "No se pudo interpretar la respuesta de Groq como JSON: " + e.message, tipoError: "error" };
    }

    resultados = resultados
      .filter((it) => it && it.titulo && it.pais)
      .map((it) => ({
        pais: it.pais,
        titulo: it.titulo,
        url: it.url || null,
        fecha: null,
        resumen: it.resumen || null,
        relevancia: Number.isFinite(it.relevancia) ? Math.max(0, Math.min(100, Math.round(it.relevancia))) : null,
      }))
      .sort((a, b) => (b.relevancia || 0) - (a.relevancia || 0));

    return { resultados };
  } catch (e) {
    return { resultados: [], error: e.message, tipoError: "error" };
  }
}

function cors() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
}
