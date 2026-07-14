# 🏭 Factoría 2D

Juego de gestión y automatización de fábricas en 2D (con simulación pseudo-3D: sombras y edificios extruidos), inspirado en **Satisfactory** de Coffee Stain Studios. Hecho con HTML5 Canvas + JavaScript puro y empaquetado para Android con **Capacitor**.

![Género](https://img.shields.io/badge/g%C3%A9nero-factory%20builder-orange) ![Plataforma](https://img.shields.io/badge/plataforma-Android%20%2B%20Web-green)

## 🎮 Cómo jugar (~30 minutos de gameplay)

Eres un ingeniero de FICSIT. Tu misión: completar los **6 hitos del HUB** hasta enviar la **Fase 1 del Ascensor Espacial**.

1. **Pica recursos a mano** — toca los yacimientos (rocas de colores) para extraer mineral.
2. **Taladro portátil** — colócalo sobre un yacimiento (gratis, máx. 6) y toca para recoger lo extraído.
3. **HUB** — entrega objetos para completar hitos y fabrica piezas a mano en el banco de artesanía.
4. **Automatiza** — desbloquea Fundidoras, Constructores, Ensambladoras y Mineros Mk.1. Toca cada máquina para asignarle una receta.
5. **Cintas transportadoras** — arrastra el dedo (modo ➡️) para conectar mineros → máquinas → HUB.
6. **Energía** — las máquinas consumen MW. Quema biomasa (arbustos y árboles) en el Quemador, y más tarde carbón por cinta en el Generador de carbón. Si la demanda supera la generación… ¡salta el fusible!

### Contenido (referencias de Satisfactory)

| | |
|---|---|
| **Recursos** | Hierro, cobre, caliza, carbón, biomasa |
| **Edificios** | HUB, Taladro portátil, Minero Mk.1, Fundidora, Constructor, Ensambladora, Cinta transportadora, Contenedor, Quemador de biomasa, Generador de carbón |
| **Piezas** | Lingotes, placas, varillas, tornillos, alambre, cable, hormigón, placas reforzadas, rotores |
| **Progresión** | 6 hitos del HUB que desbloquean edificios y recetas, con final en el Ascensor Espacial |

Controles táctiles: arrastrar para moverse, pellizcar para zoom, tocar para interactuar. La partida se guarda automáticamente.

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
  js/world.js         Generación del mapa
  js/game.js          Simulación: máquinas, cintas, energía, hitos, guardado
  js/render.js        Renderizado pseudo-3D (sombras, extrusión)
  js/input.js         Entrada táctil/ratón (paneo, zoom, modos)
  js/ui.js            Paneles, palette de construcción, tutorial
  js/main.js          Bucle principal y audio sintetizado
android/              Proyecto nativo generado por Capacitor
.github/workflows/    CI que compila y publica el APK
```

---
*Proyecto fan sin ánimo de lucro. Satisfactory es una marca de Coffee Stain Studios; este juego solo se inspira en sus mecánicas.*
