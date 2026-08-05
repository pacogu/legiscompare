# LegisCompare - Derecho Comparado

Aplicacion web que apoya el trabajo de analisis de derecho comparado,
inspirada en el piloto "Comparative Law++" (BCN Chile, IFLAPARL 2026):
automatiza la busqueda, organizacion y trazabilidad de fuentes normativas,
sin reemplazar el criterio juridico. El sistema prepara un informe
analitico preliminar (matriz, timeline, ejes juridicos); los hallazgos,
implicancias y el informe final los redacta el abogado.

Flujo: consulta inicial -> seleccion de jurisdicciones y ejes ->
busqueda y analisis de fuentes oficiales -> matriz comparada -> timeline
-> informe analitico preliminar (editable, imprimible) -> redaccion
humana del informe final.

## Estructura

```
site/
  index.html          pagina de consulta (punto de entrada)
  dossier.html         dossier analitico comparado
  data/fuentes_oficiales.json  catalogo curado de fuentes oficiales por pais
  css/app.css             estilos
  js/app.js               logica de la pagina de consulta
  js/dossier.js            logica del dossier
  js/busqueda_api.js       cliente de busqueda, con fallback al directorio simple (cache 30min)
netlify/functions/buscar.js      analisis de fuentes oficiales para la consulta (Groq)
netlify/functions/sintetizar.js  borrador de sintesis comparada (Groq, opcional)
netlify.toml            configuracion de build/deploy de Netlify
```

## Como funciona la busqueda

El sitio no tiene una API de busqueda web propia (para evitar depender de
proveedores pagos como Gemini/Claude/OpenAI que se quedan sin cuota o
saldo). En su lugar combina dos piezas:

1. **Catalogo curado** en `site/data/fuentes_oficiales.json`: 46 paises y
   bloques (Union Europea, Alemania, Argentina, Australia, Austria,
   Belgica, Bolivia, Brasil, Canada, Chile, Colombia, Corea del Sur,
   Costa Rica, Cuba, Dinamarca, Ecuador, Espana, Estados Unidos, Estonia,
   Finlandia, Francia, Grecia, Hungria, Irlanda, Islandia, Israel,
   Italia, Japon, Letonia, Lituania, Luxemburgo, Mexico, Nicaragua,
   Noruega, Nueva Zelanda, Paises Bajos, Panama, Paraguay, Peru, Polonia,
   Portugal, Reino Unido, Republica Checa, Suecia, Suiza, Turquia y
   Uruguay) con la fuente oficial, URL y tipo de normas que cubre cada
   pais. El sitio filtra este catalogo por los paises seleccionados y por
   coincidencia de palabras con la consulta.
2. **Analisis con Groq** (gratis, sin tarjeta de credito): para cada
   fuente filtrada, el modelo redacta una nota breve indicando que tipo
   de norma buscar ahi para la consulta del analista. Groq no tiene
   busqueda web propia en su nivel gratuito, asi que el modelo NUNCA
   inventa el titulo de una ley especifica: solo analiza el tipo de
   fuente ya conocido y orienta la busqueda manual del analista en el
   portal oficial correspondiente (con enlace directo).

**Respaldo sin IA:** si Groq se queda sin cuota gratuita o la clave no
esta configurada, el sitio no muestra "sin resultados": cae
automaticamente al directorio simple (solo nombre de la fuente y URL),
para que la busqueda nunca quede vacia.

Para agregar mas paises al catalogo, basta con sumar un objeto nuevo a
`fuentes_oficiales.json` con los campos `pais`, `fuente`, `tipo`,
`nivel`, `url`, `tiene_api`, `api_url`, `api_tipo`, `api_docs`,
`api_params`, `formato`, `notas`.

Requiere la variable de entorno `GROQ_API_KEY` en Netlify (ver mas abajo)
para el analisis con IA; sin ella, el sitio funciona igual pero siempre
en modo directorio simple. Los resultados se cachean 30 minutos en el
navegador para no repetir llamadas con la misma consulta.

## Sintesis comparada (opcional, usa IA)

El dossier analitico (`dossier.html`) puede generar un borrador de
sintesis comparada por eje juridico usando Groq, a partir de las fuentes
ya analizadas. Esto es un paso opcional y puntual (no se ejecuta en cada
busqueda), asi que su consumo de cuota es mucho menor. Usa la misma
variable `GROQ_API_KEY`. Si no esta configurada, el dossier funciona
igual pero sin el borrador automatico (el analista redacta directamente
sus hallazgos).

## Como desplegar en Netlify

1. Sube este repositorio a GitHub.
2. En Netlify: Add new site > Import an existing project, conecta el repo.
3. Build settings: sin build command, publish directory = `site`.
4. En Site settings > Environment variables agrega `GROQ_API_KEY`
   (gratis, sin tarjeta, en https://console.groq.com/keys; marcar
   "Contains secret values").
5. Deploy. La busqueda funciona via `/.netlify/functions/buscar`, con
   fallback automatico al directorio simple si no hay cuota disponible.

## Desarrollo local

Sin build. Para probar el sitio basta con abrir `site/index.html` o
servirlo con cualquier servidor estatico. Para probar la funcion
serverless localmente:

```
npm install -g netlify-cli
netlify dev
```
