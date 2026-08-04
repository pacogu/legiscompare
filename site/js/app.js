// LegisCompare - flujo alineado a "Comparative Law++" (IFLAPARL 2026):
// 1) Consulta inicial  2) Jurisdicciones y ejes  3) Organizacion comparativa (matriz)
// 4) Timeline  5) Informe analitico preliminar (el abogado redacta el informe final).
// Sin catalogo curado: cada fuente viene en vivo de la API oficial.

const JURISDICCIONES = [
  { nombre: "Espana", fuente: "BOE", disponible: true },
  { nombre: "Brasil", fuente: "LexML", disponible: true },
  { nombre: "Reino Unido", fuente: "legislation.gov.uk", disponible: true },
  { nombre: "Estados Unidos", fuente: "Congress.gov", disponible: true },
  { nombre: "Union Europea", fuente: "EUR-Lex / CELLAR", disponible: true },
  { nombre: "Francia", fuente: "Legifrance (PISTE)", disponible: true },
  { nombre: "Nueva Zelanda", fuente: "legislation.govt.nz", disponible: true },
  { nombre: "Chile", fuente: "sin API en vivo", disponible: false },
  { nombre: "Alemania", fuente: "sin API en vivo", disponible: false },
];

const EJES_SUGERIDOS = [
  "Ambito de aplicacion",
  "Autoridad competente",
  "Derechos de las personas",
  "Sanciones e incumplimiento",
  "Plazos y procedimiento",
  "Transparencia y publicidad",
];

const state = { jurisdiccionesSeleccionadas: new Set(), ejesSeleccionados: new Set(), resultados: [] };

function renderJurisdicciones() {
  const box = document.getElementById("jurisdicciones");
  box.innerHTML = "";
  JURISDICCIONES.forEach((j) => {
    const label = document.createElement("label");
    label.className = "eje" + (j.disponible ? "" : " deshabilitado");
    label.innerHTML = "<input type='checkbox' " + (j.disponible ? "" : "disabled") + "><span class='eje-title'>" + j.nombre + "</span><span class='eje-text'>" + j.fuente + "</span>";
    const input = label.querySelector("input");
    if (j.disponible) {
      input.checked = true;
      state.jurisdiccionesSeleccionadas.add(j.nombre);
      label.classList.add("selected");
      input.addEventListener("change", (e) => {
        if (e.target.checked) { state.jurisdiccionesSeleccionadas.add(j.nombre); label.classList.add("selected"); }
        else { state.jurisdiccionesSeleccionadas.delete(j.nombre); label.classList.remove("selected"); }
      });
    }
    box.appendChild(label);
  });
}

function renderEjes() {
  const box = document.getElementById("ejes");
  box.innerHTML = "";
  EJES_SUGERIDOS.forEach((eje) => {
    const label = document.createElement("label");
    label.className = "eje";
    label.innerHTML = "<input type='checkbox'><span class='eje-title'>" + eje + "</span>";
    label.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) { state.ejesSeleccionados.add(eje); label.classList.add("selected"); }
      else { state.ejesSeleccionados.delete(eje); label.classList.remove("selected"); }
    });
    box.appendChild(label);
  });
}

async function ejecutarBusqueda() {
  const consulta = document.getElementById("consulta").value.trim();
  const estado = document.getElementById("estadoConsulta");
  const btn = document.getElementById("btnBuscarApi");
  const out = document.getElementById("resultadosApi");
  const err = document.getElementById("errApi");
  if (!consulta) { estado.textContent = "Escribe una consulta primero."; return; }
  if (!state.jurisdiccionesSeleccionadas.size) { estado.textContent = "Selecciona al menos una jurisdiccion."; return; }

  btn.disabled = true; btn.innerHTML = "<span class='spinner'></span>Buscando en fuentes oficiales...";
  estado.textContent = "Consultando APIs en vivo...";
  estado.className = "status";
  out.innerHTML = ""; err.innerHTML = "";

  const fecha = new Date().toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  try {
    const res = await window.IJARBusquedaExterna.ejecutarBusquedaExterna(consulta);
    const filtrados = (res.resultados || []).filter((r) => state.jurisdiccionesSeleccionadas.has(r.pais));
    state.resultados = filtrados;

    try {
      sessionStorage.setItem("legiscompare_brief", JSON.stringify({
        consulta,
        jurisdicciones: Array.from(state.jurisdiccionesSeleccionadas),
        ejes: Array.from(state.ejesSeleccionados),
        resultados: filtrados,
        fechaConsulta: fecha,
      }));
    } catch (e) {}

    if (!filtrados.length) {
      out.innerHTML = "<div class='empty'>Sin resultados en las jurisdicciones seleccionadas. Prueba con terminos mas generales.</div>";
      estado.textContent = "Sin resultados en vivo.";
    } else {
      filtrados.forEach((r) => {
        const d = document.createElement("div");
        d.className = "item api";
        d.innerHTML = "<strong>" + r.pais + "</strong><span class='tag api'>API en vivo</span><br><a href='" + r.url + "' target='_blank' rel='noopener'>" + r.titulo + "</a><span class='meta'>" + (r.fecha ? "Fecha: " + r.fecha + " - " : "") + "consultado " + fecha + "</span>";
        out.appendChild(d);
      });
      estado.textContent = filtrados.length + " resultado(s) en vivo encontrados.";
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
  if (!state.resultados.length) { alert("Ejecuta primero una busqueda con resultados."); return; }
  window.location.href = "dossier.html";
}

function init() {
  renderJurisdicciones();
  renderEjes();
  document.getElementById("btnBuscarApi").addEventListener("click", ejecutarBusqueda);
  document.getElementById("abrirDossier").addEventListener("click", abrirDossier);
}

document.addEventListener("DOMContentLoaded", init);
