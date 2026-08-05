// LegisCompare - busqueda en vivo de legislacion comparada.
// El nombre real de la norma se obtiene con Claude (Anthropic) + web_search,
// usando como contexto el catalogo curado de fuentes oficiales
// (site/data/fuentes_oficiales.json) para orientar la busqueda hacia el
// portal oficial correcto de cada pais y evitar traer texto generico.
// Cache de 30 minutos en localStorage para no repetir la misma consulta.

(function () {
  let CATALOGO = null;

  async function cargarCatalogo() {
    if (CATALOGO) return CATALOGO;
    try {
      const res = await fetch("data/fuentes_oficiales.json");
      CATALOGO = res.ok ? await res.json() : [];
    } catch (e) {
      CATALOGO = [];
    }
    return CATALOGO;
  }

  function normalizar(t) {
    return (t || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  async function ejecutarBusquedaExterna(query, paises) {
    const cacheKey = "legiscompare_busqueda_" + query.toLowerCase().trim() + "_" + (paises || []).join(",");
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.ts < 30 * 60 * 1000) return cached.data;
    } catch (e) {}

    const catalogo = await cargarCatalogo();
    const paisesSet = new Set((paises || []).map((p) => normalizar(p)));
    const fuentesRelevantes = catalogo
      .filter((r) => !paisesSet.size || paisesSet.has(normalizar(r.pais)))
      .map((r) => ({ pais: r.pais, fuente: r.fuente, url: r.url }));

    const params = new URLSearchParams();
    params.set("q", query);
    if (paises && paises.length) params.set("paises", paises.join(", "));
    if (fuentesRelevantes.length) params.set("fuentes", JSON.stringify(fuentesRelevantes));

    const url = "/.netlify/functions/buscar?" + params.toString();
    const r = await fetch(url);
    const out = await r.json();
    const data = { resultados: out.resultados || [], errores: out.errores || [], tipoError: out.tipoError };
    try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
    return data;
  }

  window.IJARBusquedaExterna = { ejecutarBusquedaExterna };
})();
