# Push 1 LCD SysEx Protocol

## Hardware Specifications

- **Display**: 4 lines of text
- **Characters per line**: 68
- **Character range**: 0-127 (all values render, not just ASCII 32-126)
- **Connection**: USB MIDI (Live Port for SysEx from computer to Push)

## SysEx Message Format

Total message length: **77 bytes**

```
Byte:   0    1    2    3    4    5    6    7    8...75  76
Value: F0   47   7F   15   LN   00   45   00   CHARS   F7
```

| Byte | Hex | Dec | Description |
|------|-----|-----|-------------|
| 0 | 0xF0 | 240 | SysEx start |
| 1 | 0x47 | 71 | Ableton manufacturer ID |
| 2 | 0x7F | 127 | Device ID (broadcast to all) |
| 3 | 0x15 | 21 | Message type (LCD text) |
| 4 | LN | varies | Line number (see table) |
| 5 | 0x00 | 0 | Padding |
| 6 | 0x45 | 69 | Sub-message type (text write) |
| 7 | 0x00 | 0 | Padding |
| 8-75 | varies | varies | 68 character bytes (ASCII 0-127) |
| 76 | 0xF7 | 247 | SysEx end |

## Line Numbers

| Display Line | Hex | Decimal |
|-------------|-----|---------|
| Line 1 (top) | 0x18 | 24 |
| Line 2 | 0x19 | 25 |
| Line 3 | 0x1A | 26 |
| Line 4 (bottom) | 0x1B | 27 |

## Character Set

All 128 values (0-127) are renderable on the LCD. The character map includes:

| Range | Description |
|-------|-------------|
| 0-31 | Control characters / special symbols (render differently than ASCII) |
| 32 | Space |
| 33-47 | Punctuation: ! " # $ % & ' ( ) * + , - . / |
| 48-57 | Digits: 0-9 |
| 58-64 | More punctuation: : ; < = > ? @ |
| 65-90 | Uppercase: A-Z |
| 91-96 | Brackets and misc: [ \ ] ^ _ ` |
| 97-122 | Lowercase: a-z |
| 123-126 | Braces and tilde: { | } ~ |
| 127 | Special character |

**Important**: Characters 0-31 may render as graphical symbols on the Push 1 LCD, not as control codes. This is non-standard and useful for custom UI elements.

## Validated Captures

### clip selection none.syx (71 bytes)
```
F0 47 7F 15 1A 00 45 00
"Clip Selection:  [none]                     "
F7
```
Writes to line 3 (0x1A). The `[none]` text is rendered literally.

### randomlvls.syx (72 bytes)
```
F0 47 7F 15 1B 00 45 00
"1-MIDI  2-MIDI  3-Audio  4-Audio       A-Reverb B-Delay "
F7
```
Writes to line 4 (0x1B). Shows preset/screen layout names.

## Sending from Mixxx

### Basic Function
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

### Format Helpers
```javascript
function padRight(str, len) {
    while (str.length < len) str += ' ';
    return str.substring(0, len);
}

function padLeft(str, len) {
    while (str.length < len) str = ' ' + str;
    return str.substring(str.length - len);
}

function centerText(str, len) {
    var pad = len - str.length;
    var left = Math.floor(pad / 2);
    var right = pad - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
}
```

## Timing Considerations

- SysEx messages are slow over USB MIDI. Avoid sending more than ~20 SysEx messages per second.
- For VU meters, 50ms update interval (20 Hz) is the practical maximum.
- Queue messages if multiple lines need updating simultaneously.

## Notes

- Push 2 uses a completely different SysEx protocol (not compatible with Push 1).
- The LCD only updates when receiving SysEx. There is no "query" command to read current display state.
- The Push must be in User mode or receiving on the User Port for SysEx to work from Mixxx.
