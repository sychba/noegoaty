# Eliminate Bottom Gray Space in Preview Step

I will modify `app/routes/app._index.tsx` to completely remove the gray border/space at the bottom of the screen in Step 3.

## 1. Global Layout Override for Step 3

The "gray space" is likely caused by the default padding of the Shopify Polaris `Page` component or the default body/html styling in the iframe context.

I will implement a more aggressive style override specifically for the Step 3 container:

*   **Position Fixed/Absolute Strategy:** instead of relying on `calc(100vh - 80px)`, I will set the Step 3 container to `position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 1000;`.
*   **Remove Margins:** Ensure `margin: 0` on all sides.
*   **Background:** Force the background to white (or the desired color) to cover any underlying gray from the main app container.

## 2. Structure Update

*   **Header:** Stays at the top.
*   **Preview Area:** `flex: 1` to take up all remaining space.
*   **Bottom Bar:** Fixed height, anchored at the bottom.

## 3. Implementation Details

I will modify the `renderStep3` function in `app/routes/app._index.tsx`:

```jsx
const renderStep3 = () => (
  <div style={{
    position: "fixed", // Break out of the Polaris Page flow
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 500, // High enough to cover app padding, low enough for modals
    display: "flex",
    flexDirection: "column",
    background: "#f1f2f4",
    // No margins needed if fixed
  }}>
    {/* ... Header ... */}
    {/* ... Preview Area ... */}
    {/* ... Bottom Bar ... */}
  </div>
);
```

This `position: fixed` approach is the most reliable way to "break out" of the parent container's padding constraints in a Shopify App Bridge app (which is rendered inside an iframe).

## 4. Verification

*   Verify that the "gray strip" at the bottom is gone.
*   Verify that the layout is still responsive and the bottom bar is accessible.
*   Verify that navigation (Back/Next) still works correctly.
