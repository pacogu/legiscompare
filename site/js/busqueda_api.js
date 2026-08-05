// LegisCompare - busqueda en vivo de legislacion comparada.
// 1) Intenta obtener el nombre real de la norma con Gemini + Google
//    Search (gratis, sin tarjeta), usando el catalogo de fuentes
//    oficiales como contexto/pistas de busqueda.
// 2) Si Gemini falla o se queda sin cuota del dia, cae automaticamente
//    al catalogo local (site/data/fuentes_oficiales.json): muestra el
//    portal oficial de cada pais para que el usuario busque ahi
//    directamente, en vez de dejar la busqueda sin resultado.
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

  async function buscarEnCatalogo(query, paises) {
    const catalogo = await cargarCatalogo();
    const paisesSet = new Set((paises || []).map((p) => normalizar(p)));
    const terminos = normalizar(query).split(/\s+/).filter((t) => t.length > 2);

    let candidatos = catalogo.filter((r) => !paisesSet.size || paisesSet.has(normalizar(r.pais)));
    if (terminos.length) {
      const conCoincidencia = candidatos.filter((r) => {
        const texto = normalizar([r.fuente, r.tipo, r.notas].join(" "));
        return terminos.some((t) => texto.includes(t));
      });
      if (conCoincidencia.length) candidatos = conCoincidencia;
    }

    const resultados = candidatos.slice(0, 20).map((r) => {
      const partesResumen = [];
      if (r.tipo) partesResumen.push(r.tipo);
      if (r.nivel) partesResumen.push("Nivel: " + r.nivel);
      return {
        pais: r.pais,
        titulo: r.fuente || (r.pais + " - fuente oficial"),
        url: r.url || r.api_url || null,
        fecha: null,
        resumen: partesResumen.join(" · "),
        esDirectorio: true,
      };
    });
    return resultados;
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

    let data;
    try {
      const r = await fetch("/.netlify/functions/buscar?" + params.toString());
      const out = await r.json();
      data = { resultados: out.resultados || [], errores: out.errores || [], tipoError: out.tipoError };
    } catch (e) {
      data = { resultados: [], errores: [e.message], tipoError: "error" };
    }

    // Si Gemini no devolvio resultados (cuota, error o clave faltante),
    // cae al directorio local para que la busqueda nunca quede vacia.
    if (!data.resultados.length) {
      const directorio = await buscarEnCatalogo(query, paises);
      if (directorio.length) {
        data = {
          resultados: directorio,
          errores: data.errores && data.errores.length
            ? [data.errores[0] + " Mostrando el directorio de fuentes oficiales en su lugar."]
            : [],
          tipoError: data.tipoError,
          modo: "directorio",
        };
      }
    }

    try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
    return data;
  }

  window.IJARBusquedaExterna = { ejecutarBusquedaExterna };
})();
