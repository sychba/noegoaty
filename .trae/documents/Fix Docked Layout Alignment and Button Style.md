# Fix Docked Layout Alignment and Button Style

## 1. Storefront Fixes (`sticky_bar.liquid`)
*   **Alignment**: Change `justify-content: center` to `justify-content: space-between` for the `docked` layout to ensure text and buttons are properly spaced, fixing the centering issue.
*   **Button Style**: Change `border-radius: 9999px` (pill) to `border-radius: 4px` (rounded rectangle) for the `.sticky-add-btn` to match the preview and user preference.

## 2. Preview Consistency
*   The `sticky_bar.liquid` changes will now align the live storefront with the existing preview styles in `customize.css`, ensuring what the user sees in the app dashboard matches the actual storefront.
