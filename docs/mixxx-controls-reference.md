# Mixxx Controls Reference

## Control Groups

### [App] — Application State
| Control | Type | Description |
|---------|------|-------------|
| `num_decks` | int | Number of available decks |
| `num_samplers` | int | Number of available samplers |
| `num_preview_decks` | int | Number of preview decks |
| `gui_tick_50ms_period_s` | float | 50ms timer period |
| `indicator_250ms` | bool | Blinking timer (250ms) |
| `indicator_500ms` | bool | Blinking timer (500ms) |

### [Master] / [Main] — Master Output
| Control | Type | Range | Description |
|---------|------|-------|-------------|
| `crossfader` | float | -1.0 to 1.0 | Crossfader position |
| `gain` | float | 0.0-5.0 | Main output gain |
| `headGain` | float | 0.0-5.0 | Headphone volume |
| `headMix` | float | 0.0-1.0 | Cue/main mix |
| `balance` | float | -1.0-1.0 | L/R balance |
| `vu_meter` | float | 0.0-1.0 | Main VU meter |
| `vu_meter_left` | float | 0.0-1.0 | Left channel VU |
| `vu_meter_right` | float | 0.0-1.0 | Right channel VU |
| `peak_indicator` | bool | 0/1 | Clipping indicator |
| `peak_indicator_left` | bool | 0/1 | Left clip indicator |
| `peak_indicator_right` | bool | 0/1 | Right clip indicator |

### [ChannelN] — Deck Controls (N=1-99)

#### Playback
| Control | Type | Description |
|---------|------|-------------|
| `play` | bool | Play/pause toggle |
| `play_indicator` | bool | Play state (read-only) |
| `back` | bool | Reverse playback |
| `forward` | bool | Forward playback |
| `cue_default` | bool | Cue button |
| `cue_indicator` | bool | Cue state (read-only) |
| `reloop_exit` | bool | Exit loop or re-enter last loop |
| `loop_enabled` | bool | Loop active state |

#### Position & Tempo
| Control | Type | Range | Description |
|---------|------|-------|-------------|
| `playposition` | float | 0.0-1.0 | Track position |
| `duration` | float | seconds | Track duration |
| `rate` | float | -1.0-1.0 | Pitch/speed adjust |
| `bpm` | float | BPM | Current BPM |
| `track_samples` | int | samples | Total samples |
| `track_samplerate` | int | Hz | Sample rate |

#### Volume & EQ
| Control | Type | Range | Description |
|---------|------|-------|-------------|
| `volume` | float | 0.0-1.0 | Channel fader |
| `volumeUp` | float | 0-1 | Volume up button |
| `volumeDown` | float | 0-1 | Volume down button |
| `filterHigh` | float | 0.0-1.0 | High frequency |
| `filterMid` | float | 0.0-1.0 | Mid frequency |
| `filterLow` | float | 0.0-1.0 | Low frequency |
| `pfl` | bool | 0/1 | PFL/Cueing |

#### VU Meters
| Control | Type | Range | Description |
|---------|------|-------|-------------|
| `vu_meter` | float | 0.0-1.0 | Combined VU |
| `vu_meter_left` | float | 0.0-1.0 | Left channel VU |
| `vu_meter_right` | float | 0.0-1.0 | Right channel VU |

#### Loops
| Control | Type | Description |
|---------|------|-------------|
| `beatloop_activate` | bool | Toggle loop |
| `beatloop_size` | float | Loop size in beats |
| `beatloop_0.03125_activate` | bool | 1/32 beat loop |
| `beatloop_0.0625_activate` | bool | 1/16 beat loop |
| `beatloop_0.125_activate` | bool | 1/8 beat loop |
| `beatloop_0.25_activate` | bool | 1/4 beat loop |
| `beatloop_0.5_activate` | bool | 1/2 beat loop |
| `beatloop_1_activate` | bool | 1 beat loop |
| `beatloop_2_activate` | bool | 2 beat loop |
| `beatloop_4_activate` | bool | 4 beat loop |
| `beatloop_8_activate` | bool | 8 beat loop |
| `beatloop_16_activate` | bool | 16 beat loop |
| `beatloop_32_activate` | bool | 32 beat loop |
| `beatloop_64_activate` | bool | 64 beat loop |
| `beatlooproll_X_activate` | bool | Loop roll (same sizes) |

#### Hotcues (N=1-99)
| Control | Type | Description |
|---------|------|-------------|
| `hotcue_N_activate` | bool | Jump to/set hotcue N |
| `hotcue_N_clear` | bool | Delete hotcue N |
| `hotcue_N_color` | int | Color code (read-only) |
| `hotcue_N_enabled` | bool | Hotcue N exists (read-only) |

#### Sync
| Control | Type | Description |
|---------|------|-------------|
| `sync_enabled` | bool | Sync lock on/off |
| `sync_master` | bool | Is sync master |
| `beatsync` | trigger | Sync phase and tempo |
| `beatsync_tempo` | trigger | Sync tempo only |
| `beatsync_phase` | trigger | Sync phase only |

#### Beatgrid & Beatjump
| Control | Type | Description |
|---------|------|-------------|
| `beat_jump_forward` | trigger | Jump forward |
| `beat_jump_backward` | trigger | Jump backward |
| `beatjump_size` | float | Jump size in beats |
| `beat_closest` | trigger | Snap to nearest beat |
| `beat_active` | bool | On-beat indicator |

### [SamplerN] — Sampler Controls
Mirrors all `[ChannelN]` controls.

### [PreviewDeckN] — Preview Deck Controls
Mirrors all `[ChannelN]` controls.

### [EffectRack1] — Effect Framework

#### Effect Unit (N=1-4)
| Control | Type | Description |
|---------|------|-------------|
| `enabled` | bool | Unit enabled |
| `mix` | float | Dry/wet mix |
| `focused_effect` | int | Which effect is focused |

#### Individual Effect (N=1-4, M=1-3)
| Control | Type | Description |
|---------|------|-------------|
| `enabled` | bool | Effect enabled |
| `meta` | float | Effect meta knob |
| `parameter1` | float | Effect parameter 1 |
| `parameter2` | float | Effect parameter 2 |
| `parameter3` | float | Effect parameter 3 |

## Useful Control Extensions

Any control can have these suffixes:
- `_up` / `_down` — Step up/down
- `_up_small` / `_down_small` — Small step
- `_set_one` — Set to 1.0
- `_set_minus_one` — Set to -1.0
- `_set_default` — Set to default
- `_set_zero` — Set to 0.0
- `_toggle` — Toggle boolean
