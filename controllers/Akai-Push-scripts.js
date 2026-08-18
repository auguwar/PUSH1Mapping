/****************************************************************/
/*      Akai Push 1 MIDI controller script v0.1                 */
/*          For Mixxx 2.5.6                                     */
/*          Character Map Test                                   */
/*          Displays all 128 characters at once on LCD           */
/****************************************************************/

var AkaiPush = {};

// --- LCD Protocol Constants ---
AkaiPush.SYSEX_HEADER = [0xF0, 0x47, 0x7F, 0x15];
AkaiPush.SYSEX_TEXT_CMD = [0x00, 0x45, 0x00];
AkaiPush.SYSEX_END = 0xF7;
AkaiPush.LCD_LINE_BYTES = 68;
AkaiPush.LCD_LINES = 4;

// Line number mapping: Line 1=0x18, Line 2=0x19, Line 3=0x1A, Line 4=0x1B
AkaiPush.lineToByte = function(line) {
    return 0x17 + line;
};

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

// --- Character Map: All 128 chars at once ---

AkaiPush.renderAllChars = function() {
    // Line 1: chars 0-67 as glyphs
    var line1 = '';
    for (var i = 0; i < 68; i++) {
        line1 += String.fromCharCode(i);
    }
    AkaiPush.sendLCDLine(1, line1);

    // Line 2: chars 68-127 as glyphs
    var line2 = '';
    for (var j = 68; j < 128; j++) {
        line2 += String.fromCharCode(j);
    }
    AkaiPush.sendLCDLine(2, line2);

    // Line 3: range legend
    AkaiPush.sendLCDLine(3, '0x00-0x43 (0-67)     0x44-0x7F (68-127)');

    // Line 4: labels
    AkaiPush.sendLCDLine(4, 'ALL 128 CHARS  0-31=CTRL  32-126=ASCII  127=DEL');
};

// --- Entry Points ---

AkaiPush.init = function(id) {
    AkaiPush.clearLCD();
    AkaiPush.renderAllChars();
};

AkaiPush.shutdown = function() {
    AkaiPush.clearLCD();
};
