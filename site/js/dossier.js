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

function renderFuentesNumeradas(data) {
  return "<ol style='padding-left:20px;font-size:13px;line-height:1.7'>" +
    data.resultados.map((r) =>
      "<li><strong>" + r.pais + "</strong> - " + (r.url ? "<a href='" + r.url + "' target='_blank' rel='noopener'>" + r.titulo + "</a>" : r.titulo) + "</li>"
    ).join("") + "</ol>";
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
  html += "<h3>Fuentes citables (para la seccion de consultas)</h3>" + renderFuentesNumeradas(data);

  document.getElementById("contenido").innerHTML = html;
  document.getElementById("hallazgos").addEventListener("input", guardarHallazgos);

  cargarSintesis(data);
  initChat(data);
}

function renderErrorSintesis(mensaje, data) {
  const box = document.getElementById("sintesisBox");
  const esCuota = /429|quota/i.test(mensaje);
  let texto = "No se pudo generar el borrador con IA: " + mensaje;
  if (esCuota) {
    texto = "Se agoto la cuota gratuita de Groq por ahora. Espera unos minutos (la cuota gratuita se resetea periodicamente).";
  }
  box.innerHTML = "<div class='err'>" + texto + "</div><button class='btn' id='btnReintentarSintesis' style='margin-top:8px'>Reintentar</button>";
  document.getElementById("btnReintentarSintesis").addEventListener("click", () => cargarSintesis(data));
}

function cargarSintesis(data) {
  const box = document.getElementById("sintesisBox");
  box.innerHTML = "<div class='empty'>Generando borrador con IA...</div>";
  pedirSintesisIA(data).then((out) => {
    if (out.error) {
      renderErrorSintesis(out.error, data);
      return;
    }
    box.innerHTML = "<div class='disclaimer'>Borrador generado por IA a partir del analisis de las fuentes oficiales seleccionadas (no del texto completo de las normas). Requiere validacion de un abogado antes de usarse.</div><div style=\"white-space:pre-wrap;font-size:14px;line-height:1.5;background:#fbfdff;border:1px solid var(--line);border-radius:12px;padding:14px\">" + (out.borrador || "Sin contenido generado.") + "</div>";
  });
}

// --- Capa de interaccion: consultas de seguimiento sobre el informe ---
// Mantiene trazabilidad citando [n] segun la lista numerada de fuentes.

function obtenerHistorialChat() {
  try { return JSON.parse(sessionStorage.getItem("legiscompare_chat") || "[]"); } catch (e) { return []; }
}

function guardarHistorialChat(historial) {
  try { sessionStorage.setItem("legiscompare_chat", JSON.stringify(historial)); } catch (e) {}
}

function renderChatLog(historial) {
  const log = document.getElementById("chatLog");
  log.innerHTML = historial.map((h) => {
    const esUsuario = h.rol === "usuario";
    return "<div style='align-self:" + (esUsuario ? "flex-end" : "flex-start") + ";max-width:80%;background:" +
      (esUsuario ? "var(--blue)" : "#f4f6f8") + ";color:" + (esUsuario ? "#fff" : "var(--ink)") +
      ";padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.5;white-space:pre-wrap'>" +
      escaparHtml(h.texto) + "</div>";
  }).join("");
  log.scrollTop = log.scrollHeight;
}

function escaparHtml(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function enviarPreguntaChat(data) {
  const input = document.getElementById("chatInput");
  const btn = document.getElementById("btnChatEnviar");
  const pregunta = input.value.trim();
  if (!pregunta) return;

  let historial = obtenerHistorialChat();
  historial.push({ rol: "usuario", texto: pregunta });
  guardarHistorialChat(historial);
  renderChatLog(historial);
  input.value = "";
  btn.disabled = true; btn.textContent = "Pensando...";

  try {
    const r = await fetch("/.netlify/functions/consultar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ consulta: data.consulta, resultados: data.resultados, pregunta, historial }),
    });
    const out = await r.json();
    historial = obtenerHistorialChat();
    historial.push({ rol: "asistente", texto: out.error ? "No se pudo responder: " + out.error : out.respuesta });
    guardarHistorialChat(historial);
    renderChatLog(historial);
  } catch (e) {
    historial = obtenerHistorialChat();
    historial.push({ rol: "asistente", texto: "Error al consultar: " + e.message });
    guardarHistorialChat(historial);
    renderChatLog(historial);
  }
  btn.disabled = false; btn.textContent = "Preguntar";
}

function initChat(data) {
  document.getElementById("chatCard").style.display = "block";
  const historial = obtenerHistorialChat();
  renderChatLog(historial);
  document.getElementById("btnChatEnviar").addEventListener("click", () => enviarPreguntaChat(data));
  document.getElementById("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") enviarPreguntaChat(data);
  });
}

function init() {
  let data = null;
  try { data = JSON.parse(sessionStorage.getItem("legiscompare_brief") || "null"); } catch (e) {}
  sessionStorage.removeItem("legiscompare_chat");
  render(data);
  document.getElementById("btnImprimir").addEventListener("click", () => window.print());
}

document.addEventListener("DOMContentLoaded", init);
