/****************************************************************/
/*      Akai Push 1 MIDI controller script v0.4                 */
/*          For Mixxx 2.5.6                                     */
/*          Stage 2: Mixer view (Deck 1 + Deck 2)               */
/*                                                              */
/*      Display: 4 physical segments of 17 chars (8+1+8 knobs)  */
/*      Line 1: EQ/Volume percentages per knob (segmented)      */
/*      Line 2: Labels LOW MID HI VOL per knob (segmented)      */
/*      Line 3: Pre-master VU (16) + CH remaining time + [L]    */
/*      Line 4: Reserved for future use                         */
/****************************************************************/

var AkaiPush = {};

// --- LCD Protocol Constants ---
AkaiPush.SYSEX_HEADER = [0xF0, 0x47, 0x7F, 0x15];
AkaiPush.SYSEX_TEXT_CMD = [0x00, 0x45, 0x00];
AkaiPush.SYSEX_END = 0xF7;
AkaiPush.LCD_LINE_BYTES = 68;

// Line number mapping: Line 1=0x18, Line 2=0x19, Line 3=0x1A, Line 4=0x1B
AkaiPush.lineToByte = function(line) {
    return 0x17 + line;
};

// --- State ---
AkaiPush.connections = [];

// Pre-master VU meter state (one shared stereo bar per deck).
AkaiPush.VU_BAR_WIDTH = 16;
AkaiPush.VU_HOLD_TICKS = 6;   // ~300ms at 50ms/tick: peak stays fixed before decay
AkaiPush.VU_DECAY = 0.85;     // decay factor per tick after the hold period
AkaiPush.vuShown = { d1: 0, d2: 0 };     // displayed level (with peak-hold) per deck
AkaiPush.vuHoldLeft = { d1: 0, d2: 0 };  // ticks of fixed-hold remaining per deck
AkaiPush.vuTimerId = null;
AkaiPush.infoTimerId = null;    // 1s timer for the remaining-time text

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
    for (var line = 1; line <= 4; line++) {
        AkaiPush.sendLCDLine(line, "");
    }
};

// --- Utility ---

// Pads str to len with spaces on the right (or truncates)
AkaiPush.padRight = function(str, len) {
    while (str.length < len) str += ' ';
    return str.substring(0, len);
};

// --- Display Update ---

// Physical display layout (MANDATORY): the 68-char line splits into 4 segments
// of 17 chars, each under 2 of the 8 knobs: 8 (left knob) + 1 space + 8 (right
// knob). Content is centered within each 8-char block; the separator is always
// the literal space character.
//   seg1: d1LOW,d1MID | seg2: d1HI,d1VOL | seg3: d2LOW,d2MID | seg4: d2HI,d2VOL
//   Line 1: percents   "  75%     50%    ..." (centered per 8-char block)
//   Line 2: labels     "  LOW    MID     ..."
//   Line 3: VU bar (16) in cols 0-15/34-49, "CH A -MM:SS [L]" centered in 17-33/51-67

AkaiPush.BLOCK_W = 8;         // width of one knob field
AkaiPush.SEG_W = 17;          // one physical segment (8 + 1 + 8)

// Centers str in width with spaces (left gets the extra space when odd).
AkaiPush.centerIn = function(str, width) {
    str = String(str);
    var pad = width - str.length;
    if (pad <= 0) return str.substring(0, width);
    var left = Math.floor(pad / 2);
    var line = '';
    while (left-- > 0) line += ' ';
    line += str;
    while (line.length < width) line += ' ';
    return line;
};

// Mixxx EQ filters (filterLow/filterMid/filterHigh): raw range 0.0-4.0,
// neutral at 1.0. Map to a symmetric percentage around the neutral (100%):
//   cut 0..1 -> 0%..100%,  boost 1..4 -> 100%..200%.
AkaiPush.eqPercent = function(raw) {
    if (raw < 0) raw = 0;
    if (raw > 4) raw = 4;
    if (raw <= 1.0) return Math.round(raw * 100);
    return Math.round(100 + (raw - 1.0) * (100 / 3));
};

