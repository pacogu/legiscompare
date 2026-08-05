// LegisCompare - directorio de fuentes oficiales de legislacion comparada.
// Ya no depende de una API de IA para la busqueda base: usa un catalogo
// curado (site/data/fuentes_oficiales.json) con la fuente oficial, URL y
// datos de API de cada pais. Esto evita cuotas/limites de proveedores de
// IA y errores 429 en la busqueda principal.

(function () {
  let CATALOGO = null;

  async function cargarCatalogo() {
    if (CATALOGO) return CATALOGO;
    const res = await fetch("data/fuentes_oficiales.json");
    if (!res.ok) throw new Error("No se pudo cargar el catalogo de fuentes oficiales.");
    CATALOGO = await res.json();
    return CATALOGO;
  }

  function normalizar(t) {
    return (t || "").toString().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  async function ejecutarBusquedaExterna(consulta, paisesSeleccionados) {
    const catalogo = await cargarCatalogo();
    const paisesSet = new Set((paisesSeleccionados || []).map((p) => normalizar(p)));
    const consultaNorm = normalizar(consulta);
    const terminos = consultaNorm.split(/\s+/).filter((t) => t.length > 2);

    let candidatos = catalogo.filter((r) => !paisesSet.size || paisesSet.has(normalizar(r.pais)));

    // Si hay terminos de busqueda, prioriza fuentes cuyo tipo/nombre/notas
    // los mencionen; si ninguna coincide, se muestra igual el directorio
    // completo de fuentes oficiales de los paises seleccionados.
    if (terminos.length) {
      const conCoincidencia = candidatos.filter((r) => {
        const texto = normalizar([r.fuente, r.tipo, r.notas].join(" "));
        return terminos.some((t) => texto.includes(t));
      });
      if (conCoincidencia.length) candidatos = conCoincidencia;
    }

    const resultados = candidatos.slice(0, 30).map((r) => {
      const partesResumen = [];
      if (r.tipo) partesResumen.push(r.tipo);
      if (r.nivel) partesResumen.push("Nivel: " + r.nivel);
      if (r.tiene_api) partesResumen.push("API: " + r.tiene_api);
      return {
        pais: r.pais,
        titulo: r.fuente || (r.pais + " - fuente oficial"),
        url: r.url || r.api_url || null,
        fecha: null,
        resumen: partesResumen.join(" · "),
        api_url: r.api_url || null,
        api_docs: r.api_docs || null,
        api_params: r.api_params || null,
        formato: r.formato || null,
      };
    });

    const errores = [];
    if (!resultados.length) {
      errores.push("No hay fuentes oficiales registradas para ese filtro todavia. Prueba con otro pais.");
    }

    return { resultados, errores };
  }

  window.IJARBusquedaExterna = { ejecutarBusquedaExterna };
})();
