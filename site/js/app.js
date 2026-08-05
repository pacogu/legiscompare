// LegisCompare - busqueda de legislacion comparada via Gemini + Google Search
// grounding (un solo backend, sin conectores por pais). Flujo simplificado:
// escribir y Enter/Buscar. Jurisdicciones y ejes son filtros opcionales.

const REGIONES = [
  { id: "UE", nombre: "Union Europea y Europa", paises: ["Union Europea", "Alemania", "Austria", "Belgica", "Dinamarca", "Espana", "Estonia", "Finlandia", "Francia", "Grecia", "Hungria", "Irlanda", "Islandia", "Italia", "Letonia", "Lituania", "Luxemburgo", "Noruega", "Paises Bajos", "Polonia", "Portugal", "Reino Unido", "Republica Checa", "Suecia", "Suiza", "Turquia"] },
  { id: "AL", nombre: "America Latina", paises: ["Argentina", "Bolivia", "Brasil", "Chile", "Colombia", "Costa Rica", "Cuba", "Ecuador", "Mexico", "Nicaragua", "Panama", "Paraguay", "Peru", "Uruguay"] },
  { id: "NA", nombre: "Norteamerica y Oceania", paises: ["Estados Unidos", "Canada", "Australia", "Nueva Zelanda"] },
  { id: "AS", nombre: "Asia y Medio Oriente", paises: ["Corea del Sur", "Japon", "Israel"] },
];

const EJES_SUGERIDOS = [
  "Ambito de aplicacion",
  "Autoridad competente",
  "Derechos de las personas",
  "Sanciones e incumplimiento",
  "Plazos y procedimiento",
  "Transparencia y publicidad",
];

const TEMAS_SUGERIDOS = [
  "Proteccion de datos personales",
  "Inteligencia artificial y regulacion algoritmica",
  "Medio ambiente y cambio climatico",
  "Transparencia y acceso a la informacion",
  "Ninez y adolescencia",
  "Ciberseguridad",
  "Libertad de expresion en linea",
  "Regulacion de plataformas digitales",
];

const state = { paisesSeleccionados: new Set(), ejesSeleccionados: new Set(), resultados: [] };

function obtenerRecientes() {
  try { return JSON.parse(localStorage.getItem("legiscompare_recientes") || "[]"); } catch (e) { return []; }
}

function guardarReciente(q) {
  try {
    let recientes = obtenerRecientes().filter((r) => r.toLowerCase() !== q.toLowerCase());
    recientes.unshift(q);
    localStorage.setItem("legiscompare_recientes", JSON.stringify(recientes.slice(0, 5)));
  } catch (e) {}
}

function mostrarAutocomplete() {
  const input = document.getElementById("consulta");
  const list = document.getElementById("autocompleteList");
  const valor = input.value.trim().toLowerCase();
  const recientes = obtenerRecientes();
  let candidatos = valor
    ? [...recientes, ...TEMAS_SUGERIDOS].filter((t) => t.toLowerCase().includes(valor))
    : [...recientes, ...TEMAS_SUGERIDOS];
  candidatos = [...new Set(candidatos)].slice(0, 6);
  if (!candidatos.length) { list.hidden = true; list.innerHTML = ""; return; }
  list.innerHTML = candidatos.map((c) => {
    const esReciente = recientes.includes(c);
    return "<button type='button' data-valor='" + c.replace(/'/g, "&#39;") + "'>" + c + "<span class='ac-tag'>" + (esReciente ? "reciente" : "sugerido") + "</span></button>";
  }).join("");
  list.hidden = false;
  list.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      input.value = btn.getAttribute("data-valor");
      list.hidden = true;
      ejecutarBusqueda();
    });
  });
}

