---
name: Gemini_WaterMark_Removal
description: >
  Use when the user needs to remove a visible Gemini-style watermark or fixed
  AI provenance mark from image frames they own or are authorized to edit,
  especially batch frame sequences where standard watermark-removal tools fail
  because the mark was scaled, shifted, alpha-blended, or anti-aliased.
---

# Gemini Watermark Removal

Use this skill only for authorized local assets. Preserve originals, avoid
misrepresenting provenance, and do not remove third-party ownership marks or
watermarks from content the user is not allowed to modify.

## Core Workflow

1. **Read project context first.** Check `AGENTS.md`, `CLAUDE.md`, or local
   handoff notes before touching assets. Identify the source directory, frame
   naming pattern, image size, format, git status, and whether the assets are
   tracked or untracked.
2. **Create a full backup before editing.** Copy originals to a sibling backup
   directory such as `frames_orig_backup/`. Never delete backups unless the
   user explicitly confirms visual approval.
3. **Try the purpose-built repo/tool first when applicable.** Use
   `GargantuaX/gemini-watermark-remover` or the published
   `@pilio/gemini-watermark-remover` CLI for normal Gemini visible watermarks.
   It is the preferred first pass for supported still images because it uses
   reverse alpha blending rather than generative inpainting.
4. **Measure the real watermark.** Do not assume Gemini's default placement.
   Detect the visible mark on representative frames and record bounding box,
   center, size, and margin from the image edges. Scaled videos often shift the
   mark away from the default Gemini position.
5. **Classify the footage.** Sample early, middle, transition, and late frames.
   Note whether the region behind the mark is flat, textured, moving, skin,
   fabric, gradients, or high-detail content.
6. **Try alpha reversal only when justified.** Reverse alpha-blending can work
   for a known logo color, alpha mask, exact position, and unscaled overlay.
   Reject it if detection confidence is low or if it leaves colored fringe,
   ghost outlines, or subpixel artifacts.
7. **Prefer harmonic inpaint for flat backgrounds.** If the watermark sits over
   mostly smooth background in all frames, use a fixed patch and solve the
   interior by diffusion from the boundary. This avoids ghosting from imperfect
   alpha estimates.
8. **Write only the masked interior.** Preserve a 1px original boundary around
   the patch so the fill blends with the surrounding image. Re-encode with a
   deliberate quality setting and keep filenames stable unless the user asks for
   a new output directory.
9. **Verify visually and numerically.** Compare the former watermark core to
   nearby background, inspect full frames, and include transition/scene-change
   frames in QA.

## `gemini-watermark-remover` Repo Workflow

Use this when the watermark appears to be a standard Gemini visible watermark:

- GitHub repo: `https://github.com/GargantuaX/gemini-watermark-remover`
- npm package / CLI: `@pilio/gemini-watermark-remover`
- Core method: reverse alpha blending from a known Gemini alpha map.
- Runtime: Node.js; repo-local processing uses `pnpm install` and `pnpm build`.
- Image processing dependency: `sharp`.

Common setup:

```bash
git clone https://github.com/GargantuaX/gemini-watermark-remover /tmp/gwr
cd /tmp/gwr
pnpm install
pnpm build
```

CLI options to try:

```bash
# repo-local CLI
node /tmp/gwr/bin/gwr.mjs remove <input> --output <file>
node /tmp/gwr/bin/gwr.mjs remove <input-dir> --out-dir <dir> --json

# packaged CLI
pnpm dlx @pilio/gemini-watermark-remover remove <input> --output <file>
```

The repo also ships an agent skill boundary:

```bash
node /tmp/gwr/skills/gemini-watermark-remover/scripts/run.mjs remove <input> --output <file>
node /tmp/gwr/skills/gemini-watermark-remover/scripts/run.mjs remove <input-dir> --out-dir <dir>
```

Interpret JSON/meta output:

- `meta.applied: true` means the tool accepted and processed the watermark.
- `skipReason: "no-watermark-detected"` means the detector did not trust the
  candidate; do not force destructive output without visual comparison.
