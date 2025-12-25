I will implement a robust style switching system by introducing a `DEFAULT_CONFIG` constant and updating the preset selection logic to always strictly merge the selected preset against this default state, rather than carrying over potential "pollution" from the previous state.

### 1. Define `DEFAULT_CONFIG`
- **In `app/routes/app._index.tsx`:**
  - Create a constant `DEFAULT_CONFIG` object outside the component (or inside `loader`/top level) that defines the "clean slate" state for all settings:
    - `display`: Standard colors, no glass.
    - `button`: Standard blue/white.
    - `settings`: Docked, bottom.
    - `product`: All elements visible (`showImage`, `showTitle`, `showPrice` all `true`).
    - `controls`: All visible (`showVariantSelector`, `showQuantitySelector` all `true`).
    - `announcement`: Disabled.

### 2. Update Preset Selection Logic
- **In `app/routes/app._index.tsx` (Step 3 `PRESETS.map`):**
  - Modify the `onClick` handler.
  - Instead of spreading `...prev` (which carries over hidden elements from "Minimalist" to "Modern Glass"), the new state will be calculated as:
    - Base: `DEFAULT_CONFIG`
    - Override: `preset.config`
  - This ensures that if a preset (like Modern Glass) *doesn't* specify `product` visibility, it falls back to `DEFAULT_CONFIG` (visible) instead of the previous state (hidden).

### 3. Verify Scenarios
- **Minimalist -> Modern Glass:**
  - Minimalist sets `showPrice: false`.
  - Clicking Modern Glass (which has no `product` config) will now use `DEFAULT_CONFIG.product` (where `showPrice: true`), correctly restoring visibility.
- **Glassmorphism -> Modern Glass:**
  - Both will start from `DEFAULT_CONFIG`, ensuring no residual settings leak.

### 4. Code Structure
- I will introduce a simple `deepMerge` utility or just strictly spread top-level keys if the nesting isn't too deep (it's 2 levels: category -> setting), to keep it clean and robust.

This solves the user's issue of "sticky" hidden states when switching between styles.