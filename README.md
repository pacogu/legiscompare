# LegisCompare - Derecho Comparado

Aplicacion web que apoya el trabajo de analisis de derecho comparado,
inspirada en el piloto "Comparative Law++" (BCN Chile, IFLAPARL 2026):
automatiza la busqueda, organizacion y trazabilidad de fuentes normativas,
sin reemplazar el criterio juridico. El sistema prepara un informe
analitico preliminar (matriz, timeline, ejes juridicos); los hallazgos,
implicancias y el informe final los redacta el abogado.

Flujo: consulta inicial -> seleccion de jurisdicciones y ejes ->
busqueda del nombre real de la norma en fuentes oficiales -> matriz
comparada -> timeline -> informe analitico preliminar (editable,
imprimible) -> redaccion humana del informe final.

## Estructura

```
site/
  index.html          pagina de consulta (punto de entrada)
  dossier.html         dossier analitico comparado
  data/fuentes_oficiales.json  catalogo curado de fuentes oficiales por pais
  css/app.css             estilos
  js/app.js               logica de la pagina de consulta
  js/dossier.js            logica del dossier
  js/busqueda_api.js       cliente de busqueda, con fallback al catalogo local (cache 30min)
netlify/functions/buscar.js      busqueda en vivo del nombre de la norma (Gemini + Google Search)
netlify/functions/sintetizar.js  borrador de sintesis comparada (Gemini, opcional)
netlify.toml            configuracion de build/deploy de Netlify
```

## Como funciona la busqueda

El sitio busca el NOMBRE REAL de la norma (no solo el portal donde
buscar). Usa Google Gemini (nivel gratuito, sin tarjeta de credito) con
Google Search (grounding): devuelve el titulo oficial de cada norma,
traducido al espanol cuando el original esta en otro idioma, junto con
pais, URL, fecha y un resumen de que regula.

Como contexto, cada busqueda se acota con el catalogo curado en
`site/data/fuentes_oficiales.json` (46 paises y bloques: Union Europea,
Alemania, Argentina, Australia, Austria, Belgica, Bolivia, Brasil,
Canada, Chile, Colombia, Corea del Sur, Costa Rica, Cuba, Dinamarca,
Ecuador, Espana, Estados Unidos, Estonia, Finlandia, Francia, Grecia,
Hungria, Irlanda, Islandia, Israel, Italia, Japon, Letonia, Lituania,
Luxemburgo, Mexico, Nicaragua, Noruega, Nueva Zelanda, Paises Bajos,
Panama, Paraguay, Peru, Polonia, Portugal, Reino Unido, Republica Checa,
Suecia, Suiza, Turquia y Uruguay). Esto orienta al modelo a buscar
directamente en el portal oficial de cada pais seleccionado en vez de
fuentes genericas.

**Respaldo sin IA:** si Gemini se queda sin cuota gratuita del dia (o la
clave no esta configurada), el sitio no muestra "sin resultados": cae
automaticamente al mismo catalogo local y muestra el directorio de
fuentes oficiales de los paises filtrados, con enlace directo al portal
de cada uno, para que el usuario busque ahi manualmente. Esto hace que
la busqueda nunca quede vacia, con o sin cuota de IA disponible.

Para agregar mas paises al catalogo, basta con sumar un objeto nuevo a
`fuentes_oficiales.json` con los campos `pais`, `fuente`, `tipo`,
`nivel`, `url`, `tiene_api`, `api_url`, `api_tipo`, `api_docs`,
`api_params`, `formato`, `notas`.

Requiere la variable de entorno `GEMINI_API_KEY` en Netlify (ver mas
abajo) para la busqueda con IA; sin ella, el sitio funciona igual pero
siempre en modo directorio. Los resultados se cachean 30 minutos en el
navegador para no repetir llamadas con la misma consulta.

## Sintesis comparada (opcional, usa IA)

El dossier analitico (`dossier.html`) puede generar un borrador de
sintesis comparada por eje juridico usando Gemini, a partir de las
fuentes ya encontradas. Esto es un paso opcional y puntual (no se
ejecuta en cada busqueda), asi que su consumo de cuota es mucho menor.
Usa la misma variable `GEMINI_API_KEY`. Si no esta configurada, el
dossier funciona igual pero sin el borrador automatico (el analista
redacta directamente sus hallazgos).

## Como desplegar en Netlify

1. Sube este repositorio a GitHub.
2. En Netlify: Add new site > Import an existing project, conecta el repo.
3. Build settings: sin build command, publish directory = `site`.
4. En Site settings > Environment variables agrega `GEMINI_API_KEY`
   (gratis, sin tarjeta, en https://aistudio.google.com/apikey; marcar
   "Contains secret values").
5. Deploy. La busqueda funciona via `/.netlify/functions/buscar`, con
   fallback automatico al catalogo local si no hay cuota disponible.

## Desarrollo local

Sin build. Para probar el sitio basta con abrir `site/index.html` o
servirlo con cualquier servidor estatico. Para probar la funcion
serverless localmente:

```
npm install -g netlify-cli
netlify dev
```
