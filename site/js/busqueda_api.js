// Cliente de busqueda: llama al proxy serverless que usa Gemini con Google
// Search grounding para encontrar legislacion real de cualquier pais.
// Cache de 30 minutos en localStorage para no repetir la misma consulta.
(function () {
  async function ejecutarBusquedaExterna(query, paises) {
    const cacheKey = "legiscompare_busqueda_" + query.toLowerCase().trim() + "_" + (paises || []).join(",");
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.ts < 30 * 60 * 1000) return cached.data;
    } catch (e) {}

    const url = "/.netlify/functions/buscar?q=" + encodeURIComponent(query) + (paises && paises.length ? "&paises=" + encodeURIComponent(paises.join(", ")) : "");
    const r = await fetch(url);
    const out = await r.json();
    const data = { resultados: out.resultados || [], errores: out.errores || [] };
    try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
    return data;
  }

  window.IJARBusquedaExterna = { ejecutarBusquedaExterna };
})();
