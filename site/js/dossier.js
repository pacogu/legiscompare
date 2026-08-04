// LegisCompare - informe analitico preliminar. Organiza en vivo:
// matriz comparada + timeline + ejes seleccionados. Los hallazgos e
// implicancias los escribe el abogado: la IA no interpreta ni concluye.

function agruparPorPais(resultados) {
  const grupos = {};
  resultados.forEach((r) => {
    if (!grupos[r.pais]) grupos[r.pais] = [];
    grupos[r.pais].push(r);
  });
  return grupos;
}

function renderMatriz(data) {
  const grupos = agruparPorPais(data.resultados);
  let html = "<table class='matriz-table'><thead><tr><th>Jurisdiccion</th><th>Fuente encontrada</th></tr></thead><tbody>";
  data.jurisdicciones.forEach((pais) => {
    const items = grupos[pais] || [];
    if (!items.length) {
      html += "<tr><td class='pais-col'>" + pais + "</td><td class='nota'>Sin resultados en vivo para esta consulta.</td></tr>";
    } else {
      items.forEach((r, i) => {
        html += "<tr><td class='pais-col'>" + (i === 0 ? pais : "") + "</td><td><a href='" + r.url + "' target='_blank' rel='noopener'>" + r.titulo + "</a></td></tr>";
      });
    }
  });
  html += "</tbody></table>";
  return html;
}

function renderTimeline(data) {
  const conFecha = data.resultados.filter((r) => r.fecha).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const sinFecha = data.resultados.filter((r) => !r.fecha);
  let html = "";
  if (!conFecha.length) {
    html += "<div class='empty'>Ninguna fuente en vivo trajo fecha estructurada para armar el timeline.</div>";
  } else {
    conFecha.forEach((r) => {
      html += "<div class='timeline-item'><span class='fecha'>" + r.fecha + "</span><strong>" + r.pais + "</strong> - <a href='" + r.url + "' target='_blank' rel='noopener'>" + r.titulo + "</a></div>";
    });
  }
  if (sinFecha.length) {
    html += "<p class='nota' style='margin-top:8px'>" + sinFecha.length + " fuente(s) sin fecha estructurada disponible en la API.</p>";
  }
  return html;
}

function renderEjes(data) {
  if (!data.ejes.length) return "<p class='nota'>No se seleccionaron ejes juridicos especificos.</p>";
  return data.ejes.map((e) => "<span class='axis-chip'>" + e + "</span>").join("");
}

function guardarHallazgos() {
  const texto = document.getElementById("hallazgos").value;
  try {
    const data = JSON.parse(sessionStorage.getItem("legiscompare_brief") || "{}");
    data.hallazgos = texto;
    sessionStorage.setItem("legiscompare_brief", JSON.stringify(data));
  } catch (e) {}
}

async function pedirSintesisIA(data) {
  try {
    const r = await fetch("/.netlify/functions/sintetizar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ consulta: data.consulta, ejes: data.ejes, resultados: data.resultados }),
    });
    const out = await r.json();
    return out;
  } catch (e) {
    return { error: e.message };
  }
}

function render(data) {
  if (!data || !data.resultados || !data.resultados.length) {
    document.getElementById("contenido").innerHTML = "<div class='empty'>No hay resultados en vivo guardados. Vuelve a la consulta y ejecuta una busqueda primero.</div>";
    return;
  }
  document.getElementById("consultaTitulo").textContent = data.consulta;

  let html = "<div class='disclaimer'>Informe analitico preliminar generado en vivo el " + data.fechaConsulta + ". No constituye el informe final ni asesoria legal: prepara el terreno para que el abogado interprete, seleccione y redacte.</div>";

  html += "<h3>Ejes juridicos seleccionados</h3><div>" + renderEjes(data) + "</div>";
  html += "<h3>Matriz comparada</h3>" + renderMatriz(data);
  html += "<h3>Timeline normativo</h3>" + renderTimeline(data);
  html += "<h3>Sintesis comparada (borrador IA)</h3>";
  html += "<div id='sintesisBox'><div class='empty'>Generando borrador con IA...</div></div>";
  html += "<h3>Hallazgos e implicancias</h3><p class='note'>Este espacio lo completa el abogado a cargo del analisis. La IA no interpreta ni concluye por ti.</p>";
  html += "<textarea class='hallazgos' id='hallazgos' placeholder='Escribe aqui los hallazgos, diferencias, vacios e implicancias (ej. para Chile)...'>" + (data.hallazgos || "") + "</textarea>";

  document.getElementById("contenido").innerHTML = html;
  document.getElementById("hallazgos").addEventListener("input", guardarHallazgos);

  pedirSintesisIA(data).then((out) => {
    const box = document.getElementById("sintesisBox");
    if (out.error) {
      box.innerHTML = "<div class='err'>No se pudo generar el borrador con IA: " + out.error + "</div>";
      return;
    }
    box.innerHTML = "<div class='disclaimer'>Borrador generado por IA a partir solo de los titulos y metadatos encontrados. Requiere validacion de un abogado antes de usarse; puede omitir matices del texto legal completo.</div><div style=\"white-space:pre-wrap;font-size:14px;line-height:1.5;background:#fbfdff;border:1px solid var(--line);border-radius:12px;padding:14px\">" + (out.borrador || "Sin contenido generado.") + "</div>";
  });
}

function init() {
  let data = null;
  try { data = JSON.parse(sessionStorage.getItem("legiscompare_brief") || "null"); } catch (e) {}
  render(data);
  document.getElementById("btnImprimir").addEventListener("click", () => window.print());
}

document.addEventListener("DOMContentLoaded", init);