- `decisionTier: "insufficient"` or similar low-confidence tiers mean the
  watermark did not match the known catalog strongly enough.
- Compare before/after crops around the mark. A mathematically valid-looking
  run is still a failure if it leaves colored fringe, outline, or ghost pixels.

Known catalog assumptions from the tool:

| Output class | Expected watermark | Expected margin |
| --- | --- | --- |
| Smaller / 0.5K previews | 48x48 | 32px right and bottom |
| Larger 1K/2K/4K outputs | 96x96 | 64px right and bottom |
| Some newer catalog variants | 96x96 | 192px right and bottom, evidence-gated |

These assumptions can break when images are video frames, resized exports,
cropped stills, recompressed assets, or page previews. In those cases, measure
the actual watermark and fall back to a custom method.

## Detection Notes

For a fixed sparkle/star watermark:

- Use luminance or color-threshold masks on representative frames to estimate
  the bright symbol bounds.
- Measure actual coordinates from the rendered frame, not from expected Gemini
  defaults.
- Check at least one frame from every shot or background type.
- Treat anti-aliased edges as unreliable for alpha solving; they are where
  colored ghosts usually survive.

Record findings in implementation notes:

```text
image size: WIDTH x HEIGHT
watermark bounds: x[min-max], y[min-max]
center: (x, y)
patch: PATCH_W x PATCH_H at (BX, BY)
background types sampled: flat dark, skin, gradient, textured, etc.
```

## Harmonic Inpaint Pattern

Use this when the background behind the mark is smooth enough that boundary
diffusion reconstructs it cleanly.

Recommended starting parameters:

- Patch covers watermark plus padding on every side.
- Preserve the outer 1px boundary from the original patch.
- Solve each RGB channel independently.
- Initialize the interior with the boundary average or nearest valid pixels.
- Iterate Gauss-Seidel with SOR around `omega = 1.8...1.95`.
- Use enough iterations for convergence; for a 72x72 patch, thousands of
  iterations are acceptable for a 100-200 frame sequence.
- Write only the interior mask back to the original image.

Pseudocode:

```text
for each frame:
  load image
  crop patch at measured coordinates
  mark interior pixels to replace, preserving a 1px boundary
  initialize interior pixels
  repeat N iterations:
    for each interior pixel:
      new = average(left, right, up, down)
      pixel = pixel + omega * (new - pixel)
  paste solved interior back into frame
  encode with explicit format and quality
```

## Alpha-Blend Reversal Cautions

`gemini-watermark-remover` and similar standard Gemini watermark tools may
assume:

- a fixed default position;
- a fixed logo size;
- a known white/off-white logo color;
- an unscaled overlay alpha mask.

Those assumptions break when the source was rendered, scaled, cropped, or
re-encoded as video frames. If forced alpha reversal leaves orange/colored
fringes, star contours, or halo artifacts, stop and switch to inpaint.

When debugging a failed repo/tool run, record:

```text
tool command:
tool version or commit:
meta.applied:
skipReason:
decisionTier:
reported position:
measured real position:
visible artifact after processing:
fallback chosen:
```

## Batch QA Checklist

- [ ] Backup exists and contains the same number of original frames.
- [ ] Output frame count matches input frame count.
- [ ] Filenames and ordering are preserved.
- [ ] Representative early/mid/late frames are visually clean.
- [ ] Transition frames are checked separately.
- [ ] Former watermark core matches nearby background within expected noise.
- [ ] No smearing, halos, colored outlines, or blocky re-encode artifacts.
- [ ] Git status is understood before commit; do not commit generated frames
      unless the user explicitly asks.

## Handoff Template

When finished, report:

- source and backup directories;
- frame count, dimensions, output format, and quality;
- measured watermark bounds and patch coordinates;
- method selected and why other methods were rejected;
- QA frames inspected and result;
- remaining decisions such as backup deletion, re-encoding quality, or commit.