AkaiPush.updateDisplay = function() {
    // Channel 1
    var vL1 = AkaiPush.eqPercent(engine.getValue('[Channel1]', 'filterLow'));
    var vM1 = AkaiPush.eqPercent(engine.getValue('[Channel1]', 'filterMid'));
    var vH1 = AkaiPush.eqPercent(engine.getValue('[Channel1]', 'filterHigh'));
    var vV1 = Math.round(engine.getValue('[Channel1]', 'volume') * 100);

    // Channel 2
    var vL2 = AkaiPush.eqPercent(engine.getValue('[Channel2]', 'filterLow'));
    var vM2 = AkaiPush.eqPercent(engine.getValue('[Channel2]', 'filterMid'));
    var vH2 = AkaiPush.eqPercent(engine.getValue('[Channel2]', 'filterHigh'));
    var vV2 = Math.round(engine.getValue('[Channel2]', 'volume') * 100);

    // Line 1: percents, one 8-char block per knob, centered, knobs separated
    // by a single space. Knob order: d1LOW, d1MID, d1HI, d1VOL, d2LOW, d2MID,
    // d2HI, d2VOL (8 values in the 4 physical segments).
    var vals = [
        vL1 + '%', vM1 + '%', vH1 + '%', vV1 + '%',
        vL2 + '%', vM2 + '%', vH2 + '%', vV2 + '%'
    ];
    var line1 = '';
    for (var i = 0; i < vals.length; i++) {
        if (i % 2 === 1) line1 += ' ';   // physical space before the 2nd knob of a segment
        line1 += AkaiPush.centerIn(vals[i], AkaiPush.BLOCK_W);
    }
    line1 = AkaiPush.padRight(line1, AkaiPush.LCD_LINE_BYTES);

    // Line 2: labels, one per knob, centered under its percent.
    var labels = ['LOW', 'MID', 'HI', 'VOL', 'LOW', 'MID', 'HI', 'VOL'];
    var line2 = '';
    for (var j = 0; j < labels.length; j++) {
        if (j % 2 === 1) line2 += ' ';   // physical space before the 2nd knob of a segment
        line2 += AkaiPush.centerIn(labels[j], AkaiPush.BLOCK_W);
    }
    line2 = AkaiPush.padRight(line2, AkaiPush.LCD_LINE_BYTES);

    AkaiPush.sendLCDLine(1, line1);
    AkaiPush.sendLCDLine(2, line2);
};

// --- VU Meter + Deck Info (line 3) ---

// Renders a horizontal bar "#" (filled) / "-" (empty) for a 0..1 level.
AkaiPush.renderVuBar = function(level, width) {
    if (level < 0) level = 0;
    if (level > 1) level = 1;
    var filled = Math.round(level * width);
    var bar = '';
    for (var i = 0; i < width; i++) {
        bar += (i < filled) ? '#' : '-';
    }
    return bar;
};

// Formats seconds remaining as "-MM:SS" (minutes capped at 99, no hours).
AkaiPush.formatRemaining = function(sec) {
    if (sec < 0) sec = 0;
    var total = Math.round(sec);
    var m = Math.floor(total / 60);
    if (m > 99) m = 99;
    var s = total % 60;
    var mm = (m < 10 ? '0' : '') + m;
    var ss = (s < 10 ? '0' : '') + s;
    return '-' + mm + ':' + ss;
};

// Seconds remaining on a deck track, or null when no valid duration.
AkaiPush.deckRemaining = function(group) {
    var dur = engine.getValue(group, 'duration');
    if (!dur || dur <= 0) return null;
    var pos = engine.getValue(group, 'playposition');
    if (pos < 0) pos = 0;
    if (pos > 1) pos = 1;
    return dur - pos * dur;
};

// True when the deck has an active loop whose indicator "L" should show.
AkaiPush.deckInLoop = function(group) {
    return !!engine.getValue(group, 'loop_enabled');
};

// Builds the deck label "CH A -04:33" (or "CH A ---:--" when no track),
// appending " L" while the deck is in an active loop.
AkaiPush.renderDeckInfo = function(deckNum, remainingSec, loop) {
    var letter = String.fromCharCode(64 + deckNum);  // 1->'A', 2->'B', 3->'C', 4->'D'
    var count = (remainingSec === null) ? '---:--' : AkaiPush.formatRemaining(remainingSec);
    var text = 'CH ' + letter + ' ' + count;
    if (loop) text += ' L';
    return text;
};

// Updates the displayed VU levels (peak-hold) for both decks. Does not send.
AkaiPush.updateVu = function() {
    // Combined stereo level per deck = max(left, right).
    var t1 = Math.max(engine.getValue('[Channel1]', 'vu_meter_left'),
                      engine.getValue('[Channel1]', 'vu_meter_right'));
    var t2 = Math.max(engine.getValue('[Channel2]', 'vu_meter_left'),
                      engine.getValue('[Channel2]', 'vu_meter_right'));

    var shown1 = AkaiPush.vuShown.d1;
    var shown2 = AkaiPush.vuShown.d2;

    if (t1 >= shown1) {
        // Rising / new peak: attack instantly and refresh the hold.
        shown1 = t1;
        AkaiPush.vuHoldLeft.d1 = AkaiPush.VU_HOLD_TICKS;
    } else if (AkaiPush.vuHoldLeft.d1 > 0) {
        // Falling level but still in the fixed-hold window: keep the peak fixed.
        AkaiPush.vuHoldLeft.d1--;
    } else {
        // Hold expired: decay slowly toward the current level.
        shown1 = Math.max(t1, shown1 * AkaiPush.VU_DECAY);
    }

    if (t2 >= shown2) {
        shown2 = t2;
        AkaiPush.vuHoldLeft.d2 = AkaiPush.VU_HOLD_TICKS;
    } else if (AkaiPush.vuHoldLeft.d2 > 0) {
        AkaiPush.vuHoldLeft.d2--;
    } else {
        shown2 = Math.max(t2, shown2 * AkaiPush.VU_DECAY);
    }

    AkaiPush.vuShown.d1 = shown1;
    AkaiPush.vuShown.d2 = shown2;
};

