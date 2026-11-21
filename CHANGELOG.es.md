# Registro de cambios

Aquí se recogen los cambios importantes de Cloudy Clip. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[Versionado Semántico](https://semver.org/lang/es/).

Read in [English](CHANGELOG.md).

## [Sin publicar]

### Añadido

- **Más transiciones: 33 mosaicos en la pestaña Transitions (transiciones), antes eran 7.**
  **Basic** (básicas) añade **Clock wipe** (barrido de reloj), **Circle open** (círculo que se
  abre), **Circle close** (círculo que se cierra), **Split** (partir), **Split vertical** (partir en
  vertical), **Dip to white** (fundido a blanco) y **Top to bottom** (de arriba abajo); **Motion**
  (movimiento) añade **Push left**, **Push right**, **Push up** y **Push down** (empujar a la
  izquierda, a la derecha, arriba y abajo), **Slide left** (deslizar a la izquierda) y **Slide up**
  (deslizar hacia arriba); **Camera** (cámara) añade **Zoom in** (acercar), **Zoom out** (alejar),
  **Spin** (giro), **Spin left** (giro a la izquierda) y **Shake** (sacudida); **Light** (luz) añade
  **Blink** (parpadeo), **Light leak** (fuga de luz) y **Film burn** (quemadura de película);
  **Blur** (desenfoque) añade **Woosh up** (silbido hacia arriba); **Distort** (distorsión) añade
  **Pixelate** (pixelado), **Luma fade** (fundido por luminancia) y **Ripple** (onda); **Glitch**
  (fallo visual) añade **RGB split** (separación RGB). Donde aplican, usan las opciones comunes:
  suavizado, dirección, intensidad, suavidad y color. **Zoom**, **Spin**, **Shake** y **Push**
  necesitan la tarjeta gráfica para su desenfoque, y **Luma fade** y **Ripple** la necesitan del
  todo. Sin ella, la vista previa los muestra más simples, una sola vez, con un aviso, y una
  exportación se detiene con un mensaje en lugar de escribir la versión simple. Los agentes ven
  todos los mosaicos con `transition_list_presets`.
- **Seguir trayectoria:** dibuja una trayectoria sobre el fotograma, a mano alzada (un trazo que se
  suaviza en pocos puntos) o con la pluma (clic para esquinas, arrastrar para curvas), y cualquier
  número de clips la siguen. Progreso (0–100 %, con claves puestas por ti del inicio al final del
  clip) mueve el clip por la trayectoria a velocidad uniforme, así que los preajustes de curva y
  los bucles dan forma al movimiento; Posición pasa a ser un desplazamiento respecto a la
  trayectoria, para que varios clips viajen lado a lado, y Orientar según la trayectoria gira el
  clip con la curva. Cambia la forma en el lienzo (arrastra puntos y asas, doble clic para añadir
  un punto, Supr para quitarlo) y todos los clips la siguen. Dejar de seguirla o borrarla deja los
  clips donde están.
- Una sección **Trayectorias** en la Biblioteca muestra las de la composición abierta y cuántos
  clips siguen cada una, y una sección **Seguir trayectoria** en el inspector elige la de un clip o
  dibuja una nueva.
- Un clip que sigue una trayectoria muestra su nombre en la línea de tiempo; haz clic para editarla
  en el lienzo, dejar de seguirla o borrarla.
- Los agentes tienen `path_create`, `path_update`, `path_remove`, `path_attach`, `path_detach` y
  `path_list`. Los proyectos con trayectorias se guardan en la versión 5.
- **Pivote, estirar y voltear en Transformar**, como en After Effects. Cada imagen tiene un pivote
  (Pivote X/Y) sobre el que giran la escala, el estiramiento y la rotación; Posición coloca el
  pivote. Estirar ajusta Ancho y Alto por separado para aplastar y estirar, y un valor negativo
  voltea ese eje, así que un giro se puede animar suave pasando por cero. Voltear horizontal y
  Voltear vertical (en la sección Transformar y en el menú del clip) reflejan el clip y todas las
  claves de ese valor en un solo paso. Todo admite claves.
- En el lienzo, las asas laterales estiran un eje (arrastrar más allá del pivote lo voltea) y Alt+arrastrar
  la cruz mueve el pivote sin mover la imagen; las esquinas y el asa de rotación ahora trabajan
  sobre el pivote.
- Los agentes tienen `transform_flip`, y `element_set_props` acepta `scaleX`, `scaleY`, `pivotX`
  y `pivotY` dentro de `transform`.
- **Subtítulos:** marca clips de texto como subtítulos, cada uno con un estilo (Classic, Punchy,
  Intense, Whisper o uno tuyo) que fija su aspecto y posición. Si cambias un estilo, cambian todos
  los subtítulos que lo seguían; uno que cambiaste a mano conserva sus valores (se muestra con un
  rombo, con la acción Restablecer al estilo).
- Una página **Subtítulos** lista cada cue con palabras y tiempos editables, añade, divide y une
  cues, ajusta tiempos con las teclas `[`, `]` y Alt+flechas, y muestra la imagen y el sonido bajo
  la línea de tiempo. Importa y exporta `.srt` (y lee `.vtt`).
- Los agentes tienen `subtitle_add_style`, `subtitle_update_style`, `subtitle_rename_style`,
  `subtitle_remove_style`, `subtitle_reorder_styles`, `subtitle_mark`, `subtitle_unmark`,
  `subtitle_reset_to_style`, `subtitle_add_cue`, `subtitle_split_cue`, `subtitle_merge_cues`,
  `subtitle_import` y `subtitle_to_srt`.

## [0.1.0] - 2026-11-17

### Añadido

**La página Tinte (etalonaje de color)**

- Una nueva pestaña Tinte entre Editar y Sonido, con el visor, los scopes, la tira de clips y las herramientas uno junto a otro.
- Etalonajes como capas (Baby Seal) o como nodos (Leader Seal): dos vistas del mismo etalonaje, que se cambian con el interruptor de la foca. Las capas se pueden agrupar en paralelo, apiladas o por canal, con cables y uniones de llave en la vista de nodos.
- Herramientas: Básicos, ruedas (Primarias, Log, Barras y Zonas), curvas, Mezcla de color, Warper, Creativo, el mezclador RGB y límites por color y brillo con llaves compartidas.
- Espacios de color de cámara, archivos LUT (.cube), looks y fotogramas fijos.
- Copiar y pegar etalonajes, versiones, grupos de planos y un etalonaje de toda la línea de tiempo.
- Igualar un plano con otro, balance de blancos, cartas de color y tonos de piel.
- Los valores del etalonaje admiten fotogramas clave, así que un etalonaje puede cambiar a lo largo de un plano.
- Scopes, desactivar y antes/después, y herramientas del visor.
- Los etalonajes se dibujan en la GPU, igual en la vista previa, las capturas y la exportación.
- Los agentes pueden etalonar con nuevas herramientas MCP.

**Líneas de volumen y automatización (página Sonido)**

- Una línea de volumen sobre cada clip de audio, hecha con sus fotogramas clave de volumen: arrastra un punto, haz doble clic para añadir uno y pulsa Supr para borrar el seleccionado. Sigue los cambios de velocidad, las rampas y los cortes.
- Una línea de volumen por pista que no se mueve cuando los clips se mueven o se cortan. Suena en la vista previa y se escribe en la exportación, también dentro de composiciones colocadas.
- Dibujar volumen: dibuja la línea de una pista o de un clip con el lápiz. Los trazos se suavizan con un margen de 0,5 dB y solo cambian el tramo que dibujaste.
- Automatización del fader con Read, Touch y Latch en cada canal. Mover el fader mientras suena se graba en la línea como ajuste; una reproducción es un solo paso de deshacer, los bucles no se acumulan y los tramos saltados no se tocan.
- Herramientas de puntero en la barra de transporte: Seleccionar, Cortar (una cuchilla: haz clic en un clip para cortarlo ahí; con Mayús corta todas las pistas), Fundido, Dibujar volumen y Scrub.

**Grupos, formatos de audio y stems**

- Pistas de grupo (por ejemplo «Diálogo» o «Música y efectos») con su propio canal, fader, silencio y efectos. Las pistas se envían a un grupo desde el selector «Envía a», que también puede crear un grupo nuevo. Las mezclas A y B comparten los mismos grupos; solo cambian sus ajustes.
- Un grupo silenciado no suena y ya no atenúa (ducking) a otras pistas.
- Exportaciones de solo sonido en WAV, FLAC, AAC y Opus, a 44,1 o 48 kHz; WAV y FLAC en 16 o 24 bits, con dither a 16 bits.
- Stems: un archivo por grupo, más «Otros» y la «Mezcla» completa, en una sola pasada de FFmpeg. Juntos suman la mezcla antes del Master.
- El Master recibe Paneo, Silencio, Read/Touch/Latch y su propia línea de volumen en la línea de tiempo de Sonido.

**Entrega**

- Estándares de entrega: Spotify, Apple Podcasts, EBU R128 y ATSC A/85 (con sus fuentes), YouTube y TikTok (práctica habitual, sin cifra oficial) y Personalizado.
- Analizar toda la mezcla: sonoridad integrada, rango de sonoridad y pico real de exactamente lo que se exporta, y una lista de puntos problemáticos que también se marcan en la regla. Al hacer clic en un problema el cursor de reproducción salta ahí. Funciona en segundo plano, se puede cancelar y avisa cuando queda desactualizado.
- Ajustar al objetivo: un solo paso de deshacer mediante el nuevo Trim del Master (−24 a +24 dB), con un limitador si hace falta. Las exportaciones pueden ajustarse en su propia copia sin cambiar el proyecto.
- Medidores de espectro y de fase estéreo en la pestaña Sonoridad, y la línea del objetivo en «Sonoridad en el tiempo».

**Herramientas rápidas**

- Buscar tiempos: encuentra los tiempos (beats) a partir del sonido, los muestra como marcas en la línea de tiempo y sirven para el ajuste magnético. Sigue los cambios de tempo.
- Quitar silencios: elimina los tramos en silencio tras una vista previa de los cortes. En la página Sonido corta solo el sonido y deja los huecos; en la página Editar (menú del clip) corta imagen y sonido y cierra los huecos.
- Igualar nivel: lleva los clips seleccionados a la misma sonoridad, medida tal como se oye, conservando la forma de sus fotogramas clave de volumen.

**Otros**

- El compresor muestra en directo su reducción de ganancia en la pestaña Canal.
- El limitador mantiene ahora los picos reales (los picos entre muestras) por debajo de su techo, igual en la vista previa que en la exportación.
- Los agentes pueden hacer todo lo anterior con nuevas herramientas MCP, incluido cancelar sus propios análisis y leer las mediciones guardadas.

### Cambiado

- Las envolventes de volumen exportadas (fotogramas clave de clips, fundidos, líneas de pista) cambian de forma suave, muestra a muestra, en lugar de en saltos de hasta 85 ms.
- El medidor de sonoridad lee los picos reales igual que la medición de FFmpeg.
- Las herramientas de agente que esperan un trabajo largo responden en unos 25 segundos e informan del progreso; volver a pedirlo se une al mismo trabajo.
- Las herramientas de líneas de volumen reciben un `target` (una pista o `"master"`) en lugar de `trackId`.
- `project_get_state` devuelve un resumen compacto: cada composición en una línea, una composición completa (`compositionId`, o la abierta) y los medios, carpetas, sólidos, grupos de etalonaje, LUT y fotogramas fijos solo cuando se piden con `include`.
- Las herramientas de líneas y pasadas devuelven los ids de los fotogramas clave que escribieron.

### Corregido

- Los trabajos de FFmpeg ya no siguen en marcha después de cerrar la aplicación, y se borran sus archivos a medio escribir. Lo que quede de un cierre inesperado se limpia en el siguiente arranque.
- La página Sonido ya no se hace más ancha que la ventana, así que el mezclador y la vista previa pequeña siempre se ven.
- El vídeo se dibuja con el rango de brillo correcto para cada tipo de archivo. En algunos archivos los negros y blancos se estiraban dos veces, lo que aplastaba las sombras y quemaba las luces.
- Recortar o cortar un clip ajusta sus fundidos a la nueva duración, y la herramienta de recorte devuelve el clip tal como queda guardado.
- Cada salida de solo sonido tiene exactamente la duración pedida.
- Buscar tiempos mantiene el tempo completo cuando los bombos tienen huecos alternos.
- Un fotograma clave movido se detiene en el borde del clip.
- `speed_reset` tras una rampa recupera una duración original redonda.
- Arreglos en muchas herramientas MCP encontrados en una prueba completa: rechazos más claros para packs, temas, trabajos y colores desconocidos, al volver a vincular se conserva el nombre elegido, `preview_capture_frame` no mueve el cursor del agente, `junction_set` conserva las opciones dadas con un preset nuevo, y se rechaza ocultar una pista de audio.

## [0.0.1] - 2026-11-09

Las partes de esta versión que pertenecen a la página Sonido.

### Añadido

- La página Sonido: la línea de tiempo de solo audio, un mezclador con un canal por pista de audio y el Master fijo en su borde, una vista previa pequeña y las pestañas Clip, Canal, Sonoridad y Entrega.
- Volumen, paneo, silencio y solo por pista; Mezcla A/B; Mono, Atenuar y el volumen del altavoz.
- Medición de sonoridad (BS.1770) y un gráfico del historial de sonoridad.
- Efectos en pistas y en el Master: ecualizador, compresor, puerta de ruido, de-esser, limitador, ducking y reducción de ruido. La vista previa coincide con la exportación muestra a muestra. Preajustes, incluidos y propios.
- Bucle y scrub de audio en la página Sonido.
- Grabación de voz en una pista (Linux), guardada como WAV junto al proyecto. Grabar funciona sin armar una pista: crea una pista de Voz nueva.
- Marcadores en la página Sonido, en su propia fila bajo la regla.

### Corregido

- La aplicación ya no se congela cuando el reproductor de un vídeo se silencia sin estar en pantalla (un fallo de WebKitGTK).
