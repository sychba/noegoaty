# Fix Sticky Bar Updates & Preview Alignment

## 1. Storefront: Make `sticky_bar.liquid` Dynamic
*   **File**: `extensions/theme-extension/blocks/sticky_bar.liquid`
*   **Goal**: Ensure the bar updates when settings change in the dashboard.
*   **Changes**:
    *   **Colors**: Replace hardcoded `#000000`/`#ffffff` with `app_config.display.backgroundColor` and `textColor`.
    *   **Button**: Replace hardcoded `#2563eb` with `app_config.button.color`.
    *   **Position**: Use `app_config.settings.position` to set `top` or `bottom` CSS properties.
    *   **Layout**: Use `app_config.settings.layout` to switch between "Docked" (full width) and "Floating" (pill/card) styles.
    *   **Opacity**: Bind `bg_opacity` to `app_config.display.glassy`.

## 2. Dashboard: Sync Preview & Defaults
*   **File**: `app/routes/app.customize.tsx`
*   **Goal**: Make the preview look exactly like the "great" design in the shop.
*   **Changes**:
    *   **Defaults**: Update `DEFAULT_CONFIG` to match the "Dark Glassy Pill" design the user likes (Black background, White text, Blue button).
    *   **Preview CSS**: Tweaking the inline styles in the `Live Preview` section to match the padding, gap, and rounded corners of the actual liquid file.

## 3. Dashboard: Sync Home Preview
*   **File**: `app/routes/app._index.tsx`
*   **Goal**: Ensure the mini-preview on the home dashboard also reflects the correct design.
*   **Changes**: Apply the same styling fixes to the mini-preview component.
