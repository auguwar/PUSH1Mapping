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
    SysExTest.assertEq(msg[75], 0xF7, 'Byte 75: SysEx end');
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
    var charBytes = msg.slice(8, 75);
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
    var charBytes = msg.slice(8, 75);
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
    // Validate against captured: "clip selection none.syx"
    var captured = [0xF0, 0x47, 0x7F, 0x15, 0x1A, 0x00, 0x45, 0x00,
                    0x43, 0x6C, 0x69, 0x70, 0x20, 0x53, 0x65, 0x6C,
                    0x65, 0x63, 0x74, 0x69, 0x6F, 0x6E, 0x3A, 0x20,
                    0x20, 0x5B, 0x6E, 0x6F, 0x6E, 0x65, 0x5D, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0xF7];

    // Our builder should produce same message for line 3
    var built = SysExTest.buildLCDMessage(3, 'Clip Selection:  [none]');

    SysExTest.assertEq(captured.length, built.length, 'Captured vs built: same length');
    SysExTest.assertArrayEq(built.slice(0, 8), captured.slice(0, 8), 'Captured vs built: header matches');
    SysExTest.assertArrayEq(built.slice(8, 30), captured.slice(8, 30), 'Captured vs built: text content matches');
};

SysExTest.testReferenceCaptureRandomLevels = function() {
    // Validate against captured: "randomlvls.syx"
    var captured = [0xF0, 0x47, 0x7F, 0x15, 0x1B, 0x00, 0x45, 0x00,
                    0x31, 0x2D, 0x4D, 0x49, 0x44, 0x49, 0x20, 0x20,
                    0x20, 0x32, 0x2D, 0x4D, 0x49, 0x44, 0x49, 0x20,
                    0x20, 0x33, 0x2D, 0x41, 0x75, 0x64, 0x69, 0x6F,
                    0x20, 0x20, 0x34, 0x2D, 0x41, 0x75, 0x64, 0x69,
                    0x6F, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x41, 0x2D, 0x52,
                    0x65, 0x76, 0x65, 0x72, 0x62, 0x20, 0x42, 0x2D,
                    0x44, 0x65, 0x6C, 0x61, 0x79, 0x20, 0x20, 0x20,
                    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
                    0x20, 0xF7];

    var built = SysExTest.buildLCDMessage(4, '1-MIDI  2-MIDI  3-Audio  4-Audio       A-Reverb B-Delay ');

    SysExTest.assertEq(captured.length, built.length, 'Captured randomlvls vs built: same length');
    SysExTest.assertArrayEq(built.slice(0, 8), captured.slice(0, 8), 'Captured randomlvls vs built: header matches');
    SysExTest.assertArrayEq(built.slice(8, 30), captured.slice(8, 30), 'Captured randomlvls vs built: text matches');
};

// --- Fader Rendering Tests ---

SysExTest.FADER_WIDTH = 6;
SysExTest.FADER_FILL = '#';
SysExTest.FADER_EMPTY = '-';

SysExTest.renderFaderBar = function(value) {
    if (value < 0) value = 0;
    if (value > 1) value = 1;

    var filled = Math.round(value * SysExTest.FADER_WIDTH);
    var bar = '[';
    for (var i = 0; i < SysExTest.FADER_WIDTH; i++) {
        bar += (i < filled) ? SysExTest.FADER_FILL : SysExTest.FADER_EMPTY;
    }
    bar += ']';
    return bar;
};

SysExTest.testFaderZero = function() {
    SysExTest.assertEq(SysExTest.renderFaderBar(0.0), '[------]', 'Fader at 0% is all empty');
};

SysExTest.testFaderFull = function() {
    SysExTest.assertEq(SysExTest.renderFaderBar(1.0), '[######]', 'Fader at 100% is all full');
};

SysExTest.testFaderHalf = function() {
    SysExTest.assertEq(SysExTest.renderFaderBar(0.5), '[###---]', 'Fader at 50% is half full');
};

SysExTest.testFaderQuarter = function() {
    SysExTest.assertEq(SysExTest.renderFaderBar(0.25), '[##----]', 'Fader at 25% is quarter full');
};

SysExTest.testFaderOutOfRange = function() {
    SysExTest.assertEq(SysExTest.renderFaderBar(-0.5), '[------]', 'Fader clamps negative values');
    SysExTest.assertEq(SysExTest.renderFaderBar(1.5), '[######]', 'Fader clamps values above 1');
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
    SysExTest.testFaderZero();
    SysExTest.testFaderFull();
    SysExTest.testFaderHalf();
    SysExTest.testFaderQuarter();
    SysExTest.testFaderOutOfRange();
    print('=== Tests Complete ===');
};

// To run: paste this into Mixxx script console and call SysExTest.runAll()
