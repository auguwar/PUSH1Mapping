/****************************************************************/
/*      SysEx Validation Tests for Push 1 LCD                   */
/*          Run in Mixxx's script console for validation         */
/*                                                              */
/*      These functions validate that SysEx messages match       */
/*      the Push 1 protocol spec. Use to debug before           */
/*      sending to hardware.                                     */
/****************************************************************/

var SysExTest = {};

SysExTest.PUSH1_HEADER = [0xF0, 0x47, 0x7F, 0x15];
SysExTest.TEXT_CMD = [0x00, 0x45, 0x00];
SysExTest.SYSEX_END = 0xF7;
SysExTest.LINE_BYTES = 68;

// --- Test Helpers ---

SysExTest.assert = function(condition, testName) {
    if (condition) {
        print('[PASS] ' + testName);
    } else {
        print('[FAIL] ' + testName);
    }
};

SysExTest.assertEq = function(actual, expected, testName) {
    if (actual === expected) {
        print('[PASS] ' + testName);
    } else {
        print('[FAIL] ' + testName + ' - Expected: ' + expected + ', Got: ' + actual);
    }
};

SysExTest.assertArrayEq = function(actual, expected, testName) {
    if (actual.length !== expected.length) {
        print('[FAIL] ' + testName + ' - Length mismatch: ' + actual.length + ' vs ' + expected.length);
        return;
    }
    for (var i = 0; i < actual.length; i++) {
        if (actual[i] !== expected[i]) {
            print('[FAIL] ' + testName + ' - Byte ' + i + ' mismatch: ' + actual[i] + ' vs ' + expected[i]);
            return;
        }
    }
    print('[PASS] ' + testName);
};

// --- Build SysEx Message (same logic as AkaiPush.sendLCDLine) ---

SysExTest.buildLCDMessage = function(line, text) {
    var lineNum = 0x17 + line;
    var msg = SysExTest.PUSH1_HEADER.concat([lineNum]).concat(SysExTest.TEXT_CMD);

    text = text.substring(0, SysExTest.LINE_BYTES);
    while (text.length < SysExTest.LINE_BYTES) {
        text += ' ';
    }

    for (var i = 0; i < SysExTest.LINE_BYTES; i++) {
        msg.push(text.charCodeAt(i));
    }
    msg.push(SysExTest.SYSEX_END);
    return msg;
};

// --- Validation Tests ---

SysExTest.testMessageLength = function() {
    var msg = SysExTest.buildLCDMessage(1, 'Hello World');
    SysExTest.assertEq(msg.length, 77, 'LCD message is exactly 77 bytes');
};

SysExTest.testMessageStructure = function() {
    var msg = SysExTest.buildLCDMessage(1, 'Test');
    SysExTest.assertEq(msg[0], 0xF0, 'Byte 0: SysEx start');
    SysExTest.assertEq(msg[1], 0x47, 'Byte 1: Ableton manufacturer ID');
    SysExTest.assertEq(msg[2], 0x7F, 'Byte 2: Device ID (broadcast)');
    SysExTest.assertEq(msg[3], 0x15, 'Byte 3: Message type');
    SysExTest.assertEq(msg[76], 0xF7, 'Byte 76: SysEx end');
};

SysExTest.testLineNumbers = function() {
    var line1 = SysExTest.buildLCDMessage(1, '');
    var line2 = SysExTest.buildLCDMessage(2, '');
    var line3 = SysExTest.buildLCDMessage(3, '');
    var line4 = SysExTest.buildLCDMessage(4, '');

    SysExTest.assertEq(line1[4], 0x18, 'Line 1 maps to 0x18');
    SysExTest.assertEq(line2[4], 0x19, 'Line 2 maps to 0x19');
    SysExTest.assertEq(line3[4], 0x1A, 'Line 3 maps to 0x1A');
    SysExTest.assertEq(line4[4], 0x1B, 'Line 4 maps to 0x1B');
};

SysExTest.testTextPadding = function() {
    var msg = SysExTest.buildLCDMessage(1, 'Hi');
    var charBytes = msg.slice(8, 76);
    var text = '';
    for (var i = 0; i < charBytes.length; i++) {
        text += String.fromCharCode(charBytes[i]);
    }
    SysExTest.assertEq(text.substring(0, 2), 'Hi', 'Text starts correctly');
    SysExTest.assertEq(text.charAt(2), ' ', 'Text is padded with spaces');
    SysExTest.assertEq(text.length, 68, 'Text field is 68 chars');
};

