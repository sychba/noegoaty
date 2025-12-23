# Update Onboarding Stepper with Design First & Live Preview

I will modify `app/routes/app._index.tsx` to implement the requested changes to the onboarding flow.

## 1. Reorder & Restructure Steps
- **Step 1:** Activate App Embed (Unchanged)
- **Step 2 (New):** Choose Style (moved from Step 3)
  - User selects a design preset (Clean, Bold, Glassy, Minimal).
  - Selection updates the local configuration state and moves to Step 3.
- **Step 3 (New):** Customize & Preview (moved/enhanced from Step 2)
  - **Layout:** Split view (Controls on left, Live Preview on right).
  - **Controls:** 
    - Content checkboxes (Image, Title, Price, etc.).
    - Position selector (Top vs Bottom).
  - **Live Preview:** 
    - Reuse the preview component logic from the Customize page.
    - Updates in real-time as the user toggles controls.

## 2. Technical Implementation
- **Imports:** Add `import "../styles/customize.css";` to `app._index.tsx`.
- **State Management:** 
  - Expand `configOptions` state to store the full configuration object (including `display`, `settings`, `button`, etc.) to support the preview.
  - Initialize state with `storedConfig` or a `DEFAULT_CONFIG` fallback.
- **Preview Component:** 
  - Port the "Mock Browser" and "Sticky Bar" JSX from `app.customize.tsx` into `renderStep3`.
  - Ensure CSS classes match those in `customize.css`.
- **Step Logic:**
  - `renderStep2` (Design): Updates `configOptions` with the selected preset's values.
  - `renderStep3` (Customize): Reads from `configOptions` to render the inputs and the preview.

## 3. Verification
- Verify the stepper flows correctly: Embed -> Design -> Customize -> Dashboard.
- Verify selecting a design preset correctly applies the style to the preview in the next step.
- Verify the preview updates immediately when toggling content or changing position.
- Verify the final save persists all settings to the backend.