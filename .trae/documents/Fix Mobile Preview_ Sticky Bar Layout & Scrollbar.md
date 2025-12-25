I will optimize the mobile preview by refining the sticky bar layout and hiding the scrollbar.

### 1. Hide Scrollbar
- **Update `app/styles/customize.css`:**
  - Target `.mock-store-preview` (the scrollable container).
  - Add `scrollbar-width: none` (Firefox) and `::-webkit-scrollbar { display: none }` (Chrome/Safari) to hide the scrollbar while maintaining scroll functionality.

### 2. Optimize Sticky Bar for Mobile
- **Update `app/styles/customize.css`:**
  - **Layout:** Switch `.preview-container.mobile .sb-main` from `column` to `row` to mimic standard mobile sticky bars (saving vertical space).
  - **Content:** 
    - Reduce padding and gap for mobile.
    - Make the product thumbnail smaller (32px).
    - Hide the Variant and Quantity selectors on mobile (`.preview-container.mobile .sb-variant-select`, etc.) to prevent overcrowding.
    - Ensure the "Add to Cart" button is prominent but fits within the row.
  - **Typography:** Reduce font sizes for title and price in the mobile view.

- **Update `app/routes/app._index.tsx`:**
  - Adjust the inline CSS variables for the sticky bar wrapper:
    - Reduce `--sb-layout-margin` and `--sb-layout-width` logic to be responsive (tighter margins when `previewMode === 'mobile'`) so the "floating" bar doesn't look like it's floating too far from the edges.
