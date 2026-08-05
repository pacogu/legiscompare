# LegisCompare - Derecho Comparado

Aplicacion web que apoya el trabajo de analisis de derecho comparado,
inspirada en el piloto "Comparative Law++" (BCN Chile, IFLAPARL 2026):
automatiza la busqueda, organizacion y trazabilidad de fuentes normativas,
sin reemplazar el criterio juridico. El sistema prepara un informe
analitico preliminar (matriz, timeline, ejes juridicos); los hallazgos,
implicancias y el informe final los redacta el abogado.

Flujo: consulta inicial -> seleccion de jurisdicciones y ejes ->
busqueda en el catalogo de fuentes oficiales -> matriz comparada ->
timeline -> informe analitico preliminar (editable, imprimible) ->
redaccion humana del informe final.

## Estructura

```
site/
  index.html          pagina de consulta (punto de entrada)
  dossier.html         dossier analitico comparado
  data/fuentes_oficiales.json  catalogo curado de fuentes oficiales por pais
  css/app.css             estilos
  js/app.js               logica de la pagina de consulta
  js/dossier.js            logica del dossier
  js/busqueda_api.js       filtra el catalogo local de fuentes oficiales
netlify/functions/sintetizar.js  borrador de sintesis comparada (Claude, opcional)
netlify.toml            configuracion de build/deploy de Netlify
```

## Como funciona la busqueda

La busqueda principal ya NO depende de una API de IA externa (se elimino
esa dependencia por los limites de cuota/creditos que generaba). En su
lugar usa un catalogo curado en `site/data/fuentes_oficiales.json` con la
fuente oficial, URL y datos de API (si existe) de 46 paises y bloques,
incluyendo Union Europea, Alemania, Argentina, Australia, Austria,
Belgica, Bolivia, Brasil, Canada, Chile, Colombia, Corea del Sur,
Costa Rica, Cuba, Dinamarca, Ecuador, Espana, Estados Unidos, Estonia,
Finlandia, Francia, Grecia, Hungria, Irlanda, Islandia, Israel, Italia,
Japon, Letonia, Lituania, Luxemburgo, Mexico, Nicaragua, Noruega,
Nueva Zelanda, Paises Bajos, Panama, Paraguay, Peru, Polonia, Portugal,
Reino Unido, Republica Checa, Suecia, Suiza, Turquia y Uruguay.

Al buscar, el sitio filtra este catalogo por los paises seleccionados y
por coincidencia de palabras con el termino buscado (en el nombre de la
fuente, el tipo de norma y las notas). Si no hay coincidencia exacta,
igual se muestra el directorio completo de fuentes oficiales del pais
seleccionado, para que el usuario navegue directo a la fuente primaria.

Esto hace la busqueda base 100% confiable y sin costos de API: no hay
llamadas de red mas que cargar el JSON local. Para agregar mas paises,
basta con sumar un objeto nuevo a `fuentes_oficiales.json` con los campos
`pais`, `fuente`, `tipo`, `nivel`, `url`, `tiene_api`, `api_url`,
`api_tipo`, `api_docs`, `api_params`, `formato`, `notas`.

## Sintesis comparada (opcional, usa IA)

El dossier analitico (`dossier.html`) puede generar un borrador de
sintesis comparada por eje juridico usando Claude (Anthropic), a partir
de las fuentes ya encontradas. Esto es un paso opcional y puntual (no se
ejecuta en cada busqueda), asi que su consumo de API es mucho menor.
Requiere la variable de entorno `ANTHROPIC_API_KEY` en Netlify. Si no esta
configurada, el dossier funciona igual pero sin el borrador automatico
(el analista redacta directamente sus hallazgos).

## Como desplegar en Netlify

1. Sube este repositorio a GitHub.
2. En Netlify: Add new site > Import an existing project, conecta el repo.
3. Build settings: sin build command, publish directory = `site`.
4. (Opcional, solo para el borrador de sintesis) En Site settings >
   Environment variables agrega `ANTHROPIC_API_KEY` (se obtiene en
   https://console.anthropic.com/settings/keys; marcar "Contains secret
   values").
5. Deploy. La busqueda principal funciona sin configuracion adicional.

## Desarrollo local

Sin build. Para probar el sitio basta con abrir `site/index.html` o
servirlo con cualquier servidor estatico. Para probar la funcion
serverless de sintesis localmente:

```
npm install -g netlify-cli
netlify dev
```
