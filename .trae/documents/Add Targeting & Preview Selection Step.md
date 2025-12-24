# Add "Targeting & Preview Selection" Step to Onboarding

I will modify `app/routes/app._index.tsx` to insert a new step into the onboarding flow.

## 1. New Step: "Where to Display?" (Step 2)
I will insert a new step between "Activate" (Step 1) and "Choose Style" (now Step 3).

**UI Components:**
- **Product Selection Resource Picker:**
  - Use `@shopify/app-bridge-react`'s `ResourcePicker` (type: Product).
  - Allow the user to select specific products *or* "All Products".
  - If "All Products" is selected (default), we still ask them to pick *one* representative product to use for the preview.
- **Display Rules (Radio Buttons):**
  - "All Products" (Default)
  - "Specific Products" (triggers picker)
  - "Specific Collections" (triggers picker)

**Logic:**
- When a product is selected for preview, we store its ID/Handle in the local state.
- We use this selected product's data to drive the Live Preview in subsequent steps (Style & Customize).
- We persist the targeting rules (All vs Specific) to the backend config.

## 2. Updated Stepper Flow
1.  **Welcome & Activate** (Unchanged)
2.  **Display Settings** (New) -> Select Target & Preview Product
3.  **Choose Style** (Old Step 2) -> Uses selected product for preview
4.  **Customize & Preview** (Old Step 3) -> Uses selected product for preview

## 3. Data Handling
- I need to fetch the *details* of the selected preview product.
- Since the ResourcePicker returns basic info, I might need to fetch more details (like variants/prices) or the ResourcePicker might provide enough.
- **Correction:** The ResourcePicker provides images, variants, and basic info. This is sufficient for the preview without an extra API call in most cases.

## 4. Implementation Details
- Import `ResourcePicker` from `@shopify/app-bridge-react`.
- Add state for `showResourcePicker`, `selectedPreviewProduct`, and `targetingRule`.
- Update `handleNextStep` to save these new config values.
- Update `renderStep2` (new) and rename existing steps to `renderStep3` and `renderStep4`.

## 5. Verification
- Verify Resource Picker opens and allows selection.
- Verify the selected product appears in the preview in the next steps.
- Verify the targeting rule is saved.