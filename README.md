# 🏭 Factoría 2D

Juego de gestión y automatización de fábricas en 2D (con simulación pseudo-3D: sombras y edificios extruidos), inspirado en **Satisfactory** de Coffee Stain Studios. Hecho con HTML5 Canvas + JavaScript puro y empaquetado para Android con **Capacitor**.

![Género](https://img.shields.io/badge/g%C3%A9nero-factory%20builder-orange) ![Plataforma](https://img.shields.io/badge/plataforma-Android%20%2B%20Web-green)

## 🎮 Cómo jugar (~2 horas de gameplay)

Eres un ingeniero de FICSIT cuya nave **se estrella en un planeta desconocido** (intro cinemática animada). El mapa se **genera proceduralmente en cada partida**: los yacimientos, lagos y bosques cambian, pero siempre tendrás hierro y cobre cerca del punto del accidente y el carbón lejos. Tu misión: completar las **10 misiones del HUB** hasta enviar la **Fase 2 del Ascensor Espacial**.

0. **Sobrevive al accidente** — recupera las piezas de los restos humeantes de la nave y **construye con ellas el HUB**, que te entrega el pico de minero.
1. **Pica recursos a mano** — toca los yacimientos (rocas de colores) para extraer mineral (necesitas el pico del HUB).
2. **Taladro portátil** — colócalo sobre un yacimiento (cuesta 5 de mineral de hierro, máx. 6) y toca para recoger lo extraído.
3. **HUB** — entrega objetos para completar hitos y fabrica piezas a mano en el banco de artesanía.
4. **Automatiza** — desbloquea Fundidoras, Constructores, Ensambladoras y Mineros Mk.1. Toca cada máquina para asignarle una receta.
5. **Cintas transportadoras** — arrastra el dedo (modo cintas) para conectar mineros, máquinas y HUB; **giran con curvas** en las esquinas. En su submenú puedes elegir el **Separador**, que reparte una cinta de entrada entre hasta 3 salidas.
7. **HUB y HUD** — la **misión actual siempre visible** en pantalla (bajo el indicador eléctrico, con los iconos de cada material y su progreso) y en el HUB el histórico completo de misiones y el banco de artesanía. Los contenedores, mineros, máquinas y generadores **muestran su contenido sobre el edificio** en el propio mapa.
6. **Red eléctrica** — las máquinas solo funcionan **conectadas a la red**: colócalas cerca del HUB (que suministra 10 MW), de un generador, o construye **postes eléctricos** que tienden cables entre generadores y máquinas. Quema biomasa (arbustos y árboles) en el Quemador y, más tarde, carbón por cinta en el Generador de carbón. Si la demanda supera la generación, la red se sobrecarga.

### Contenido (referencias de Satisfactory)

| | |
|---|---|
| **Recursos** | Hierro, cobre, caliza, carbón, biomasa |
| **Mapa** | Procedural por partida (80×60): anillos de recursos alrededor del HUB, lagos y vegetación |
| **Edificios** | HUB, Taladro portátil, Minero Mk.1 y Mk.2, Fundidora, Fundición de acero, Constructor, Ensambladora, Cinta transportadora, Separador, Contenedor, Poste eléctrico, Quemador de biomasa, Generador de carbón |
| **Piezas** | Lingotes (hierro, cobre, acero), placas, varillas, tornillos, alambre, cable, hormigón, placas reforzadas, rotores, vigas y tubos de acero, estátores, motores, bastidores modulares y pesados, vigas revestidas |
| **Progresión** | 10 misiones del HUB que desbloquean edificios y recetas, de la era del hierro a la del acero, con final en la Fase 2 del Ascensor Espacial |

Controles táctiles: arrastrar para moverse, pellizcar para zoom, tocar para interactuar. Interfaz con iconos dibujados por código (sin assets externos) y la partida se guarda automáticamente.

## 📱 Descargar el APK

Cada push a la rama principal compila el APK automáticamente con GitHub Actions:

- **Releases** → [`apk-latest`](../../releases/tag/apk-latest) → descarga `factoria-2d.apk`
- O en **Actions** → última ejecución de "Build APK" → artefacto `factoria-2d-apk`

Instálalo en Android habilitando "instalar apps de orígenes desconocidos". Es un APK de depuración (sin firma de Play Store).

## 🛠️ Desarrollo

```bash
npm install

# Probar en el navegador
npm run serve            # http://localhost:8080

# Compilar el APK (requiere Android SDK + Java 21)
npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

### Estructura

```
www/                  Juego (HTML5 Canvas, sin dependencias)
  js/data.js          Objetos, recetas, edificios, hitos
  js/icons.js         Iconos generados por código (objetos, edificios, SVG de interfaz)
  js/world.js         Generación procedural del mapa (semilla por partida)
  js/game.js          Simulación: máquinas, cintas, red eléctrica, hitos, guardado
  js/render.js        Renderizado pseudo-3D (sombras, extrusión)
  js/input.js         Entrada táctil/ratón (paneo, zoom, modos)
  js/ui.js            Paneles, palette de construcción, tutorial
  js/intro.js         Intro cinemática (nave espacial que se estrella)
  js/main.js          Bucle principal y audio sintetizado
android/              Proyecto nativo generado por Capacitor
.github/workflows/    CI que compila y publica el APK
```

---
*Proyecto fan sin ánimo de lucro. Satisfactory es una marca de Coffee Stain Studios; este juego solo se inspira en sus mecánicas.*
