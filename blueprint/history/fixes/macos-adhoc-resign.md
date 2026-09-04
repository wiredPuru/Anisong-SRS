# Fix: Re-sign the macOS binaries so Gatekeeper stops calling them damaged

**Type:** Fix
**Status:** verified

## The problem

A macOS build downloaded through a browser refuses to launch with
**""gaq-srs" is damaged and can't be opened. You should move it to the
Trash."** - a dialog whose only action destroys the file. Reported against the
published v1.1.0 macOS build; the Windows build is unaffected.

The binary is not damaged. `bun build --compile` appends its JS payload to the
Mach-O *after* the linker has ad-hoc-signed it, which invalidates that
signature:

```
codesign -v release/macos-arm64/gaq-srs
  -> invalid signature (code or signature have been modified)
```

macOS does not check signatures on local files, so the binary runs fine from a
terminal or when copied around - which is why it passed its packaging smoke
test. A browser download attaches `com.apple.quarantine`, which makes
Gatekeeper actually evaluate it, find a broken signature, and conclude the file
is corrupt. Reproduced directly: with the quarantine attribute attached the
process is SIGKILLed (exit 137); with it stripped
(`xattr -dr com.apple.quarantine`) the same binary serves `/` and `/study` 200.

Windows is unaffected because SmartScreen judges reputation, not signature
validity, so it shows its normal bypassable warning.

This is inherent to how Bun compiles, so it affects v1.0.0 and v1.1.0 alike -
it is not a regression from the recent zip change.

## The fix

In `nuxt-app/scripts/package.ts`, ad-hoc re-sign each macOS binary after Bun
finishes compiling it (and therefore before it is archived), then verify the
result:

```
codesign --force --sign - <binary>   # replaces the broken signature
codesign --verify <binary>           # prove it took
```

- **macOS targets only.** Windows and Linux have no equivalent; drive this off
  a per-target flag rather than string-matching the target name at the call
  site.
- **Verify, don't assume.** Running `codesign --verify` right after signing is
  what keeps this fix from silently rotting - it is the exact check that was
  failing before, so the script proves its own output.
- **Fail the target if signing can't run or doesn't verify.** An improperly
  signed macOS binary is broken output, and quietly producing one is precisely
  the bug being fixed, so it must not be a warning. Tradeoff worth recording:
  `codesign` ships with the Xcode command line tools and so exists only on
  macOS, which means macOS targets can no longer be produced from a Linux or
  Windows host. The script's "no per-OS machine needed" property still holds
  for the Windows and Linux targets. Packaging happens on a Mac today, so this
  costs nothing in practice and trades a hypothetical capability for not
  shipping a build that looks corrupt.

Then document the caveat where users and future-me will actually meet it:

- `README.md`'s Downloads section - the macOS security warning and the exact
  `xattr -dr com.apple.quarantine <folder>` escape hatch.
- `AGENTS.md`'s `bun run package` bullet - one line noting macOS targets are
  ad-hoc re-signed.

### What this does and does not achieve

Re-signing makes the signature **valid**, which changes Gatekeeper's verdict
from `invalid signature (code or signature have been modified)` to a plain
`rejected`. That is the difference between "damaged, move to Trash" (a dead
end) and the ordinary unidentified-developer warning, which has a working
right-click -> Open override.

It does **not** make the app pass Gatekeeper outright: an ad-hoc signature is
not a Developer ID signature, so `spctl` still rejects it and a first-run
warning still appears. Only Developer ID signing plus notarization (a paid
Apple Developer account) removes the warning entirely, which is out of scope
here and consistent with build item 48c already declaring code-signing out of
scope.

Verified so far: the signature becomes valid, and `spctl`'s reason string
changes as described. **Not** verified: the exact wording of the Finder dialog,
which cannot be triggered from a shell - that mapping is documented macOS
behavior but should be confirmed against a real download before it is treated
as certain.

### Must not break

- The four `release/<label>/` folders and the four `gaq-srs-<label>.zip`
  archives must still be produced with the same names and flat layout.
- The unix exec bit must still survive into the archives.
- Windows and Linux targets must be untouched by the signing step.
- The archives must contain the *signed* binary, so signing has to happen
  before the zip step, not after.

## Build steps

- [x] Ad-hoc re-sign and verify the macOS binaries in
  `nuxt-app/scripts/package.ts`.
  - Done when: `bun run package` completes with four OK lines and
    `codesign -v release/macos-arm64/gaq-srs` and
    `codesign -v release/macos-x64/gaq-srs` both report a valid signature
    (they report `invalid signature (code or signature have been modified)`
    today); the Windows and Linux binaries are unchanged; and a binary
    extracted from the rebuilt archive still runs. Confirmed: clean
    `bun run package` exited 0 with four OK lines; both macOS binaries now
    verify VALID; `spctl` under quarantine changed from
    `invalid signature (code or signature have been modified)` to plain
    `rejected`; the re-signed binary extracted from its archive still serves
    `/` 200 with working furigana, proving `--force` did not corrupt Bun's
    appended payload; Windows (`PE32+`) and Linux (`ELF`) binaries unchanged;
    exec bit still `-rwxr-xr-x` in the archive.
- [x] Document the macOS caveat in `README.md` and note the signing step in
  `AGENTS.md`.
  - Done when: README's Downloads section states the warning and gives the
    exact `xattr -dr com.apple.quarantine` command, and the `bun run package`
    bullet mentions ad-hoc re-signing of the macOS targets. Confirmed: README
    Downloads now covers both macOS and Windows first-run warnings, names the
    misleading "damaged" message explicitly, and gives the `xattr` command
    plus the `chmod +x` and right-click -> Open fallbacks; it also now states
    the binary must stay beside `migrations/`, `public/`, and `kuromoji/`.
    AGENTS.md's package bullet records the re-signing, why it is needed, and
    that macOS targets consequently require a Mac to package. No em dashes
    (checked).

## Verify

- `cd nuxt-app && bun run build && bun run package` - exits 0, four OK lines.
- `codesign -v nuxt-app/release/macos-arm64/gaq-srs` and the same for
  `macos-x64` - valid, no output, exit 0.
- Extract `gaq-srs-macos-arm64.zip`, attach a quarantine attribute
  (`xattr -w com.apple.quarantine "0083;00000000;Safari;" gaq-srs`), and
  confirm `spctl -a -vv -t execute gaq-srs` no longer reports
  `invalid signature (code or signature have been modified)`.
- Extract that archive without quarantine and run it - still serves `/` 200,
  confirming re-signing did not corrupt the appended payload.
- `unzip -Z ... gaq-srs` still reports `-rwxr-xr-x`.