SysExTest.testTextTruncation = function() {
    var longText = '';
    for (var i = 0; i < 100; i++) longText += 'A';
    var msg = SysExTest.buildLCDMessage(1, longText);
    var charBytes = msg.slice(8, 76);
    var allA = true;
    for (var j = 0; j < 68; j++) {
        if (charBytes[j] !== 65) { // 65 = 'A'
            allA = false;
            break;
        }
    }
    SysExTest.assert(allA, 'Long text is truncated to 68 chars');
};

SysExTest.testCharacterRange = function() {
    // Test that all characters 0-127 can be encoded
    var allChars = '';
    for (var i = 0; i < 128; i++) {
        allChars += String.fromCharCode(i);
    }
    var msg = SysExTest.buildLCDMessage(1, allChars);
    SysExTest.assertEq(msg.length, 77, 'All 128 characters encode correctly');
};

SysExTest.testReferenceCaptureClipSelection = function() {
    // Validate against captured: "clip selection none.syx" (line 3, 0x1A).
    // 8-byte header + 68 text chars + F7 = 77 bytes total.
    var captured = [0xF0, 0x47, 0x7F, 0x15, 0x1A, 0x00, 0x45, 0x00,
                    0x43, 0x6C, 0x69, 0x70, 0x20, 0x53, 0x65, 0x6C,
                    0x65, 0x63, 0x74, 0x69, 0x6F, 0x6E, 0x3A, 0x20,
                    0x20, 0x5B, 0x6E, 0x6F, 0x6E, 0x65, 0x5D, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0xF7];

    var built = SysExTest.buildLCDMessage(3, 'Clip Selection:  [none]');

    SysExTest.assertEq(captured.length, built.length, 'Captured vs built: same length');
    SysExTest.assertArrayEq(built, captured, 'Captured vs built: full message matches');
};

SysExTest.testReferenceCaptureRandomLevels = function() {
    // Validate against captured: "randomlvls.syx" (line 4, 0x1B).
    // 8-byte header + 68 text chars + F7 = 77 bytes total.
    var captured = [0xF0, 0x47, 0x7F, 0x15, 0x1B, 0x00, 0x45, 0x00,
                    0x31, 0x2D, 0x4D, 0x49, 0x44, 0x49, 0x20, 0x20,
                    0x20, 0x32, 0x2D, 0x4D, 0x49, 0x44, 0x49, 0x20,
                    0x20, 0x33, 0x2D, 0x41, 0x75, 0x64, 0x69, 0x6F,
                    0x20, 0x20, 0x34, 0x2D, 0x41, 0x75, 0x64, 0x69,
                    0x6F, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x41, 0x2D, 0x52, 0x65, 0x76,
                    0x65, 0x72, 0x62, 0x20, 0x42, 0x2D, 0x44, 0x65,
                    0x6C, 0x61, 0x79, 0x20, 0xF7];

    var built = SysExTest.buildLCDMessage(4, '1-MIDI   2-MIDI  3-Audio  4-Audio                  A-Reverb B-Delay ');

    SysExTest.assertEq(captured.length, built.length, 'Captured randomlvls vs built: same length');
    SysExTest.assertArrayEq(built, captured, 'Captured randomlvls vs built: full message matches');
};

// --- Mixer View Rendering Tests ---
//
// Mirrors the layout built in Akai-Push-scripts.js (v0.3):
//   68 chars = two clean halves of 32+2 (4 blocks of 8 per channel).
//   Line 1: percents, each left-aligned in an 8-char block.
//   Line 2: labels, each left-aligned in an 8-char block (under its percent).

SysExTest.padRight = function(str, len) {
    while (str.length < len) str += ' ';
    return str.substring(0, len);
};

SysExTest.BLOCK_W = 8;

// Build line 1 given 8 percentages (4 per channel); padded to 68 like the script
SysExTest.renderPercentLine = function(params) {
    var line = '';
    for (var i = 0; i < 8; i++) {
        line += SysExTest.padRight(params[i] + '%', SysExTest.BLOCK_W);
    }
    return SysExTest.padRight(line, 68);
};

// Build line 2 (labels); padded to 68 like the script
SysExTest.renderLabelLine = function() {
    var line = '';
    for (var i = 0; i < 8; i++) {
        line += SysExTest.padRight((i % 4 === 0) ? 'LOW' : (i % 4 === 1) ? 'MID' : (i % 4 === 2) ? 'HI' : 'VOL', SysExTest.BLOCK_W);
    }
    return SysExTest.padRight(line, 68);
};

