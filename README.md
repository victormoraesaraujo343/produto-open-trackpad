# OpenTrackpad

Turn an old Android device into a dedicated, native multi-touch trackpad for Linux.

Unlike remote-mouse apps, OpenTrackpad sends raw touch contacts from Android to a
Linux host and exposes them through `uinput`, so `libinput` and the desktop
environment handle gestures natively. Linux sees a real touchpad, not a mouse.

## Where it stands (checked 2026-09-30)

- **It works end to end on the setup tested so far:** one Android phone over USB,
  CachyOS with KDE Plasma on Wayland. The pointer moves, two fingers scroll, three
  and four fingers produce native swipe gestures, and pinch zoom is continuous.
- **It runs as a daily appliance on the maintainer's machine:** the three systemd
  user services in `packaging/` start at login, and plugging the phone in is enough.
- **Beyond the touchpad (v0.2, tag `v0.2-one-identity`):** a control surface on
  the phone — a rail and a Quick Ring of keyboard shortcuts, profiles, custom
  shortcuts recorded on the computer, an audio panel (devices and per-app
  streams), import of shortcuts already set up on the desktop, and the
  computer's recent windows (KDE only).
- **Not verified yet:** 30 minutes of use with no stuck contact, a second
  distribution or a GNOME session, palm and edge filtering, an in-app
  calibration screen. Bluetooth is not started.
- **Last commit:** 2026-08-30. Development happens on the `develop` branch;
  `main` still holds the first scaffold from 2026-08-28.

See [docs/TESTING.md](docs/TESTING.md) for exactly what has and has not been
proven, and [docs/RESUMING.md](docs/RESUMING.md) for what is waiting on a decision.

## Why

Apps such as KDE Connect and Bluetooth HID remotes translate gestures into mouse
movement, scrolling, or keyboard shortcuts. That is useful, but Linux still sees
a mouse. OpenTrackpad makes Linux see a real multi-touch touchpad.

## Architecture

```text
Android MotionEvent contacts
          |
          | USB + adb reverse
          v
OpenTrackpad host daemon (opentrackpadd)
          |
          | /dev/uinput
          v
Linux input subsystem -> libinput -> GNOME/KDE gestures
```

Shortcuts go through a separate virtual keyboard, so they cannot corrupt touch
state. The phone can only ask for chords from a closed list kept on the
computer; it can never run a command.

See [Architecture](docs/ARCHITECTURE.md), [wire protocol](docs/PROTOCOL.md)
(currently OTP/4), [design](docs/DESIGN.md) and [roadmap](docs/ROADMAP.md).

## Getting started

You need Rust (for the host), and a JDK 17 plus the Android SDK (for the app).

1. **Host daemon and services** — build, install and enable the user services as
   described in [host/README.md](host/README.md). No root needed; check
   `/dev/uinput` permissions there first.
2. **Android app** — build and install it as described in
   [android/README.md](android/README.md) (`./gradlew installDebug`). Android 9
   or newer.
3. **Plug the phone in** with USB debugging enabled and open the app.
   `opentrackpad-usb.service` sets up the USB bridge by itself
   (`scripts/connect-usb.sh` does the same by hand).
4. **Optional:** the [tray indicator](tray/) shows the connection state and can
   stop or start OpenTrackpad; the [shortcut recorder](recorder/) captures new
   shortcuts from the real keyboard.

### Trying the host without a phone

The daemon can prove itself against a scripted sequence of one, two, three and
four contacts. The pointer will move on its own for a few seconds:

```bash
cd host
cargo run -- --self-test
```

Add `--dry-run` to watch what it decides without creating a device at all.

To run it by hand and feed it a frame:

```bash
cd host
cargo run -- 127.0.0.1:4343
```

In another terminal:

```bash
printf 'HELLO OTP/4 1080 2400 10 69000 156000\nFRAME 1 1000000 1 0 500 800 700 12\n' | socat - TCP:127.0.0.1:4343
```

(The default address is `127.0.0.1:4242`; pick another port if the service is
already running.)

### Tests

```bash
cd host && cargo test                        # host: protocol, session rules, contact state, event encoding
cd android && ./gradlew testDebugUnitTest    # Android: wire format, frame queue and UI logic, on the JVM
```

`android/tools/pixel-check.py` compares screenshots of the app against the
baselines in `android/tools/pixel-baseline/`.

## Validating on your machine

OpenTrackpad aims to work on any Linux running libinput. To check whether it
does on yours:

```bash
sudo ./scripts/validate-touchpad.sh
```

It injects synthetic one-, two-, three- and four-finger strokes and reports
whether libinput turned them into motion, scrolling and gestures — ending in
PASS or FAIL rather than asking you to watch the cursor. Results from new
distributions and desktops are genuinely useful; see
[testing and validation](docs/TESTING.md).

## Tuning the feel

OpenTrackpad presents itself as an ordinary touchpad, so the desktop's own
touchpad settings apply. On KDE they are in System Settings, Mouse & Touchpad,
under "OpenTrackpad Touchpad"; GNOME has the equivalent under Mouse & Touchpad.

Adjust them with a finger on the phone: changes take effect immediately, and
thirty seconds of nudging a slider beats guessing.

A starting point that felt right on a 6.7-inch phone driving a 2560x1440
display:

| Setting | Value |
| --- | --- |
| Pointer speed | 0.5 of the way up the slider |
| Natural scrolling | on, if you expect a two-finger swipe right to go back |
| Tap to click | on |

These are personal preferences, not project defaults, and the desktop stores
them per device. The virtual touchpad keeps a fixed name and identity, so they
survive reconnecting, rebooting, and plugging in a different phone.

If the pointer feels like it is copying your finger exactly, with no difference
between a slow and a fast swipe, the problem is not the speed setting — see the
note on frame timing in [docs/TESTING.md](docs/TESTING.md).

## Where everything is

| Path | What it is |
| --- | --- |
| [`host/`](host/) | `opentrackpadd`, the Linux daemon (Rust). Creates the virtual touchpad and keyboard. |
| [`android/`](android/) | The Android client (Kotlin): touch surface, rail, Quick Ring, panels. |
| [`tray/`](tray/) | Optional tray indicator (Rust). |
| [`recorder/`](recorder/) | Shortcut recorder window (Rust, GTK). Opened from the tray or by the phone. |
| [`packaging/`](packaging/) | systemd user services and the udev rule for `/dev/uinput`. |
| [`scripts/`](scripts/) | `connect-usb.sh` (USB bridge) and `validate-touchpad.sh` (libinput check). |
| [`docs/`](docs/) | Architecture, protocol, design, roadmap, testing, and resuming notes. |
| [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/) | Template for reporting a device test. |

## Target platforms

- Host: any Linux with `uinput` and `libinput`. Nothing in the design is
  distribution-specific; the desktop only has to run libinput, which every
  mainstream GNOME, KDE, X11 and Wayland session does. Only one setup has been
  tested so far (see above). The recent-windows rail needs KDE.
- Client: any Android 9 or newer.

## Security

The daemon injects input into your desktop. It binds to loopback only, has no
authentication, and must not be exposed to a network interface. Do not
`chmod 666 /dev/uinput`; see [host/README.md](host/README.md) for the right way.

## Contributing

The project is at the prototype stage. Read [CONTRIBUTING.md](CONTRIBUTING.md)
before opening a pull request, and start from an issue describing your device,
Android version and Linux distribution.

## License

[MIT](LICENSE)
