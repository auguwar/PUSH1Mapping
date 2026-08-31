#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Push 1 LCD Simulator
====================

Renders the Akai Push 1 LCD (4 lines x 68 chars) in real time in the
terminal, receiving the same SysEx messages Mixxx sends to the physical
hardware over a virtual MIDI port.

USAGE:
    python3 tools/push_lcd_simulator.py [--port NAME] [--log-lines N]

SETUP (Mixxx 2.5.6, macOS):
    1. Run this script FIRST (it creates a virtual MIDI port pair:
       an input/source visible to Mixxx and an output/destination that
       Mixxx sends SysEx to).
    2. START OR RESTART Mixxx (controllers are detected at startup).
    3. Open Preferences -> MIDI Controllers.
    4. Select "Push LCD Simulator" as the device, assign the
       "Akai Push 1" preset (the one with the LCD SysEx script).
    5. Reload/enable the controller. SysEx from the mapping will appear
       here instead of on hardware.

KEYS:
    q        quit
    l        toggle the SysEx hex log panel
    c        clear the LCD contents
    r        clear the log
"""

import argparse
import locale
import os
import sys
import threading
import time
from collections import deque

try:
    import rtmidi
    from rtmidi import MidiIn, MidiOut, API_MACOSX_CORE
except ImportError:
    sys.stderr.write("python-rtmidi is required. Install with:\n"
                     "    python3 -m pip install --user python-rtmidi\n")
    sys.exit(1)

try:
    import curses
except ImportError:
    sys.stderr.write("curses is required but not available on this Python.\n")
    sys.exit(1)

# Ensure Unicode output for the terminal box drawing (macOS).
try:
    locale.setlocale(locale.LC_ALL, '')
except locale.Error:
    pass

# Push 1 LCD spec
LCD_LINES = 4
LCD_WIDTH = 68
LINE_BYTE_MIN = 0x18  # Line 1
LINE_BYTE_MAX = 0x1B  # Line 4

# Every received raw message is appended to this file (curses-safe ground
# truth, independent of the on-screen log panel).
CAPTURE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            'push_lcd_capture.log')

# SysEx preamble that identifies a Push LCD text write:
#   F0 47 7F 15 {line} 00 45 00 {68 chars} F7
SYSEX_PREAMBLE = (0x47, 0x7F, 0x15)
TEXT_CMD = (0x00, 0x45, 0x00)


class LCDState:
    def __init__(self, max_log=80):
        self.lock = threading.Lock()
        self.grid = [[' '] * LCD_WIDTH for _ in range(LCD_LINES)]
        self.log = deque(maxlen=max_log)
        self.msg_count = 0
        self.lcd_count = 0
        self.last_rx = None
        self.last_lcd = None

    def update_line(self, line, chars):
        with self.lock:
            for i in range(LCD_WIDTH):
                self.grid[line - 1][i] = chr(chars[i])
            self.lcd_count += 1
            self.last_lcd = time.time()

    def add_log(self, text):
        with self.lock:
            self.log.append(text)

    def record_rx(self):
        with self.lock:
            self.msg_count += 1
            self.last_rx = time.time()

    def snapshot(self):
        with self.lock:
            return [''.join(row) for row in self.grid]


def parse_sysex(data):
    """Return line (1..4) if `data` is a Push 1 LCD text SysEx, else None."""
    if len(data) < 9:
        return None
    if data[0] != 0xF0 or data[-1] != 0xF7:
        return None
    if tuple(data[1:4]) != SYSEX_PREAMBLE:
        return None
    if data[5] != TEXT_CMD[0] or data[6] != TEXT_CMD[1] or data[7] != TEXT_CMD[2]:
        return None
    lnum = data[4]
    if not (LINE_BYTE_MIN <= lnum <= LINE_BYTE_MAX):
        return None
    return lnum - 0x17  # 1..4


def unwrap_message(msg):
    """python-rtmidi may pass message data two ways on different builds:
    either a bare byte list (F0 .. F7) or a packed `(byte_list, delta_time)`
    tuple. Return the bare byte list in both cases.
    """
    if isinstance(msg, (tuple, list)) and msg and not isinstance(msg[0], int):
        msg = msg[0]
    return msg


def make_callback(state):
    def cb(message, delta_time):
        message = unwrap_message(message)
        if not message:
            return
        data = [b if isinstance(b, int) else ord(b) for b in message]
        state.record_rx()
        stamp = time.strftime('%H:%M:%S')
        hexdump = ' '.join('%02X' % b for b in data[:16])
        more = ' ...' if len(data) > 16 else ''
        line = parse_sysex(data)
        try:
            with open(CAPTURE_PATH, 'a') as f:
                f.write('[%s] len=%d line=%s\n  %s%s\n'
                        % (stamp, len(data), line, hexdump, more))
        except OSError:
            pass
        if line is not None:
            chars = data[8:8 + LCD_WIDTH]
            if len(chars) < LCD_WIDTH:
                chars = chars + [32] * (LCD_WIDTH - len(chars))
            state.update_line(line, chars)
            state.add_log('[%s] L%d %s%s' % (stamp, line, hexdump, more))
        else:
            state.add_log('[%s] non-LCD: %s%s' % (stamp, hexdump, more))
    return cb


def open_virtual_input(name):
    # MidiIn.open_virtual_port publishes a DESTINATION that other apps
    # (Mixxx) can send to. We receive what they send via the callback.
    midi = MidiIn(API_MACOSX_CORE)
    midi.ignore_types(sysex=False, timing=False, active_sense=False)
    midi.open_virtual_port(name)
    return midi


def open_virtual_source(name):
    # MidiOut.open_virtual_port publishes a SOURCE (the "input" side in
    # Mixxx terms). Mixxx only builds its detected-controllers list from
    # input devices and links a same-named output to it, so a destination
    # alone would never show up in Preferences > MIDI Controllers.
    midi = MidiOut(API_MACOSX_CORE)
    midi.open_virtual_port(name)
    return midi


def char_display(c):
    # NUL bytes through 31 and 127 are "special" on the Push LCD. The
    # terminal cannot render the real glyphs, so show a placeholder and
    # highlight them with color so they are easy to spot.
    if 32 <= c <= 126:
        return chr(c)
    return '·'


def is_special_byte(c):
    return c < 32 or c == 127


def draw_simulator(stdscr, state, port_name, show_log, log_n, special_attr):
    h, w = stdscr.getmaxyx()

    def addn(y, x, text, attr=0):
        if y >= h or x >= w:
            return
        try:
            stdscr.addstr(y, x, text[:max(0, w - x)], attr)
        except curses.error:
            pass

    # Status bar
    t = state.last_lcd
    lcdt = time.strftime('%H:%M:%S') if t else '-'
    stat = ('PUSH 1 LCD SIM  [%s]   LCD msgs: %d   rx: %d   last: %s'
            % (port_name, state.lcd_count, state.msg_count, lcdt))
    addn(0, 0, stat, curses.A_REVERSE)

    box_top = 2
    snapshot = state.snapshot()
    lcd_left = 6 if w >= LCD_WIDTH + 12 else 0
    fits_box = lcd_left > 0 and h >= box_top + LCD_LINES + 2

    if fits_box:
        addn(box_top, lcd_left, '┌' + '─' * (LCD_WIDTH + 2) + '┐')
        inner_left = lcd_left + 2
        for r in range(LCD_LINES):
            y = box_top + 1 + r
            if y >= h:
                break
            row = snapshot[r]
            try:
                stdscr.addstr(y, lcd_left, '│ ')
                stdout = []
                attrs = []
                for ch in row:
                    cc = ord(ch)
                    stdout.append(char_display(cc))
                    attrs.append(special_attr() if is_special_byte(cc) else 0)
                run_start = 0
                for i in range(1, LCD_WIDTH + 1):
                    if i == LCD_WIDTH or attrs[i] != attrs[run_start]:
                        run = ''.join(stdout[run_start:i])
                        if run:
                            addn(y, inner_left + run_start, run, attrs[run_start])
                        run_start = i
                stdscr.addstr(y, lcd_left + 2 + LCD_WIDTH, '│')
            except curses.error:
                pass
        addn(box_top + 1 + LCD_LINES, lcd_left,
             '└' + '─' * (LCD_WIDTH + 2) + '┘')
        # line-number labels
        for r in range(LCD_LINES):
            y = box_top + 1 + r
            if y < h:
                try:
                    stdscr.addstr(y, 1, '%d' % (r + 1))
                except curses.error:
                    pass
    else:
        # terminal too small: plain fallback
        y = box_top
        for r in range(LCD_LINES):
            if y >= h:
                break
            row = snapshot[r]
            out = []
            for ch in row[:max(0, w)]:
                out.append(char_display(ord(ch)))
            addn(y, 0, ''.join(out))
            y += 1

    # Log panel
    if show_log:
        log_y = box_top + LCD_LINES + 3
        if log_y < h:
            addn(log_y, 0, 'SysEx log (r=clear, l=hide):', curses.A_UNDERLINE)
            with state.lock:
                entries = list(state.log)
            n = min(log_n, h - log_y - 2)
            for i, entry in enumerate(entries[max(0, len(entries) - n):]):
                y = log_y + 1 + i
                if y >= h:
                    break
                addn(y, 0, entry)

    # Footer
    if h > 1:
        addn(h - 1, 0, 'q quit | l log | c clear LCD | r clear syslog')


def run(port_name, log_n):
    state = LCDState(max_log=max(20, log_n + 10))
    midi = open_virtual_input(port_name)
    midi.set_callback(make_callback(state))
    source = open_virtual_source(port_name)

    sys.stdout.write('\nListening on virtual MIDI port:  "%s"\n' % port_name)
    sys.stdout.write('Setup: Mixxx > Preferences > MIDI Controllers > '
                     'select "%s" > assign preset "Akai Push 1".\n' % port_name)
    sys.stdout.write('Mixxx detects controllers at startup, so start (or '
                     'restart) Mixxx AFTER this tool is running.\n\n')
    sys.stdout.flush()

    try:
        curses.wrapper(_main, state, port_name, log_n)
    except KeyboardInterrupt:
        pass
    except curses.error:
        # curses failed (e.g. no TERM set in a non-interactive shell)
        sys.stderr.write('\ncurses UI unavailable (TERM=%r). '
                         'Run from a real terminal.\n' % os.environ.get('TERM'))
    finally:
        midi.close_port()
        source.close_port()
        sys.stdout.write('\nSimulator stopped. '
                         'Received %d MIDI messages, %d of which were LCD updates.\n'
                         % (state.msg_count, state.lcd_count))


def _main(stdscr, state, port_name, log_n):
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.timeout(80)

    has_color = False
    if curses.has_colors():
        try:
            curses.start_color()
            curses.use_default_colors()
            curses.init_pair(1, curses.COLOR_CYAN, -1)
            has_color = True
        except curses.error:
            has_color = False

    def special_attr():
        return (curses.color_pair(1) | curses.A_BOLD) if has_color else curses.A_BOLD

    show_log = True

    while True:
        stdscr.erase()
        draw_simulator(stdscr, state, port_name, show_log, log_n, special_attr)
        stdscr.refresh()

        key = stdscr.getch()
        if key in (ord('q'), 3):
            break
        elif key == ord('l'):
            show_log = not show_log
        elif key == ord('c'):
            with state.lock:
                state.grid = [[' '] * LCD_WIDTH for _ in range(LCD_LINES)]
        elif key == ord('r'):
            with state.lock:
                state.log.clear()


def main():
    if not os.environ.get('TERM'):
        # Non-interactive shells sometimes lack TERM; give curses a
        # sane default so the UI can start.
        os.environ['TERM'] = 'xterm-256color'

    ap = argparse.ArgumentParser(description='Push 1 LCD simulator (terminal)')
    ap.add_argument('--port', default='Push LCD Simulator',
                    help='name of the virtual MIDI port (default: Push LCD Simulator)')
    ap.add_argument('--log-lines', type=int, default=8,
                    help='number of SysEx log lines to show (default: 8)')
    args = ap.parse_args()
    run(args.port, args.log_lines)


if __name__ == '__main__':
    main()