SysExTest.testPercentLineAllZero = function() {
    var line = SysExTest.renderPercentLine([0, 0, 0, 0, 0, 0, 0, 0]);
    var exp = '';
    for (var i = 0; i < 8; i++) exp += SysExTest.padRight('0%', SysExTest.BLOCK_W);
    exp = SysExTest.padRight(exp, 68);
    SysExTest.assertEq(line.length, 68, 'Percent line is 68 chars');
    SysExTest.assertEq(line, exp, 'All-zero percentages render aligned');
};

SysExTest.testPercentLineMixed = function() {
    var vals = [75, 50, 100, 60, 80, 45, 90, 0];
    var line = SysExTest.renderPercentLine(vals);
    var exp = '';
    for (var i = 0; i < 8; i++) exp += SysExTest.padRight(vals[i] + '%', SysExTest.BLOCK_W);
    exp = SysExTest.padRight(exp, 68);
    SysExTest.assertEq(line.length, 68, 'Mixed percent line is 68 chars');
    SysExTest.assertEq(line, exp, 'Mixed percentages render correctly');
};

SysExTest.testPercentLineThreeDigits = function() {
    var vals = [100, 100, 100, 100, 100, 100, 100, 100];
    var line = SysExTest.renderPercentLine(vals);
    var exp = '';
    for (var i = 0; i < 8; i++) exp += SysExTest.padRight(vals[i] + '%', SysExTest.BLOCK_W);
    exp = SysExTest.padRight(exp, 68);
    SysExTest.assertEq(line.length, 68, 'Three-digit percent line is 68 chars');
    SysExTest.assertEq(line, exp, 'Three-digit (100%) percentages align');
};

SysExTest.testLabelLine = function() {
    var line = SysExTest.renderLabelLine();
    var exp = '';
    for (var i = 0; i < 8; i++) {
        exp += SysExTest.padRight((i % 4 === 0) ? 'LOW' : (i % 4 === 1) ? 'MID' : (i % 4 === 2) ? 'HI' : 'VOL', SysExTest.BLOCK_W);
    }
    exp = SysExTest.padRight(exp, 68);
    SysExTest.assertEq(line.length, 68, 'Label line is 68 chars');
    SysExTest.assertEq(line, exp, 'Labels render for both channels');
};

SysExTest.testPercentAndLabelAlign = function() {
    // Each label column must sit under its percentage column.
    // Blocks are 8 wide; each block contains one percent and one label, so
    // label at block i lines up with percent at block i.
    var l1 = SysExTest.renderPercentLine([10, 20, 30, 40, 50, 60, 70, 80]);
    var l2 = SysExTest.renderLabelLine();
    SysExTest.assertEq(l1.indexOf('10%'), 0, 'Ch1 LOW percent starts at block 0 (col 0)');
    SysExTest.assertEq(l2.indexOf('LOW'), 0, 'Ch1 LOW label starts at block 0 (col 0)');
    SysExTest.assertEq(l1.indexOf('50%'), 32, 'Ch2 LOW percent starts at block 4 (col 32)');
    SysExTest.assertEq(l2.indexOf('LOW', 8), 32, 'Ch2 LOW label starts at block 4 (col 32)');
};

// --- EQ Percent Mapping Tests ---
//
// Mirrors AkaiPush.eqPercent (v0.3). Mixxx EQ filters are raw 0.0-4.0 with
// neutral at 1.0. Display is symmetric around the neutral (100%):
//   cut 0..1 -> 0%..100%,  boost 1..4 -> 100%..200%.

SysExTest.eqPercent = function(raw) {
    if (raw < 0) raw = 0;
    if (raw > 4) raw = 4;
    if (raw <= 1.0) return Math.round(raw * 100);
    return Math.round(100 + (raw - 1.0) * (100 / 3));
};

SysExTest.testEqPercent = function() {
    SysExTest.assertEq(SysExTest.eqPercent(0), 0, 'Full cut (raw 0) shows 0%');
    SysExTest.assertEq(SysExTest.eqPercent(0.5), 50, 'Half cut (raw 0.5) shows 50%');
    SysExTest.assertEq(SysExTest.eqPercent(1.0), 100, 'Neutral (raw 1.0) shows 100%');
    SysExTest.assertEq(SysExTest.eqPercent(2.5), 150, 'Half boost (raw 2.5) shows 150%');
    SysExTest.assertEq(SysExTest.eqPercent(4.0), 200, 'Full boost (raw 4.0) shows 200%');
    SysExTest.assertEq(SysExTest.eqPercent(-0.5), 0, 'Clamps negative raw to 0%');
    SysExTest.assertEq(SysExTest.eqPercent(5.0), 200, 'Clamps raw above 4.0 to 200%');
};