// Composes line 3 (VU bar + deck info per deck) and sends it.
AkaiPush.sendLine3 = function() {
    var r1 = AkaiPush.deckRemaining('[Channel1]');
    var r2 = AkaiPush.deckRemaining('[Channel2]');
    var d1 = AkaiPush.renderDeckInfo(1, r1, AkaiPush.deckInLoop('[Channel1]'));
    var d2 = AkaiPush.renderDeckInfo(2, r2, AkaiPush.deckInLoop('[Channel2]'));

    // Physical layout (4x17): each deck spans 2 segments. Deck 1 = segments
    // 1-2 (cols 0-33): 16-char VU bar in cols 0-15, col 16 = closing space,
    // info centered in segment 2 (17-33). Deck 2 = segments 3-4 (cols 34-67).
    var half1 = AkaiPush.renderVuBar(AkaiPush.vuShown.d1, AkaiPush.VU_BAR_WIDTH)
              + ' '
              + AkaiPush.centerIn(d1, AkaiPush.SEG_W);
    var half2 = AkaiPush.renderVuBar(AkaiPush.vuShown.d2, AkaiPush.VU_BAR_WIDTH)
              + ' '
              + AkaiPush.centerIn(d2, AkaiPush.SEG_W);
    var line3 = AkaiPush.padRight(half1 + half2, AkaiPush.LCD_LINE_BYTES);

    AkaiPush.sendLCDLine(3, line3);
};

// --- Entry Points ---

AkaiPush.init = function(id) {
    AkaiPush.clearLCD();
    AkaiPush.connections = [];

    // Deck 1: filterLow, filterMid, filterHigh, volume
    AkaiPush.connections.push(engine.makeConnection('[Channel1]', 'filterLow',  function() { AkaiPush.updateDisplay(); }));
    AkaiPush.connections.push(engine.makeConnection('[Channel1]', 'filterMid',  function() { AkaiPush.updateDisplay(); }));
    AkaiPush.connections.push(engine.makeConnection('[Channel1]', 'filterHigh', function() { AkaiPush.updateDisplay(); }));
    AkaiPush.connections.push(engine.makeConnection('[Channel1]', 'volume',     function() { AkaiPush.updateDisplay(); }));

    // Deck 2: filterLow, filterMid, filterHigh, volume
    AkaiPush.connections.push(engine.makeConnection('[Channel2]', 'filterLow',  function() { AkaiPush.updateDisplay(); }));
    AkaiPush.connections.push(engine.makeConnection('[Channel2]', 'filterMid',  function() { AkaiPush.updateDisplay(); }));
    AkaiPush.connections.push(engine.makeConnection('[Channel2]', 'filterHigh', function() { AkaiPush.updateDisplay(); }));
    AkaiPush.connections.push(engine.makeConnection('[Channel2]', 'volume',     function() { AkaiPush.updateDisplay(); }));

    // Loop state drives the "L" indicator on line 3: redraw immediately so the
    // indicator does not wait for the 1s info timer.
    AkaiPush.connections.push(engine.makeConnection('[Channel1]', 'loop_enabled', function() { AkaiPush.sendLine3(); }));
    AkaiPush.connections.push(engine.makeConnection('[Channel2]', 'loop_enabled', function() { AkaiPush.sendLine3(); }));

    // Initial render with current values
    AkaiPush.updateDisplay();

    // Periodic VU meter update (needed so the held peak decays even when the
    // signal stops emitting change events).
    AkaiPush.vuTimerId = engine.beginTimer(50, function() { AkaiPush.updateVu(); AkaiPush.sendLine3(); });
    // 1s timer for the remaining-time text (MM:SS only changes per second).
    AkaiPush.infoTimerId = engine.beginTimer(1000, function() { AkaiPush.sendLine3(); });
    AkaiPush.updateVu();
    AkaiPush.sendLine3();
};

AkaiPush.shutdown = function() {
    if (AkaiPush.vuTimerId !== null) {
        engine.stopTimer(AkaiPush.vuTimerId);
        AkaiPush.vuTimerId = null;
    }
    if (AkaiPush.infoTimerId !== null) {
        engine.stopTimer(AkaiPush.infoTimerId);
        AkaiPush.infoTimerId = null;
    }
    for (var i = 0; i < AkaiPush.connections.length; i++) {
        AkaiPush.connections[i].disconnect();
    }
    AkaiPush.connections = [];
    AkaiPush.clearLCD();
};
