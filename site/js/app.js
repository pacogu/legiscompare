// LegisCompare - flujo simplificado: escribir y Enter/Buscar. Jurisdicciones
// y ejes son filtros opcionales colapsados por defecto (buscan en todas las
// jurisdicciones disponibles si no se filtra nada).

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
        actualizarResumenFiltros();
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
      actualizarResumenFiltros();
    });
    box.appendChild(label);
  });
}

function actualizarResumenFiltros() {
  const toggle = document.getElementById("toggleFiltros");
  const totalDisponibles = JURISDICCIONES.filter((j) => j.disponible).length;
  const nJur = state.jurisdiccionesSeleccionadas.size;
  const nEjes = state.ejesSeleccionados.size;
  const jurTexto = nJur === totalDisponibles ? "todas las jurisdicciones" : nJur + " jurisdiccion(es)";
  const ejesTexto = nEjes ? nEjes + " eje(s)" : "sin ejes";
  const abierto = !document.getElementById("filtrosPanel").hidden;
  toggle.innerHTML = "Filtros: " + jurTexto + ", " + ejesTexto + " " + (abierto ? "&#9652;" : "&#9662;");
}

async function ejecutarBusqueda() {
  const consulta = document.getElementById("consulta").value.trim();
  const estado = document.getElementById("estadoConsulta");
  const btn = document.getElementById("btnBuscarApi");
  const out = document.getElementById("resultadosApi");
  const err = document.getElementById("errApi");
  const abrirBtn = document.getElementById("abrirDossier");
  if (!consulta) { estado.textContent = "Escribe una consulta primero."; return; }
  if (!state.jurisdiccionesSeleccionadas.size) { estado.textContent = "Selecciona al menos una jurisdiccion en Filtros."; return; }

  btn.disabled = true; btn.innerHTML = "<span class='spinner'></span>Buscando...";
  estado.textContent = "Consultando APIs en vivo...";
  estado.className = "status";
  out.innerHTML = ""; err.innerHTML = ""; abrirBtn.style.display = "none";

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
      abrirBtn.style.display = "inline-flex";
    }
    if (res.errores && res.errores.length) err.innerHTML = res.errores.join("<br>");
  } catch (e) {
    err.innerHTML = "Error al consultar fuentes oficiales: " + e.message;
    estado.textContent = "Error en la busqueda.";
  }
  btn.disabled = false; btn.textContent = "Buscar";
}

function abrirDossier() {
  if (!state.resultados.length) { alert("Ejecuta primero una busqueda con resultados."); return; }
  window.location.href = "dossier.html";
}

function init() {
  renderJurisdicciones();
  renderEjes();
  actualizarResumenFiltros();

  document.getElementById("btnBuscarApi").addEventListener("click", ejecutarBusqueda);
  document.getElementById("abrirDossier").addEventListener("click", abrirDossier);
  document.getElementById("consulta").addEventListener("keydown", (e) => {
    if (e.key === "Enter") ejecutarBusqueda();
  });
  document.getElementById("toggleFiltros").addEventListener("click", () => {
    const panel = document.getElementById("filtrosPanel");
    panel.hidden = !panel.hidden;
    actualizarResumenFiltros();
  });
}

document.addEventListener("DOMContentLoaded", init);