SysExTest.testEqPercentBoundary = function() {
    // Values chosen to survive Math.round (avoid collapsing to 100).
    SysExTest.assertEq(SysExTest.eqPercent(1.02), 101, 'Just above neutral shows >100%');
    SysExTest.assertEq(SysExTest.eqPercent(0.98), 98, 'Just below neutral shows <100%');
};

// --- VU Meter Bar Tests ---
//
// Mirrors AkaiPush.renderVuBar (v0.3): horizontal "#" (filled) / "-" (empty)
// bar for a 0..1 level.

SysExTest.renderVuBar = function(level, width) {
    if (level < 0) level = 0;
    if (level > 1) level = 1;
    var filled = Math.round(level * width);
    var bar = '';
    for (var i = 0; i < width; i++) {
        bar += (i < filled) ? '#' : '-';
    }
    return bar;
};

SysExTest.testVuBar = function() {
    SysExTest.assertEq(SysExTest.renderVuBar(0, 16), '----------------', 'VU at 0% is all empty');
    SysExTest.assertEq(SysExTest.renderVuBar(1, 16), '################', 'VU at 100% is all full');
    SysExTest.assertEq(SysExTest.renderVuBar(0.5, 16), '########--------', 'VU at 50% is half full');
    SysExTest.assertEq(SysExTest.renderVuBar(0.25, 16), '####------------', 'VU at 25% is quarter full');
    SysExTest.assertEq(SysExTest.renderVuBar(-0.5, 16), '----------------', 'VU clamps negative levels');
    SysExTest.assertEq(SysExTest.renderVuBar(1.5, 16), '################', 'VU clamps levels above 1');
    SysExTest.assertEq(SysExTest.renderVuBar(0, 16).length, 16, 'VU bar is 16 chars wide');
};

// --- Deck Info / Remaining Time Tests ---
//
// Mirrors AkaiPush.formatRemaining / renderDeckInfo (v0.3).

SysExTest.formatRemaining = function(sec) {
    if (sec < 0) sec = 0;
    var total = Math.round(sec);
    var m = Math.floor(total / 60);
    if (m > 99) m = 99;
    var s = total % 60;
    var mm = (m < 10 ? '0' : '') + m;
    var ss = (s < 10 ? '0' : '') + s;
    return '-' + mm + ':' + ss;
};

SysExTest.renderDeckInfo = function(deckNum, remainingSec, loop) {
    var letter = String.fromCharCode(64 + deckNum);
    var count = (remainingSec === null) ? '---:--' : SysExTest.formatRemaining(remainingSec);
    var text = 'CH ' + letter + ' ' + count;
    if (loop) text += ' L';
    return text;
};

SysExTest.testFormatRemaining = function() {
    SysExTest.assertEq(SysExTest.formatRemaining(0), '-00:00', '0 seconds shows -00:00');
    SysExTest.assertEq(SysExTest.formatRemaining(45), '-00:45', '45 seconds shows -00:45');
    SysExTest.assertEq(SysExTest.formatRemaining(60), '-01:00', '60 seconds shows -01:00');
    SysExTest.assertEq(SysExTest.formatRemaining(5999), '-99:59', '5999 seconds shows the max -99:59');
    SysExTest.assertEq(SysExTest.formatRemaining(6000), '-99:00', '6000 seconds caps minutes at 99 (seconds stay 00)');
    SysExTest.assertEq(SysExTest.formatRemaining(60123), '-99:03', 'Large values cap minutes at 99');
    SysExTest.assertEq(SysExTest.formatRemaining(-5), '-00:00', 'Negative seconds clamp to 0');
    SysExTest.assertEq(SysExTest.formatRemaining(81.9), '-01:22', 'Rounds fractional seconds');
};

