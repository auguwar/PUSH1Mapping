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
