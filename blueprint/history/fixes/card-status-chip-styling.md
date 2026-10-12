# Card status chip styling

**Type:** Fix
**Status:** verified

## The problem

The Study info panel stretches the status chip across the full row. Its bright outline also makes it more prominent than the surrounding metadata.

## The fix

Keep the chip content-sized and use a soft status-tinted surface with no hard outline. Preserve the existing status colors and labels.

## Build steps

- [x] Restyle the chip. Done when it hugs its label and reads as a quiet status cue.

## Verify

Inspect the Study info panel and confirm the chip stays content-sized and legible for each status.