SysExTest.testRenderDeckInfo = function() {
    SysExTest.assertEq(SysExTest.renderDeckInfo(1, 300), 'CH A -05:00', 'Deck 1 maps to CH A with time');
    SysExTest.assertEq(SysExTest.renderDeckInfo(2, 67), 'CH B -01:07', 'Deck 2 maps to CH B with time');
    SysExTest.assertEq(SysExTest.renderDeckInfo(3, 90), 'CH C -01:30', 'Deck 3 maps to CH C');
    SysExTest.assertEq(SysExTest.renderDeckInfo(4, 90), 'CH D -01:30', 'Deck 4 maps to CH D');
    SysExTest.assertEq(SysExTest.renderDeckInfo(1, null), 'CH A ---:--', 'No track shows ---:--');
    SysExTest.assertEq(SysExTest.renderDeckInfo(1, 300, true), 'CH A -05:00 L', 'Active loop appends L');
    SysExTest.assertEq(SysExTest.renderDeckInfo(1, 300, false), 'CH A -05:00', 'No loop leaves it without L');
    SysExTest.assertEq(SysExTest.renderDeckInfo(1, null, true), 'CH A ---:-- L', 'Loop indicator works with no track');
    SysExTest.assertEq(SysExTest.renderDeckInfo(2, 90, true), 'CH B -01:30 L', 'Loop indicator on deck 2');
};

// --- Physical Segment Layout Tests (4 segments of 17 = 8 + 1 space + 8) ---
//
// Mirrors AkaiPush.centerIn and the segmented line builders (v0.4).

SysExTest.BLOCK_W = 8;
SysExTest.SEG_W = 17;
SysExTest.SEG_SEPARATOR_COLS = [8, 25, 42, 59];

