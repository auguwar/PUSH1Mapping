/****************************************************************/
/*      Akai Push 1 MIDI controller script v0.2                 */
/*          For Mixxx 2.5.6                                     */
/*          Stage 1: Character map + EQ Low fader                */
/*                                                              */
/*      Line 1: Live fader showing [Channel1].filterLow          */
/*      Lines 2-3: All 128 LCD characters                        */
/*      Line 4: Legend                                           */
/****************************************************************/

var AkaiPush = {};

// --- LCD Protocol Constants ---
AkaiPush.SYSEX_HEADER = [0xF0, 0x47, 0x7F, 0x15];
AkaiPush.SYSEX_TEXT_CMD = [0x00, 0x45, 0x00];
AkaiPush.SYSEX_END = 0xF7;
AkaiPush.LCD_LINE_BYTES = 68;
AkaiPush.LCD_LINES = 4;

// Fader configuration (8 chars total: [ + 6 inner + ])
AkaiPush.FADER_WIDTH = 6;   // inner chars between brackets
AkaiPush.FADER_FILL = '#';
AkaiPush.FADER_EMPTY = '-';

// Line number mapping: Line 1=0x18, Line 2=0x19, Line 3=0x1A, Line 4=0x1B
AkaiPush.lineToByte = function(line) {
    return 0x17 + line;
};

// --- State ---
AkaiPush.filterLowConn = null;

// --- LCD Functions ---

AkaiPush.sendLCDLine = function(line, text) {
    var lineNum = AkaiPush.lineToByte(line);
    var msg = AkaiPush.SYSEX_HEADER.concat([lineNum]).concat(AkaiPush.SYSEX_TEXT_CMD);

    text = text.substring(0, AkaiPush.LCD_LINE_BYTES);
    while (text.length < AkaiPush.LCD_LINE_BYTES) {
        text += ' ';
    }

    for (var i = 0; i < AkaiPush.LCD_LINE_BYTES; i++) {
        msg.push(text.charCodeAt(i));
    }
    msg.push(AkaiPush.SYSEX_END);
    midi.sendSysexMsg(msg, msg.length);
};

AkaiPush.clearLCD = function() {
    for (var line = 1; line <= AkaiPush.LCD_LINES; line++) {
        AkaiPush.sendLCDLine(line, "");
    }
};

// --- Utility ---

AkaiPush.padRight = function(str, len) {
    while (str.length < len) str += ' ';
    return str.substring(0, len);
};

// --- Fader Rendering ---

// Builds an 8-char bar like "[###---]" from a 0-1 value
AkaiPush.renderFaderBar = function(value) {
    if (value < 0) value = 0;
    if (value > 1) value = 1;

    var filled = Math.round(value * AkaiPush.FADER_WIDTH);
    var bar = '[';
    for (var i = 0; i < AkaiPush.FADER_WIDTH; i++) {
        bar += (i < filled) ? AkaiPush.FADER_FILL : AkaiPush.FADER_EMPTY;
    }
    bar += ']';
    return bar;
};

// Renders line 1 with fader + label + percentage
AkaiPush.updateFaderLine = function(value) {
    var fader = AkaiPush.renderFaderBar(value);
    var pct = Math.round(value * 100);
    var text = fader + ' LOW CH1 ' + pct + '%';
    AkaiPush.sendLCDLine(1, text);
};

// --- Character Map (lines 2-4) ---

AkaiPush.renderAllChars = function() {
    // Line 2: chars 0-67 as glyphs
    var line2 = '';
    for (var i = 0; i < 68; i++) {
        line2 += String.fromCharCode(i);
    }
    AkaiPush.sendLCDLine(2, line2);

    // Line 3: chars 68-127 as glyphs
    var line3 = '';
    for (var j = 68; j < 128; j++) {
        line3 += String.fromCharCode(j);
    }
    AkaiPush.sendLCDLine(3, line3);

    // Line 4: legend
    AkaiPush.sendLCDLine(4, 'ALL 128 CHARS  0-31=CTRL  32-126=ASCII  127=DEL');
};

// --- Entry Points ---

AkaiPush.init = function(id) {
    AkaiPush.clearLCD();
    AkaiPush.renderAllChars();

    // Connect [Channel1].filterLow to fader display (line 1)
    AkaiPush.filterLowConn = engine.makeConnection('[Channel1]', 'filterLow', function(value) {
        AkaiPush.updateFaderLine(value);
    });

    // Trigger initial render with current value
    AkaiPush.updateFaderLine(engine.getValue('[Channel1]', 'filterLow'));
};

AkaiPush.shutdown = function() {
    if (AkaiPush.filterLowConn !== null) {
        AkaiPush.filterLowConn.disconnect();
        AkaiPush.filterLowConn = null;
    }
    AkaiPush.clearLCD();
};
