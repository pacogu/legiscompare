/* Busqueda en vivo contra APIs publicas de legislacion.
   Ruta principal: proxy serverless /.netlify/functions/buscar (evita CORS
   y protege la API key de Congress.gov). Si no hay funciones disponibles
   (deploy estatico puro sin Netlify), se intenta un fallback directo desde
   el navegador solo para las fuentes que no requieren clave (BOE, LexML,
   Reino Unido); EE.UU. y UE necesitan el proxy.
   Chile (BCN) y Alemania no tienen API publica de busqueda por palabra
   clave sin registro: para esos paises se mantiene la matriz curada. */
(function () {
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
    }));
  }

  async function buscarLexML(q) {
    const url = "https://www.lexml.gov.br/busca/SRU?operation=searchRetrieve&query=" + encodeURIComponent(q) + "&maximumRecords=5";
    const r = await fetch(url);
    if (!r.ok) throw new Error("LexML " + r.status);
    const text = await r.text();
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const records = Array.from(doc.getElementsByTagNameNS("*", "identifier"));
    return records.slice(0, 5).map((n) => ({ pais: "Brasil", titulo: n.textContent, url: n.textContent }));
  }

  async function buscarUK(q) {
    const url = "https://www.legislation.gov.uk/all/data.feed?text=" + encodeURIComponent(q);
    const r = await fetch(url, { headers: { Accept: "application/atom+xml" } });
    if (!r.ok) throw new Error("UK " + r.status);
    const text = await r.text();
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const entries = Array.from(doc.getElementsByTagNameNS("*", "entry")).slice(0, 5);
    return entries.map((e) => {
      const title = e.getElementsByTagNameNS("*", "title")[0];
      const link = e.getElementsByTagNameNS("*", "link")[0];
      return { pais: "Reino Unido", titulo: title ? title.textContent : "Norma UK", url: link ? link.getAttribute("href") : "https://www.legislation.gov.uk/" };
    });
  }

  async function buscarProxy(q) {
    const r = await fetch("/.netlify/functions/buscar?q=" + encodeURIComponent(q));
    if (!r.ok) throw new Error("proxy " + r.status);
    return await r.json();
  }

  async function ejecutarBusquedaExterna(query) {
    const cacheKey = "ijar_busqueda_" + query.toLowerCase().trim();
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.ts < 30 * 60 * 1000) return cached.data;
    } catch (e) {}
    try {
      const proxyResult = await buscarProxy(query);
      const out = { resultados: proxyResult.resultados || [], errores: proxyResult.errores || [] };
      try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: out })); } catch (e) {}
      return out;
    } catch (e) {
      // Sin funcion serverless disponible: fallback directo (sin EE.UU./UE, que requieren proxy).
    }
    const resultados = [];
    const errores = ["Sin proxy serverless activo: EE.UU. (Congress.gov) y UE (EUR-Lex) no disponibles en este modo. Despliega con Netlify Functions para habilitarlos."];
    const intentos = [
      ["Espana (BOE)", buscarBOE],
      ["Brasil (LexML)", buscarLexML],
      ["Reino Unido (legislation.gov.uk)", buscarUK],
    ];
    for (const [nombre, fn] of intentos) {
      try {
        const r = await fn(query);
        resultados.push(...r);
      } catch (e) {
        errores.push(nombre + ": bloqueado por el navegador (CORS) o sin resultados.");
      }
    }
    const out = { resultados, errores };
    try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: out })); } catch (e) {}
    return out;
  }

  window.IJARBusquedaExterna = { ejecutarBusquedaExterna };
})();
