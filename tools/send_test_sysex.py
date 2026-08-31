#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Push 1 LCD test sender
======================

Sends Push 1 LCD SysEx messages to a virtual MIDI port so you can test
the LCD simulator (or hardware) without running Mixxx.

USAGE:
    python3 tools/send_test_sysex.py --line 1 --text "Hello"
    python3 tools/send_test_sysex.py --line 3 --file sysextests/clip\ selection\ none.syx
    python3 tools/send_test_sysex.py --chars-all
    python3 tools/send_test_sysex.py --line 1 --char 0 --char 127
"""

import argparse
import sys
import time

try:
    import rtmidi
    from rtmidi import MidiOut, API_MACOSX_CORE
except ImportError:
    sys.stderr.write("python-rtmidi is required. Install with:\n"
                     "    python3 -m pip install --user python-rtmidi\n")
    sys.exit(1)

LCD_WIDTH = 68
LINE_BYTE_MIN = 0x18


def find_port(name, retries=10, delay=0.5):
    mo = MidiOut(API_MACOSX_CORE)
    ports = mo.get_ports()
    for i, p in enumerate(ports):
        if name in p:
            return mo, i
    # Virtual ports can take a moment to register with CoreMIDI.
    for attempt in range(retries):
        time.sleep(delay)
        ports = mo.get_ports()
        for i, p in enumerate(ports):
            if name in p:
                return mo, i
    sys.stderr.write('Virtual port "%s" not found after %d tries. Available ports:\n'
                     % (name, retries))
    for p in mo.get_ports():
        sys.stderr.write('  - %s\n' % p)
    sys.stderr.write('Start the simulator first: python3 tools/push_lcd_simulator.py\n')
    sys.exit(1)


def build_message(line, text):
    text = text.ljust(LCD_WIDTH)[:LCD_WIDTH]
    msg = [0xF0, 0x47, 0x7F, 0x15, LINE_BYTE_MIN + (line - 1), 0x00, 0x45, 0x00]
    for ch in text:
        msg.append(ord(ch) if ord(ch) < 128 else 32)
    msg.append(0xF7)
    if len(msg) != 8 + LCD_WIDTH + 1:
        sys.stderr.write('internal error building message\n')
        sys.exit(1)
    return msg


def load_file(path):
    with open(path, 'rb') as f:
        data = list(f.read())
    if data[0] != 0xF0 or data[-1] != 0xF7:
        sys.stderr.write('not a SysEx file\n')
        sys.exit(1)
    return data


def main():
    ap = argparse.ArgumentParser(description='Send test LCD SysEx to Push 1 simulator')
    ap.add_argument('--port', default='Push LCD Simulator',
                    help='virtual port name (default: Push LCD Simulator)')
    ap.add_argument('--line', type=int, choices=(1, 2, 3, 4), default=1,
                    help='LCD line to write')
    ap.add_argument('--text', default=None, help='text to display (max 68 chars, ASCII)')
    ap.add_argument('--file', default=None, help='raw .syx file to send')
    ap.add_argument('--chars-all', action='store_true',
                    help='send the full 128-char map in two messages (lines 1-2)')
    ap.add_argument('--char', type=int, action='append', default=[],
                    help='list of explicit char codes to render (0-127)')
    args = ap.parse_args()

    msgs = []
    if args.chars_all:
        msgs.append(build_message(1, ''.join(chr(i) for i in range(68))))
        msgs.append(build_message(2, ''.join(chr(i) for i in range(68, 128))))
    elif args.file:
        msgs.append(load_file(args.file))
    elif args.char:
        text = ''.join(chr(c % 128) for c in args.char)
        msgs.append(build_message(args.line, text))
    elif args.text is not None:
        msgs.append(build_message(args.line, args.text))
    else:
        ap.error('provide one of: --text, --file, --chars-all, --char')

    port = find_port(args.port)
    mo, idx = port
    mo.open_port(idx)

    for m in msgs:
        print('sending %d bytes: %s' % (len(m), ' '.join('%02X' % b for b in m[:16]) + (' ...' if len(m) > 16 else '')))
        mo.send_message(m)
        time.sleep(0.15)

    mo.close_port()


if __name__ == '__main__':
    main()