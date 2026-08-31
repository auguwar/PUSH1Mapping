# Push 1 + Mixxx LCD Integration

Integración del **Ableton Push 1** (original de Akai) con **Mixxx 2.5.6** vía MIDI/SysEx
para mostrar información en el LCD de 4 líneas del Push: browsing de tracks, loops,
VU meters, niveles, etc. Incluye un **simulador de pantalla en terminal** para
desarrollar y testear la interfaz sin tener el hardware conectado.

## Requisitos

- macOS (testeado en Sequoia) con Python 3 y `python-rtmidi`
  (`pip install python-rtmidi`, instalado como user install)
- Mixxx 2.5.6 (Linux/Windows: el simulador usa CoreMIDI de macOS)
- El Push 1 original conectado **o** el simulador en modo virtual

## Estructura

| Ruta | Contenido |
|------|-----------|
| `controllers/Akai-Push.midi.xml` | Mapping MIDI de Mixxx para el Push 1 |
| `controllers/Akai-Push-scripts.js` | Script del controlador (SysEx LCD, fader de `[Channel1]` `filterLow`, character map) |
| `tools/push_lcd_simulator.py` | Simulador LCD en terminal (curses 4×68 + puerto MIDI virtual) |
| `tools/send_test_sysex.py` | Envío de SysEx de prueba al simulador/hardware sin Mixxx |
| `tests/sysex-validation.js` | Tests del render del fader + validación contra capturas `.syx` |
| `sysextests/*.syx` | Capturas de referencia (Ableton Live) validadas |
| `docs/` | Referencias: protocolo LCD, controles de Mixxx, Components JS |
| `.opencode/` | Config de opencode: agentes especializados + skill |

## Quick start

**Orden importante:** Mixxx solo detecta controladores al arrancar, así que el
simulador debe estar corriendo **antes** de iniciar/reiniciar Mixxx.

```bash
# 1) Levantar el simulador (puerto virtual llamdo "Push LCD Simulator")
python3 tools/push_lcd_simulator.py

# 2) Abrir/reiniciar Mixxx, ir a Preferences > MIDI Controllers,
#    seleccionar el puerto y asignar el preset "Akai Push 1"

# 3) Sin Mixxx, probar con SysEx directo:
python3 tools/send_test_sysex.py --text "Hola Push"
python3 tools/send_test_sysex.py --chars-all        # mapa completo de 128 caracteres
python3 tools/send_test_sysex.py --char 65          # renderiza un carácter concreto
```

## Simulador

`python3 tools/push_lcd_simulator.py [--port NOMBRE] [--log-lines N]`

Crea un **par** de puertos virtuales MIDI con el mismo nombre (un *source* que Mixxx
usa como entrada y un *destination* de salida). El LCD simulado se pinta en la
terminal de 4×68 caracteres.

Teclas: `q` salir · `l` mostrar/ocultar el log de SysEx · `c` limpiar el LCD ·
`r` limpiar el log. Cada mensaje crudo recibido se vuelca a `tools/push_lcd_capture.log`
(debug; no commitear).

La pantalla distingue los bytes "especiales" del protocolo (códigos < 32 y 127,
que el LCD real dibuja como glifos propios de Akai) mostrándolos como `·` en
cian/negrita, y los caracteres ASCII imprimibles (32–126) como texto normal.

## Pruebas end-to-end con Mixxx

Etapas del test:

1. **Character map:** `python3 tools/send_test_sysex.py --chars-all` dibuja los
   128 caracteres del LCD en las líneas 2–3.
2. **Fader en tiempo real:** girar la perilla de *bass* (`[Channel1]` `filterLow`)
   mueve un fader de 8 caracteres (`[######]`) en la línea 1, conectado vía
   `engine.makeConnection` en `controllers/Akai-Push-scripts.js`.

Recordá reiniciar Mixxx tras levantar el simulador para que lo detecte.

## Tests

Los tests de validación del rendering/hardware están en `tests/` (correr bajo
Node con el runtime disponible en la máquina). Incluyen casos del fader (0 %,
100 %, 50 %, 25 %, clamping) y validación de los mensajes contra las capturas
`.syx` de referencia.

## Gotchas conocidas

- **Detección Mixxx:** Mixxx solo lista controladores desde dispositivos MIDI de
  *entrada*; un puerto de salida virtual solo nunca aparece. El simulador crea el
  par source+destination con el mismo nombre.
- **python-rtmidi en macOS (1.5.8):** el callback entrega el mensaje como tupla
  empaquetada `(byte_list, delta_time)`; hay que normalizarlo (`unwrap_message`)
  antes de parsear o el thread de entrega muere silenciosamente.
- **curses `addnstr`:** su firma es `addnstr(y, x, str, n[, attr])`; pasar `attr`
  como 4.º argumento lo interpreta como longitud `n` (los textos con `attr=0`
  quedaban invisibles). Usar `addstr` recortando el texto manualmente.

Detalle completo de estas trampas en
`.opencode/skills/mixxx-push1-integration/SKILL.md`.

## Protocolo LCD del Push 1

```
F0 47 7F 15 {line} 00 45 00 {68 chars ASCII} F7
```

| Línea | Byte |
|-------|------|
| 1 | 0x18 |
| 2 | 0x19 |
| 3 | 0x1A |
| 4 | 0x1B |

Referencia completa en `docs/push1-lcd-protocol.md` + capturas en `sysextests/`.