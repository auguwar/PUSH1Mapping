---
name: mixxx-push1-integration
description: Use when working on the Akai Push 1 + Mixxx MIDI/SysEx integration. Covers Push 1 LCD SysEx protocol, Mixxx MIDI mapping XML, Components JS scripting, and controller development. Trigger on keywords: push1, push, lcd, sysex, mixxx mapping, controller script, midi mapping, vu meter display, track display.
---

# Mixxx Push 1 Integration Skill

## Project Overview

Akai Push 1 (original hardware by Akai) integrated with Mixxx 2.5.6 via MIDI and SysEx on macOS Sequoia. The goal is to display track info, loops, VU meters, and levels on the Push 1's 4-line LCD screen.

## Quick Reference: Push 1 LCD SysEx

### Format
```
F0 47 7F 15 {line} 00 45 00 {68 chars ASCII} F7
```

### Line Map
| Line | Byte | Decimal |
|------|------|---------|
| 1 | 0x18 | 24 |
| 2 | 0x19 | 25 |
| 3 | 0x1A | 26 |
| 4 | 0x1B | 27 |

### JavaScript Helper
```javascript
function sendLCDLine(line, text) {
    var lineNum = 0x17 + line;
    var msg = [0xF0, 0x47, 0x7F, 0x15, lineNum, 0x00, 0x45, 0x00];
    text = text.substring(0, 68);
    while (text.length < 68) text += ' ';
    for (var i = 0; i < 68; i++) {
        msg.push(text.charCodeAt(i));
    }
    msg.push(0xF7);
    midi.sendSysexMsg(msg, msg.length);
}
```

### Clear All Lines
```javascript
function clearLCD() {
    for (var line = 1; line <= 4; line++) {
        sendLCDLine(line, "");
    }
}
```

## Mixxx Script Conventions

- No ES6+ (Mixxx uses an older JS engine)
- Use `var`, not `let`/`const`
- No arrow functions, template literals, or modules
- Function declarations via `var Namespace = {};` pattern
- `init(id)` and `shutdown()` are required entry points

## Key Files

| File | Purpose |
|------|---------|
| `controllers/Akai-Push.midi.xml` | MIDI mapping XML |
| `controllers/Akai-Push-scripts.js` | Controller JS script |
| `docs/push1-lcd-protocol.md` | Full SysEx protocol reference |
| `docs/mixxx-controls-reference.md` | Mixxx CO catalog |
| `docs/components-js-reference.md` | Components JS API |
| `sysextests/*.syx` | Captured SysEx from Ableton Live |
| `tools/push_lcd_simulator.py` | Virtual LCD terminal simulator (curses, virtual MIDI port) |
| `tools/send_test_sysex.py` | Send test SysEx to simulator/hardware without Mixxx |

## LCD Simulator

Run `python3 tools/push_lcd_simulator.py` (optionally `--port NAME`). It creates
a MIDI port **pair** under the same name: a virtual *source* (= Mixxx input,
needed for Mixxx to list the controller) plus a virtual *destination* (= Mixxx
output, where Mixxx sends the SysEx). **Start/restart Mixxx after** the tool is
running, then in Mixxx Preferences > MIDI Controllers select the port and assign
the "Akai Push 1" preset. Test without Mixxx: `python3 tools/send_test_sysex.py
--port "Push LCD Simulator" --chars-all` (full 128-char map) or `--text "hi"`.

**Gotcha 1 (detection):** Mixxx only builds its detected-controllers list from
MIDI *input* devices (sources) and links a same-named *output* to them. A
virtual destination alone (MidiIn virtual port) never shows up — Mixxx reports
"did not detect any controllers". You must also create a virtual source
(`MidiOut.open_virtual_port` with the same name) in the simulator.

**Gotcha 2 (python-rtmidi 1.5.8, macOS):** the MIDI callback receives the
message as a packed `(byte_list, delta_time)` tuple, not a bare byte list.
Iterating that tuple crashes with `ord() expected string of length 1, but list
found` inside the rtmidi thread; the exception kills the delivery thread and
the simulator silently shows 0 messages. Always normalize with
`unwrap_message()` (in `push_lcd_simulator.py`) before parsing bytes.

**Gotcha 3 (curses `addnstr` overload, simulator rendering):** Python curses
signatures are `addstr([y,x,] str[, attr])` and `addnstr([y,x,] str, n[, attr])`.
A helper in the simulator used `stdscr.addnstr(y, x, text, attr)` — with four
positional args the 4th is parsed as `n` (max chars), NOT attr. Result: text
with `attr=0` (plain printable LCD content, log entries, footer) wrote **zero**
characters (invisible), while text with a nonzero attr (special `·` bytes,
status bar, log header) "worked". Symptom on the digital display: `·` dots are
visible but printable text (fader `[######]`, legends, charmap 32-126) never
shows, and the SysEx log panel looks empty. Fix: pre-slice and use
`stdscr.addstr(y, x, text[:limit], attr)` (addstr has no `n`). Verified by
testing both variants and by pty screen reconstruction.

## SysEx Capture Validation

Reference captures in `sysextests/`:
- `clip selection none.syx` — Confirms line 0x1A (line 3) text rendering
- `randomlvls.syx` — Confirms line 0x1B (line 4) text rendering
- Both use header `F0 47 7F 15` — validated against Push 1 hardware

## Common Patterns

### Periodic LCD Update (VU Meters)
```javascript
var timerId = engine.beginTimer(50, function() {
    var vuL = engine.getValue("[Channel1]", "vu_meter_left");
    var vuR = engine.getValue("[Channel1]", "vu_meter_right");
    sendLCDLine(1, "L: " + formatVu(vuL) + "  R: " + formatVu(vuR));
});
// Stop: engine.stopTimer(timerId);
```

### Connecting to Mixxx Controls
```javascript
var connection = engine.makeConnection("[Channel1]", "bpm", function(value) {
    sendLCDLine(2, "BPM: " + value.toFixed(1));
});
// Disconnect: connection.disconnect();
```

### Sending MIDI from Script
```javascript
midi.sendShortMsg(0x90, 0x01, 0x7F); // Note On, channel 1, note 1, velocity 127
midi.sendSysexMsg([0xF0, 0x47, 0x7F, 0x15, ...], length);
```