function renderJurisdicciones() {
  const box = document.getElementById("jurisdicciones");
  box.innerHTML = "";
  REGIONES.forEach((r) => {
    r.paises.forEach((pais) => {
      if (box.querySelector("[data-pais='" + pais + "']")) return;
      const label = document.createElement("label");
      label.className = "eje";
      label.setAttribute("data-pais", pais);
      label.innerHTML = "<input type='checkbox'><span class='eje-title'>" + pais + "</span>";
      label.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) { state.paisesSeleccionados.add(pais); label.classList.add("selected"); }
        else { state.paisesSeleccionados.delete(pais); label.classList.remove("selected"); }
        actualizarResumenFiltros();
      });
      box.appendChild(label);
    });
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
  const nPaises = state.paisesSeleccionados.size;
  const nEjes = state.ejesSeleccionados.size;
  const jurTexto = nPaises ? nPaises + " pais(es)" : "todos los paises";
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

  guardarReciente(consulta);
  document.getElementById("autocompleteList").hidden = true;
  btn.disabled = true; btn.innerHTML = "<span class='spinner'></span>Buscando...";
  estado.textContent = "Buscando el nombre de la norma en fuentes oficiales...";
  estado.className = "status";
  out.innerHTML = ""; err.innerHTML = ""; abrirBtn.style.display = "none";

  const fecha = new Date().toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  try {
    const paisesArray = Array.from(state.paisesSeleccionados);
    const res = await window.IJARBusquedaExterna.ejecutarBusquedaExterna(consulta, paisesArray);
    state.resultados = res.resultados || [];

    try {
      sessionStorage.setItem("legiscompare_brief", JSON.stringify({
        consulta,
        jurisdicciones: paisesArray,
        ejes: Array.from(state.ejesSeleccionados),
        resultados: state.resultados,
        fechaConsulta: fecha,
      }));
    } catch (e) {}

    const esErrorCuota = res.tipoError === "quota" || (res.errores || []).some((m) => /limite de uso|quota|429/i.test(m));

    if (esErrorCuota) {
      out.innerHTML = "<div class='empty'>Se alcanzo el limite de uso o creditos de la API por ahora. Espera unos minutos y vuelve a intentar.</div>";
      estado.textContent = "Limite de cuota alcanzado.";
      const retry = document.createElement("button");
      retry.className = "btn secondary";
      retry.style.marginTop = "10px";
      retry.textContent = "Reintentar";
      retry.addEventListener("click", ejecutarBusqueda);
      out.appendChild(retry);
    } else if (!state.resultados.length) {
      out.innerHTML = "<div class='empty'>Sin resultados. Prueba con terminos mas generales.</div>";
      estado.textContent = "Sin resultados.";
    } else {
      state.resultados.forEach((r) => {
        const d = document.createElement("div");
        d.className = "item api";
        const enlace = r.url ? "<a href='" + r.url + "' target='_blank' rel='noopener'>" + r.titulo + "</a>" : r.titulo;
        d.innerHTML = "<strong>" + r.pais + "</strong><span class='tag api'>Norma vigente</span><br>" + enlace + (r.resumen ? "<br><span class='meta'>" + r.resumen + "</span>" : "") + "<span class='meta'>" + (r.fecha ? "Fecha: " + r.fecha + " - " : "") + "consultado " + fecha + "</span>";
        out.appendChild(d);
      });
      estado.textContent = state.resultados.length + " resultado(s) encontrados.";
      estado.className = "status ok";
      abrirBtn.style.display = "inline-flex";
    }
    if (!esErrorCuota && res.errores && res.errores.length) err.innerHTML = res.errores.join("<br>");
  } catch (e) {
    err.innerHTML = "Error al buscar: " + e.message;
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
  const inputConsulta = document.getElementById("consulta");
  inputConsulta.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { document.getElementById("autocompleteList").hidden = true; ejecutarBusqueda(); }
  });
  inputConsulta.addEventListener("input", mostrarAutocomplete);
  inputConsulta.addEventListener("focus", mostrarAutocomplete);
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-bar-wrap")) document.getElementById("autocompleteList").hidden = true;
  });
  document.getElementById("toggleFiltros").addEventListener("click", () => {
    const panel = document.getElementById("filtrosPanel");
    panel.hidden = !panel.hidden;
    actualizarResumenFiltros();
  });
}

document.addEventListener("DOMContentLoaded", init);
