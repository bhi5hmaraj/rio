# Rio Extension Icons

This folder should contain the extension icons in the following sizes:

- `icon16.png` - 16x16px (toolbar icon)
- `icon32.png` - 32x32px (toolbar icon @2x)
- `icon48.png` - 48x48px (extension management page)
- `icon128.png` - 128x128px (Chrome Web Store)

## Placeholder Icons (Temporary)

For development, you can use simple colored squares:

```bash
# Using ImageMagick (if installed):
convert -size 16x16 xc:#6366f1 icon16.png
convert -size 32x32 xc:#6366f1 icon32.png
convert -size 48x48 xc:#6366f1 icon48.png
convert -size 128x128 xc:#6366f1 icon128.png
```

Or create them manually in any image editor.

## Design Guidelines

- **Color scheme:** Rio brand indigo (#6366f1)
- **Style:** Simple, modern, recognizable at small sizes
- **Icon concept:** Could be "R" letter mark, annotation symbol, or AI-related iconography

TODO: Design and add proper icons before v1.0 release.