SysExTest.centerIn = function(str, width) {
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

// Builds a full 68-char line from 8 knob values/labels with the physical
// single-space separator inserted before the even (2nd) knob of each segment.
SysExTest.buildSegmentedLine = function(blocks) {
    var line = '';
    for (var i = 0; i < blocks.length; i++) {
        if (i % 2 === 1) line += ' ';
        line += SysExTest.centerIn(blocks[i], SysExTest.BLOCK_W);
    }
    while (line.length < 68) line += ' ';
    return line;
};

// Builds line 3 for a deck: 16-char bar + space + info centered across 17.
SysExTest.buildDeckHalf = function(bar, info) {
    return bar + ' ' + SysExTest.centerIn(info, SysExTest.SEG_W);
};

SysExTest.testCenterIn = function() {
    SysExTest.assertEq(SysExTest.centerIn('75%', 8), '  75%   ', 'Center odd-width text in 8');
    SysExTest.assertEq(SysExTest.centerIn('200%', 8), '  200%  ', 'Center 3-char value in 8');
    SysExTest.assertEq(SysExTest.centerIn('LOW', 8), '  LOW   ', 'Center short label in 8');
    SysExTest.assertEq(SysExTest.centerIn('VOL', 8), '  VOL   ', 'Center VOL label in 8');
    SysExTest.assertEq(SysExTest.centerIn('HI', 8), '   HI   ', 'Center HI label in 8');
    SysExTest.assertEq(SysExTest.centerIn('12345678', 8), '12345678', 'Exact 8-char string unchanged');
    SysExTest.assertEq(SysExTest.centerIn('123456789', 8), '12345678', 'Overflow truncates to width');
    SysExTest.assertEq(SysExTest.centerIn('x', 1), 'x', 'Single char in width 1');
};

SysExTest.testSegmentedLine1 = function() {
    // d1LOW=50, d1MID=75, d1HI=200, d1VOL=60, d2LOW=10, d2MID=30, d2HI=100, d2VOL=80
    var blocks = ['50%', '75%', '200%', '60%', '10%', '30%', '100%', '80%'];
    var line = SysExTest.buildSegmentedLine(blocks);
    SysExTest.assertEq(line.length, 68, 'Line 1 is 68 chars');
    SysExTest.assertEq(line[8], ' ', 'Separator at col 8');
    SysExTest.assertEq(line[25], ' ', 'Separator at col 25');
    SysExTest.assertEq(line[42], ' ', 'Separator at col 42');
    SysExTest.assertEq(line[59], ' ', 'Separator at col 59');
    SysExTest.assertEq(line.slice(0, 8), '  50%   ', 'Seg1 left knob (d1 LOW)');
    SysExTest.assertEq(line.slice(9, 17), '  75%   ', 'Seg1 right knob (d1 MID)');
    SysExTest.assertEq(line.slice(17, 25), '  200%  ', 'Seg2 left knob (d1 HI)');
    SysExTest.assertEq(line.slice(26, 34), '  60%   ', 'Seg2 right knob (d1 VOL)');
    SysExTest.assertEq(line.slice(34, 42), '  10%   ', 'Seg3 left knob (d2 LOW)');
    SysExTest.assertEq(line.slice(43, 51), '  30%   ', 'Seg3 right knob (d2 MID)');
    SysExTest.assertEq(line.slice(51, 59), '  100%  ', 'Seg4 left knob (d2 HI)');
    SysExTest.assertEq(line.slice(60, 68), '  80%   ', 'Seg4 right knob (d2 VOL)');
};

SysExTest.testSegmentedLine2 = function() {
    var blocks = ['LOW', 'MID', 'HI', 'VOL', 'LOW', 'MID', 'HI', 'VOL'];
    var line = SysExTest.buildSegmentedLine(blocks);
    SysExTest.assertEq(line.length, 68, 'Line 2 is 68 chars');
    SysExTest.assertEq(line[8], ' ', 'Separator at col 8');
    SysExTest.assertEq(line[25], ' ', 'Separator at col 25');
    SysExTest.assertEq(line[42], ' ', 'Separator at col 42');
    SysExTest.assertEq(line[59], ' ', 'Separator at col 59');
    SysExTest.assertEq(line.slice(0, 8), '  LOW   ', 'Seg1 left knob label LOW');
    SysExTest.assertEq(line.slice(9, 17), '  MID   ', 'Seg1 right knob label MID');
    SysExTest.assertEq(line.slice(17, 25), '   HI   ', 'Seg2 left knob label HI');
    SysExTest.assertEq(line.slice(26, 34), '  VOL   ', 'Seg2 right knob label VOL');
    // Line 1 and line 2 use the same physical grid, so labels sit directly
    // under their percentages in the same columns.
    var line1 = SysExTest.buildSegmentedLine(['50%', '75%', '200%', '60%', '10%', '30%', '100%', '80%']);
    SysExTest.assertEq(line1.slice(0, 8), '  50%   ', 'Line1 seg1 left knob');
    SysExTest.assertEq(line.slice(0, 8), '  LOW   ', 'Line2 label aligned under same knob');
    SysExTest.assertEq(line1.indexOf('LOW'), -1, 'Percent line carries no label');
};

SysExTest.testSegmentedLine3 = function() {
    var d1Bar = SysExTest.renderVuBar(0.5, 16);
    var d2Bar = SysExTest.renderVuBar(0.25, 16);
    var half1 = SysExTest.buildDeckHalf(d1Bar, 'CH A -01:22 L');
    var half2 = SysExTest.buildDeckHalf(d2Bar, 'CH B ---:--');
    var line3 = SysExTest.padRight(half1 + half2, 68);
    SysExTest.assertEq(line3.length, 68, 'Line 3 is 68 chars');
    SysExTest.assertEq(line3.slice(0, 16), d1Bar, 'Deck1 VU bar occupies cols 0-15');
    SysExTest.assertEq(line3[16], ' ', 'Col 16 is the closing space');
    SysExTest.assertEq(line3.slice(17, 34), '  CH A -01:22 L  ', 'Deck1 info centered in segment 2');
    SysExTest.assertEq(line3.slice(34, 50), d2Bar, 'Deck2 VU bar occupies cols 34-49');
    SysExTest.assertEq(line3[50], ' ', 'Col 50 is the closing space');
    SysExTest.assertEq(line3.slice(51, 68), '   CH B ---:--   ', 'Deck2 info centered in segment 4');
};

// --- Run All Tests ---

SysExTest.runAll = function() {
    print('=== Push 1 SysEx Validation Tests ===');
    SysExTest.testMessageLength();
    SysExTest.testMessageStructure();
    SysExTest.testLineNumbers();
    SysExTest.testTextPadding();
    SysExTest.testTextTruncation();
    SysExTest.testCharacterRange();
    SysExTest.testReferenceCaptureClipSelection();
    SysExTest.testReferenceCaptureRandomLevels();
    SysExTest.testPercentLineAllZero();
    SysExTest.testPercentLineMixed();
    SysExTest.testPercentLineThreeDigits();
    SysExTest.testLabelLine();
    SysExTest.testPercentAndLabelAlign();
    SysExTest.testEqPercent();
    SysExTest.testEqPercentBoundary();
    SysExTest.testVuBar();
    SysExTest.testFormatRemaining();
    SysExTest.testRenderDeckInfo();
    SysExTest.testCenterIn();
    SysExTest.testSegmentedLine1();
    SysExTest.testSegmentedLine2();
    SysExTest.testSegmentedLine3();
    print('=== Tests Complete ===');
};

// To run: paste this into Mixxx script console and call SysExTest.runAll()
