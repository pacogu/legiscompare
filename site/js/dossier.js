// LegisCompare - dossier construido 100% a partir de los resultados en vivo
// de la ultima busqueda (sin catalogo curado, sin fallback).

function agruparPorPais(resultados) {
  const grupos = {};
  resultados.forEach((r) => {
    if (!grupos[r.pais]) grupos[r.pais] = [];
    grupos[r.pais].push(r);
  });
  return grupos;
}

function render(data) {
  if (!data || !data.resultados || !data.resultados.length) {
    document.getElementById("contenido").innerHTML = "<div class='empty'>No hay resultados en vivo guardados. Vuelve a la consulta y ejecuta una busqueda primero.</div>";
    document.getElementById("consultaTitulo").textContent = "";
    return;
  }
  document.getElementById("consultaTitulo").textContent = data.consulta;

  const grupos = agruparPorPais(data.resultados);
  let html = "<div class='disclaimer'>Este dossier se genero en vivo el " + data.fecha + " a partir de fuentes oficiales. Es informativo, no constituye asesoria legal. Verifica siempre la vigencia de cada norma en la fuente original.</div>";

  html += "<table class='matriz-table'><thead><tr><th>Pais</th><th>Resultado</th><th>Fuente</th></tr></thead><tbody>";
  Object.keys(grupos).forEach((pais) => {
    grupos[pais].forEach((r, i) => {
      html += "<tr><td class='pais-col'>" + (i === 0 ? pais : "") + "</td><td><a href='" + r.url + "' target='_blank' rel='noopener'>" + r.titulo + "</a></td><td>API en vivo</td></tr>";
    });
  });
  html += "</tbody></table>";

  document.getElementById("contenido").innerHTML = html;
}

function init() {
  let data = null;
  try { data = JSON.parse(sessionStorage.getItem("legiscompare_resultados") || "null"); } catch (e) {}
  render(data);
}

document.addEventListener("DOMContentLoaded", init);
