// LegisCompare - flujo de consulta 100% en vivo, sin datos precargados.
// Cada resultado viene de la API oficial del pais correspondiente en el
// momento de la busqueda. No hay catalogo curado ni fallback estatico.

const PAISES_CUBIERTOS = [
  { nombre: "Espana", fuente: "BOE" },
  { nombre: "Brasil", fuente: "LexML" },
  { nombre: "Reino Unido", fuente: "legislation.gov.uk" },
  { nombre: "Estados Unidos", fuente: "Congress.gov" },
  { nombre: "Union Europea", fuente: "EUR-Lex / CELLAR" },
];
const PAISES_SIN_API = ["Chile", "Alemania"];

const state = { ultimosResultados: [], ultimaConsulta: "" };

function renderCobertura() {
  const box = document.getElementById("cobertura");
  let html = "<div class='pais-grid'>";
  PAISES_CUBIERTOS.forEach((p) => {
    html += "<div class='pais media_alta'><strong>" + p.nombre + "</strong><span>" + p.fuente + "</span></div>";
  });
  PAISES_SIN_API.forEach((n) => {
    html += "<div class='pais'><strong>" + n + "</strong><span>Sin fuente en vivo disponible</span></div>";
  });
  html += "</div>";
  box.innerHTML = html;
}

async function ejecutarBusqueda() {
  const consulta = document.getElementById("consulta").value.trim();
  const estado = document.getElementById("estadoConsulta");
  const btn = document.getElementById("btnBuscarApi");
  const out = document.getElementById("resultadosApi");
  const err = document.getElementById("errApi");
  if (!consulta) { estado.textContent = "Escribe una consulta primero."; return; }

  btn.disabled = true; btn.innerHTML = "<span class='spinner'></span>Buscando en fuentes oficiales...";
  estado.textContent = "Consultando APIs en vivo...";
  estado.className = "status";
  out.innerHTML = ""; err.innerHTML = "";

  const fecha = new Date().toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  try {
    const res = await window.IJARBusquedaExterna.ejecutarBusquedaExterna(consulta);
    state.ultimosResultados = res.resultados || [];
    state.ultimaConsulta = consulta;
    try { sessionStorage.setItem("legiscompare_resultados", JSON.stringify({ consulta, resultados: state.ultimosResultados, fecha })); } catch (e) {}

    if (!res.resultados.length) {
      out.innerHTML = "<div class='empty'>Sin resultados en las fuentes oficiales para esta consulta. Prueba con terminos mas generales o en el idioma del pais (ej. en frances para Francia, en aleman para Alemania).</div>";
      estado.textContent = "Sin resultados en vivo.";
    } else {
      res.resultados.forEach((r) => {
        const d = document.createElement("div");
        d.className = "item api";
        d.innerHTML = "<strong>" + r.pais + "</strong><span class='tag api'>API en vivo</span><br><a href='" + r.url + "' target='_blank' rel='noopener'>" + r.titulo + "</a><span class='meta'>Consultado " + fecha + " - verificar vigencia en la fuente oficial</span>";
        out.appendChild(d);
      });
      estado.textContent = res.resultados.length + " resultado(s) en vivo encontrados.";
      estado.className = "status ok";
    }
    if (res.errores && res.errores.length) err.innerHTML = res.errores.join("<br>");
  } catch (e) {
    err.innerHTML = "Error al consultar fuentes oficiales: " + e.message;
    estado.textContent = "Error en la busqueda.";
  }
  btn.disabled = false; btn.textContent = "Buscar en fuentes oficiales";
}

function abrirDossier() {
  if (!state.ultimosResultados.length) { alert("Ejecuta primero una busqueda con resultados."); return; }
  window.location.href = "dossier.html";
}

function init() {
  renderCobertura();
  document.getElementById("btnBuscarApi").addEventListener("click", ejecutarBusqueda);
  document.getElementById("abrirDossier").addEventListener("click", abrirDossier);
}

document.addEventListener("DOMContentLoaded", init);
