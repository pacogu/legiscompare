// LegisCompare - busqueda en vivo de legislacion comparada.
// 1) Filtra el catalogo local de fuentes oficiales (site/data/fuentes_oficiales.json)
//    por pais y coincidencia de palabras con la consulta.
// 2) Envia esas fuentes a Groq (gratis, sin tarjeta) para que redacte, por
//    cada una, una nota breve de que buscar ahi para la consulta - sin
//    inventar el nombre de una ley especifica que no pueda verificar.
// 3) Si Groq falla o se queda sin cuota, cae al directorio simple (solo
//    nombre de la fuente y URL), asi la busqueda nunca queda vacia.
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

  async function seleccionarFuentes(query, paises) {
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
    return candidatos.slice(0, 20);
  }

  function directorioSimple(candidatos) {
    return candidatos.map((r) => {
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
  }

  async function ejecutarBusquedaExterna(query, paises) {
    const cacheKey = "legiscompare_busqueda_" + query.toLowerCase().trim() + "_" + (paises || []).join(",");
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.ts < 30 * 60 * 1000) return cached.data;
    } catch (e) {}

    const candidatos = await seleccionarFuentes(query, paises);
    if (!candidatos.length) {
      const data = { resultados: [], errores: ["No hay fuentes oficiales registradas para ese filtro. Prueba con otro pais."] };
      return data;
    }

    const fuentesParaAnalisis = candidatos.map((r) => ({ pais: r.pais, fuente: r.fuente, tipo: r.tipo, url: r.url }));
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("fuentes", JSON.stringify(fuentesParaAnalisis));

    let data;
    try {
      const r = await fetch("/.netlify/functions/buscar?" + params.toString());
      const out = await r.json();
      data = { resultados: out.resultados || [], errores: out.errores || [], tipoError: out.tipoError };
    } catch (e) {
      data = { resultados: [], errores: [e.message], tipoError: "error" };
    }

    // Si Groq no devolvio resultados (cuota, error o clave faltante), cae
    // al directorio simple para que la busqueda nunca quede vacia.
    if (!data.resultados.length) {
      const directorio = directorioSimple(candidatos);
      data = {
        resultados: directorio,
        errores: data.errores && data.errores.length
          ? [data.errores[0] + " Mostrando el directorio de fuentes oficiales en su lugar."]
          : [],
        tipoError: data.tipoError,
        modo: "directorio",
      };
    }

    try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
    return data;
  }

  window.IJARBusquedaExterna = { ejecutarBusquedaExterna };
})();
