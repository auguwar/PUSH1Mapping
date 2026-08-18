# Components JS Reference

Components JS is a library for building MIDI controller mappings in Mixxx. It provides reusable classes for common control types.

## Setup

```xml
<scriptfiles>
    <file filename="lodash.mixxx.js"/>
    <file filename="midi-components-0.0.js"/>
    <file functionprefix="MyController" filename="MyController-Script.js"/>
</scriptfiles>
```

## Core Classes

### Component (Base)
All controls inherit from this.

**Properties:**
- `midi` — `[statusByte, noteNumber]` pair
- `group` — Mixxx group string (e.g., `"[Channel1]"`)
- `inKey` / `outKey` — Mixxx control object names
- `max` — Maximum MIDI value (default 127)

**Methods:**
- `input(channel, control, value, status, group)` — Called on MIDI input
- `output(value, group, control)` — Called on Mixxx state change
- `send(value)` — Send MIDI output via `midi.sendShortMsg()`
- `connect()` / `disconnect()` — Bind/unbind to Mixxx COs
- `trigger()` — Force output callback
- `inValueScale(value)` — Maps 0-127 to 0.0-1.0
- `outValueScale(value)` — Maps 0.0-1.0 to 0-127

**Shift system:**
- `shift()` / `unshift()` — Toggle shifted state
- `sendShifted` — Send shifted MIDI output
- `shiftChannel` / `shiftControl` — Offset MIDI channel/control when shifted

### Button
Extends Component. Types: `push` (momentary), `toggle`, `powerWindow`.

```javascript
var playBtn = new components.Button({
    midi: [0x90, 0x01],
    type: "push",
    inKey: "play",
    outKey: "play_indicator"
});
```

**Specialized Buttons:**
- `PlayButton` — Play/pause, shift=reverse
- `CueButton` — Cue, shift=stop
- `SyncButton` — Sync, shift=toggle sync lock
- `LoopToggleButton` — Loop on/off
- `HotcueButton` — Set/jump hotcue, shift=delete. Requires `number` property.

### Pot
For faders and knobs with finite range.

```javascript
var volume = new components.Pot({
    midi: [0xB0, 0x07],
    inKey: "volume",
    softTakeover: true
});
```

- Supports 14-bit MIDI via `inputLSB` / `inputMSB`
- `relative` mode for knobs centered at 64

### Encoder
For infinite rotary encoders.

```javascript
var browseEncoder = new components.Encoder({
    midi: [0xB0, 0x10],
    inKey: "MoveTrackPointer",  // custom handler needed
});
```

### JogWheelBasic
```javascript
this.jogWheel = components.JogWheelBasic({
    deck: 1,
    wheelResolution: 1000,
    alpha: 1/8,
    beta: 1/8/32,
    rpm: 33 + 1/3
});
```
Map `inputWheel` for rotation and `inputTouch` for touch detection.

## Containers

### ComponentContainer
Manages collections of Components.

```javascript
var container = new components.ComponentContainer({
    button1: new components.Button({...}),
    knob1: new components.Pot({...})
});
container.shift();    // Shift all children
container.unshift(); // Unshift all children
```

**Key Methods:**
- `forEachComponent(operation, recursive)` — Iterate over all Components
- `reconnectComponents(operation)` — Disconnect, apply operation, reconnect
- `applyLayer(newLayer)` — Swap component properties dynamically
- `shutdown()` — Call shutdown on all children

### Deck
Extends ComponentContainer for deck-specific controls.

```javascript
MyController.Deck = function(deckNumbers, midiChannel) {
    components.Deck.call(this, deckNumbers);
    this.playButton = new components.PlayButton([0x90 + midiChannel, 0x01]);
    this.cueButton = new components.CueButton([0x90 + midiChannel, 0x02]);
    this.volume = new components.Pot({
        midi: [0xB0 + midiChannel, 0x01],
        inKey: 'volume'
    });
    this.reconnectComponents(function(c) {
        if (c.group === undefined) c.group = this.currentDeck;
    });
};
MyController.Deck.prototype = new components.Deck();
```

- Constructor takes array of deck numbers: `[1, 3]`
- `setCurrentDeck(newGroup)` — Switch all controls to new deck
- `toggle()` — Cycle through available decks

### EffectUnit
Manages an entire effect unit with knobs, buttons, and focus.

```javascript
var fxUnit = new components.EffectUnit([1, 2]);
fxUnit.enableOnChannelButtons.addButton('[Channel1]');
fxUnit.init();
```

Contains:
- `dryWetKnob` — Master dry/wet
- `effectFocusButton` — Focus effect selection
- `enableButtons[1-3]` — Effect enable toggles
- `knobs[1-3]` — Effect parameter knobs

## Full Example: Controller Script

```javascript
var MyPush = {};

MyPush.init = function(id) {
    MyPush.deck = new MyPush.Deck([1, 2, 3, 4]);
    MyPush.sendLCDLine(1, "Push 1 Ready");
};

MyPush.shutdown = function() {
    MyPush.clearLCD();
};

// --- LCD Functions ---
MyPush.sendLCDLine = function(line, text) {
    var lineNum = 0x17 + line;
    var msg = [0xF0, 0x47, 0x7F, 0x15, lineNum, 0x00, 0x45, 0x00];
    text = text.substring(0, 68);
    while (text.length < 68) text += ' ';
    for (var i = 0; i < 68; i++) {
        msg.push(text.charCodeAt(i));
    }
    msg.push(0xF7);
    midi.sendSysexMsg(msg, msg.length);
};

MyPush.clearLCD = function() {
    for (var line = 1; line <= 4; line++) {
        MyPush.sendLCDLine(line, "");
    }
};

// --- Deck ---
MyPush.Deck = function(deckNumbers) {
    components.Deck.call(this, deckNumbers);
    this.playButton = new components.PlayButton([0x90, 0x01]);
    this.cueButton = new components.CueButton([0x90, 0x02]);
    this.volume = new components.Pot({
        midi: [0xB0, 0x07],
        inKey: 'volume'
    });
    this.reconnectComponents(function(c) {
        if (c.group === undefined) c.group = this.currentDeck;
    });
};
MyPush.Deck.prototype = new components.Deck();
```
