import { useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  BlockStack,
  Card,
  Text,
  Button,
  InlineStack,
  ProgressBar,
  Box,
  Badge,
  Icon,
  Divider,
  Grid,
  Checkbox,
  Layout,
  Banner,
  Select,
} from "@shopify/polaris";
import {
  EditIcon,
  AppsIcon,
  ExternalIcon,
  MobileIcon,
  DesktopIcon,
  RefreshIcon,
  ArrowLeftIcon
} from "@shopify/polaris-icons";
import "../styles/customize.css";

// --- PRESETS ---
const PRESETS = [
  {
    id: 'clean',
    title: 'Clean & Simple',
    description: 'Professional and trustworthy.',
    config: {
      display: { backgroundColor: "#ffffff", textColor: "#202223", rounded: "rounded", glassy: false },
      button: { color: "#005bd3", textColor: "#ffffff" },
      settings: { layout: 'docked', position: 'bottom' }
    }
  },
  {
    id: 'bold',
    title: 'Bold Dark',
    description: 'High contrast for maximum visibility.',
    config: {
      display: { backgroundColor: "#202223", textColor: "#ffffff", rounded: "none", glassy: false },
      button: { color: "#ffffff", textColor: "#202223" },
      settings: { layout: 'docked', position: 'bottom' }
    }
  },
  {
    id: 'glassy',
    title: 'Modern Glass',
    description: 'Trendy frosted glass effect.',
    config: {
      display: { backgroundColor: "#202223", textColor: "#ffffff", rounded: "pill", glassy: true },
      button: { color: "#005bd3", textColor: "#ffffff" },
      settings: { layout: 'floating', position: 'bottom' }
    }
  },
  {
    id: 'minimal',
    title: 'Minimalist',
    description: 'Less is more. Focus on the button.',
    config: {
      display: { backgroundColor: "#f1f2f4", textColor: "#202223", rounded: "rounded", glassy: false },
      button: { color: "#202223", textColor: "#ffffff" },
      product: { showImage: false, showTitle: true, showPrice: false },
      settings: { layout: 'floating', position: 'top' }
    }
  }
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // 1. Fetch Metafields
  const shopQuery = await admin.graphql(
    `query {
      shop {
        id
        config: metafield(namespace: "stickyadd", key: "config") { value }
        onboarding: metafield(namespace: "stickyadd", key: "onboarding") { value }
      }
    }`
  );
  
  const shopResponse = await shopQuery.json();
  const shopData = shopResponse.data.shop;

  // 2. Fetch Theme Settings (for embed check)
  let themeData = null;
  try {
    const themesQuery = await admin.graphql(
      `query {
        themes(first: 1, roles: MAIN) {
          edges {
            node {
              id
              files(filenames: ["config/settings_data.json"]) {
                edges {
                  node {
                    body {
                      ... on OnlineStoreThemeFileBodyText {
                        content
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`
    );
    const themesResponse = await themesQuery.json();
    themeData = themesResponse.data?.themes?.edges?.[0]?.node;
  } catch (error) {
    console.warn("Could not fetch theme settings.", error);
  }

  // Parse Config
  const storedConfig = shopData.config?.value ? JSON.parse(shopData.config.value) : null;
  const isAppEnabled = storedConfig?.enabled ?? false;

  // Parse Onboarding
  const storedOnboarding = shopData.onboarding?.value ? JSON.parse(shopData.onboarding.value) : null;
  // We use a simple "setupComplete" flag or check if step 3 is done
  const setupComplete = storedOnboarding?.setupComplete ?? false;
  const currentStep = storedOnboarding?.currentStep ?? 1;

  // 3. Check App Embed Status
  let isEmbedActive = false;
  if (themeData) {
    const settingsFile = themeData.files?.edges?.[0]?.node?.body?.content;
    if (settingsFile) {
      try {
        const settings = JSON.parse(settingsFile);
        const blocks = settings.current?.blocks || {};
        isEmbedActive = Object.values(blocks).some((block: any) => 
          block.type.includes("/blocks/sticky_bar/") && block.disabled !== true
        );
      } catch (e) {
        console.error("Error parsing settings_data.json", e);
      }
    }
  }

  return { 
    shop: session.shop,
    setupComplete,
    currentStep,
    isAppEnabled,
    isEmbedActive,
    shopId: shopData.id,
    storedConfig // Pass this to pre-fill config form
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const shopId = formData.get("shopId");

  if (actionType === "saveStep") {
    const step = Number(formData.get("step"));
    const setupComplete = formData.get("setupComplete") === "true";
    const reset = formData.get("reset") === "true";
    const configUpdate = formData.get("configUpdate");
    
    // 1. Update Onboarding State
    let onboardingValue = { currentStep: step + 1, setupComplete };
    
    if (reset) {
        onboardingValue = { currentStep: 1, setupComplete: false };
    }

    const onboardingMetafield = {
      namespace: "stickyadd",
      key: "onboarding",
      type: "json",
      value: JSON.stringify(onboardingValue),
      ownerId: shopId
    };

    // 2. Update Config if provided
    const metafields = [onboardingMetafield];
    
    if (configUpdate) {
      // We need to fetch existing config first to merge, or we trust the frontend to send partials
      // Ideally we fetch, but for speed we'll assume the frontend sends what it wants to merge or we merge blindly?
      // Better to fetch current config here to be safe, but we can also just use the value passed if we are careful.
      // Let's fetch current config to do a deep merge properly.
      const queryResponse = await admin.graphql(
        `query {
          shop {
            metafield(namespace: "stickyadd", key: "config") { value }
          }
        }`
      );
      const queryJson = await queryResponse.json();
      const existingConfig = queryJson.data.shop.metafield?.value 
        ? JSON.parse(queryJson.data.shop.metafield.value) 
        : {};
      
      const updates = JSON.parse(configUpdate.toString());
      
      // Deep merge helper (simplified)
      const merge = (target: any, source: any) => {
        for (const key in source) {
          if (source[key] instanceof Object && key in target) {
            Object.assign(source[key], merge(target[key], source[key]));
          }
        }
        Object.assign(target || {}, source);
        return target;
      };

      const newConfig = merge(existingConfig, updates);

      metafields.push({
        namespace: "stickyadd",
        key: "config",
        type: "json",
        value: JSON.stringify(newConfig),
        ownerId: shopId
      });
    }

    await admin.graphql(
      `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }`,
      { variables: { metafields } }
    );
  }

  return { status: "success" };
};

export default function Index() {
  const { shop, setupComplete, currentStep, isAppEnabled, isEmbedActive, shopId, storedConfig } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  // Local state for the stepper
  const [step, setStep] = useState(currentStep);
  const [loading, setLoading] = useState(false);

  // Config State for Step 3
  const [configOptions, setConfigOptions] = useState<any>({
    settings: storedConfig?.settings || { position: "bottom", layout: "docked" },
    product: storedConfig?.product || { showImage: true, showTitle: true, showPrice: true },
    controls: storedConfig?.controls || { showVariantSelector: true, showQuantitySelector: true },
    display: storedConfig?.display || { backgroundColor: "#ffffff", textColor: "#202223", rounded: "rounded", glassy: false },
    button: storedConfig?.button || { color: "#005bd3", textColor: "#ffffff", text: "Add to cart" },
    announcement: storedConfig?.announcement || { enabled: false, text: "", color: "", backgroundColor: "" }
  });

  const handleNextStep = (configUpdate: any = null, finish = false) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("actionType", "saveStep");
    formData.append("step", String(step));
    formData.append("shopId", shopId);
    
    if (finish) {
      formData.append("setupComplete", "true");
    } else if (configUpdate?.reset) {
        formData.append("reset", "true");
    }

    if (configUpdate && !configUpdate.reset) {
      formData.append("configUpdate", JSON.stringify(configUpdate));
    }

    submit(formData, { method: "post" });
    
    // Optimistic UI update
    if (configUpdate?.reset) {
        setStep(1);
        setLoading(false);
    } else if (!finish) {
      setStep(step + 1);
      setLoading(false);
    }
  };

  const handleBackStep = () => {
      if (step > 1) {
          setStep(step - 1);
          // Optional: Sync back step to server if we want strict persistence on back navigation too,
          // but for now local state is enough as forward navigation saves progress.
      }
  };

  const openThemeEditor = () => {
    window.open(`https://${shop}/admin/themes/current/editor?context=apps`, '_blank');
  };

  // --- RENDER HELPERS ---

  // STEP 1: WELCOME & ACTIVATE
  const renderStep1 = () => (
    <BlockStack gap="500">
      <BlockStack gap="200">
        <Text variant="headingLg" as="h2">Welcome to Sticky Add to Cart!</Text>
        <Text tone="subdued" as="p">Let's get you set up in less than a minute.</Text>
      </BlockStack>
      
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text variant="headingMd" as="h3">1. Activate App Embed</Text>
              <Text tone="subdued" as="p">
                This allows the sticky bar to appear on your store.
              </Text>
            </BlockStack>
            <Icon source={AppsIcon} tone="base" />
          </InlineStack>
          
          <Banner tone={isEmbedActive ? "success" : "warning"}>
            {isEmbedActive 
              ? "App embed is active! You are ready to proceed." 
              : "App embed is not detected. Please enable it in your theme editor."}
          </Banner>

          <InlineStack gap="300">
            <Button variant="primary" onClick={openThemeEditor} icon={ExternalIcon}>
              Open Theme Editor
            </Button>
            <Button 
              disabled={!isEmbedActive} 
              onClick={() => handleNextStep({ enabled: true })} // Enable app internally too
            >
              Next Step
            </Button>
            {/* Bypass for testing if detection fails */}
            {!isEmbedActive && (
              <Button variant="plain" onClick={() => handleNextStep({ enabled: true })}>
                I've enabled it, continue
              </Button>
            )}
          </InlineStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );

  // STEP 2: STYLE SELECTION
  const renderStep2 = () => (
    <BlockStack gap="500">
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
                <Text variant="headingLg" as="h2">Choose a Style</Text>
                <Text tone="subdued" as="p">Select a design that fits your brand.</Text>
            </BlockStack>
            <Button variant="plain" icon={ArrowLeftIcon} onClick={handleBackStep}>Back</Button>
        </InlineStack>
      </BlockStack>

      <Grid>
        {PRESETS.map((preset) => (
          <Grid.Cell key={preset.id} columnSpan={{xs: 6, sm: 6, md: 3, lg: 3, xl: 3}}>
            <div 
              style={{cursor: 'pointer', height: '100%'}}
              onClick={() => {
                // Update local config with preset values but don't save to backend yet
                setConfigOptions((prev: any) => ({
                    ...prev,
                    ...preset.config,
                    // Ensure we merge deep objects if needed, but presets are usually complete for their sections
                    display: { ...prev.display, ...preset.config.display },
                    button: { ...prev.button, ...preset.config.button },
                    settings: { ...prev.settings, ...preset.config.settings }
                }));
                handleNextStep(null, false); // Just move to next step, don't save config yet
              }}
            >
              <Card>
                <BlockStack gap="300">
                  {/* Mini Preview Visualization */}
                  <Box 
                    background="bg-surface-secondary" 
                    padding="400" 
                    borderRadius="200"
                    minHeight="120px"
                  >
                    <div style={{
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: '100%',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: '100%',
                        padding: '8px',
                        background: preset.config.display.backgroundColor,
                        color: preset.config.display.textColor,
                        borderRadius: preset.config.display.rounded === 'pill' ? '20px' : (preset.config.display.rounded === 'rounded' ? '6px' : '0px'),
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                      }}>
                         <div style={{width: 20, height: 20, background: '#ddd', borderRadius: 4}}></div>
                         <div style={{flex: 1, height: 6, background: preset.config.display.textColor, opacity: 0.3, borderRadius: 2}}></div>
                         <div style={{
                           width: 30, 
                           height: 20, 
                           background: preset.config.button.color, 
                           borderRadius: 4
                         }}></div>
                      </div>
                    </div>
                  </Box>
                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h3">{preset.title}</Text>
                    <Text variant="bodySm" tone="subdued" as="p">{preset.description}</Text>
                  </BlockStack>
                  <Button fullWidth>Select</Button>
                </BlockStack>
              </Card>
            </div>
          </Grid.Cell>
        ))}
      </Grid>
    </BlockStack>
  );

  // STEP 3: CUSTOMIZE & PREVIEW
  const renderStep3 = () => (
    <BlockStack gap="500">
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
                <Text variant="headingLg" as="h2">Customize & Preview</Text>
                <Text tone="subdued" as="p">Fine-tune the content and position. Watch it update live!</Text>
            </BlockStack>
            <Button variant="plain" icon={ArrowLeftIcon} onClick={handleBackStep}>Back</Button>
        </InlineStack>
      </BlockStack>

      <Layout>
        {/* LEFT: CONTROLS */}
        <Layout.Section variant="oneThird">
            <Card>
                <BlockStack gap="500">
                    <BlockStack gap="400">
                        <Text variant="headingSm" as="h3">Content</Text>
                        <Checkbox
                            label="Show Product Image"
                            checked={configOptions.product.showImage}
                            onChange={(val) => setConfigOptions((prev: any) => ({...prev, product: {...prev.product, showImage: val}}))}
                        />
                        <Checkbox
                            label="Show Product Title"
                            checked={configOptions.product.showTitle}
                            onChange={(val) => setConfigOptions((prev: any) => ({...prev, product: {...prev.product, showTitle: val}}))}
                        />
                        <Checkbox
                            label="Show Price"
                            checked={configOptions.product.showPrice}
                            onChange={(val) => setConfigOptions((prev: any) => ({...prev, product: {...prev.product, showPrice: val}}))}
                        />
                    </BlockStack>
                    
                    <Divider />

                    <BlockStack gap="400">
                        <Text variant="headingSm" as="h3">Controls</Text>
                        <Checkbox
                            label="Show Variant Selector"
                            helpText="Allow switching variants"
                            checked={configOptions.controls.showVariantSelector}
                            onChange={(val) => setConfigOptions((prev: any) => ({...prev, controls: {...prev.controls, showVariantSelector: val}}))}
                        />
                        <Checkbox
                            label="Show Quantity Selector"
                            checked={configOptions.controls.showQuantitySelector}
                            onChange={(val) => setConfigOptions((prev: any) => ({...prev, controls: {...prev.controls, showQuantitySelector: val}}))}
                        />
                    </BlockStack>

                    <Divider />

                     <BlockStack gap="400">
                        <Text variant="headingSm" as="h3">Position</Text>
                         <Select
                            label="Position"
                            labelHidden
                            options={[
                                {label: 'Bottom of screen', value: 'bottom'},
                                {label: 'Top of screen', value: 'top'},
                            ]}
                            value={configOptions.settings.position}
                            onChange={(val) => setConfigOptions((prev: any) => ({...prev, settings: {...prev.settings, position: val}}))}
                        />
                    </BlockStack>

                    <Button variant="primary" size="large" onClick={() => handleNextStep(configOptions, true)}>
                        Finish Setup
                    </Button>
                </BlockStack>
            </Card>
        </Layout.Section>

        {/* RIGHT: PREVIEW */}
        <Layout.Section>
             <Card>
                <BlockStack gap="400">
                    <Text variant="headingSm" as="h2">Live Preview</Text>
                    <Box 
                        background="bg-surface-secondary" 
                        padding="400" 
                        borderRadius="300"
                        minHeight="500px"
                    >
                         <div className="preview-container desktop">
                            {/* MOCK BROWSER */}
                            <div className="mock-browser">
                                <div className="mock-header">
                                    <div className="mock-dot red"></div>
                                    <div className="mock-dot yellow"></div>
                                    <div className="mock-dot green"></div>
                                    <div className="mock-url">yourstore.com/products/classic-tshirt</div>
                                </div>
                                
                                <div className="mock-content">
                                    <div className="mock-hero">
                                        <div className="mock-img-placeholder"></div>
                                        <div className="mock-details">
                                            <div className="mock-line title"></div>
                                            <div className="mock-line price"></div>
                                            <div className="mock-line desc"></div>
                                            <div className="mock-line desc short"></div>
                                            <div className="mock-atc-btn">Add to Cart</div>
                                        </div>
                                    </div>
                                    <div className="mock-section"></div>
                                </div>

                                {/* ACTUAL STICKY BAR RENDER */}
                                <div 
                                    className={`sticky-bar-preview ${configOptions.settings.position}`}
                                    style={{
                                        '--sb-bg': configOptions.display.backgroundColor,
                                        '--sb-text': configOptions.display.textColor,
                                        '--sb-btn-bg': configOptions.button.color,
                                        '--sb-btn-text': configOptions.button.textColor,
                                        '--sb-radius': configOptions.display.rounded === 'pill' ? '999px' : (configOptions.display.rounded === 'rounded' ? '12px' : '0px'),
                                        '--sb-blur': configOptions.display.glassy ? '10px' : '0px',
                                        '--sb-layout-margin': configOptions.settings.layout === 'floating' ? '20px' : '0px',
                                        '--sb-layout-width': configOptions.settings.layout === 'floating' ? 'calc(100% - 40px)' : '100%',
                                        '--sb-layout-radius': configOptions.settings.layout === 'floating' ? '16px' : '0px',
                                    } as any}
                                >
                                    {configOptions.announcement?.enabled && (
                                        <div className="sb-announcement" style={{
                                            backgroundColor: configOptions.announcement.backgroundColor,
                                            color: configOptions.announcement.color
                                        }}>
                                            {configOptions.announcement.text}
                                        </div>
                                    )}
                                    
                                    <div className="sb-main">
                                        <div className="sb-product">
                                            {configOptions.product.showImage && <div className="sb-thumb"></div>}
                                            <div className="sb-info">
                                                {configOptions.product.showTitle && <span className="sb-title">Classic T-Shirt</span>}
                                                {configOptions.product.showPrice && <span className="sb-price">$29.00</span>}
                                            </div>
                                        </div>

                                        <div className="sb-actions">
                                            {configOptions.controls.showVariantSelector && (
                                                <div className="sb-variant-select">Medium / Black</div>
                                            )}
                                            {configOptions.controls.showQuantitySelector && (
                                                 <div style={{border:'1px solid rgba(255,255,255,0.3)', borderRadius: 4, padding: '6px 10px', fontSize: 13, opacity: 0.8}}>1</div>
                                            )}
                                            <button className="sb-atc-button">
                                                {configOptions.button.text}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </Box>
                </BlockStack>
            </Card>
        </Layout.Section>
      </Layout>
    </BlockStack>
  );

  // DASHBOARD (Post-Setup)
  const renderDashboard = () => (
    <BlockStack gap="500">
       <Banner tone="success" onDismiss={() => {}}>
        <p>Setup complete! Your sticky bar is active.</p>
      </Banner>

      <Layout>
        <Layout.Section variant="oneHalf">
           <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">App Status</Text>
                <Badge tone={isAppEnabled ? "success" : "attention"}>{isAppEnabled ? "Active" : "Inactive"}</Badge>
              </InlineStack>
              <Text as="p">
                {isAppEnabled 
                  ? "The sticky bar is currently visible on your storefront." 
                  : "The sticky bar is disabled. Enable it to start converting visitors."}
              </Text>
              <InlineStack gap="300">
                <Button onClick={() => openThemeEditor()}>Theme Editor</Button>
                <Button icon={RefreshIcon} onClick={() => handleNextStep({ reset: true })}>Reset Setup</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
        
        <Layout.Section variant="oneHalf">
           <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Customization</Text>
              <Text as="p">
                Want to change the look? Tweak colors, settings, and more.
              </Text>
              <Button variant="primary" onClick={() => navigate("/app/customize")} icon={EditIcon}>
                Customize Appearance
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </BlockStack>
  );

  return (
    <Page fullWidth>
      {!setupComplete ? (
        <div style={{maxWidth: '800px', margin: '0 auto'}}>
          <BlockStack gap="600">
             {/* Stepper Progress */}
             <BlockStack gap="200">
               <InlineStack align="space-between">
                  <Text variant="bodySm" tone="subdued" as="span">Step {step} of 3</Text>
                  <Text variant="bodySm" tone="subdued" as="span">{Math.round(((step - 1) / 3) * 100)}% Complete</Text>
               </InlineStack>
               <ProgressBar progress={((step - 1) / 3) * 100} size="small" tone="primary" />
             </BlockStack>

             {step === 1 && renderStep1()}
             {step === 2 && renderStep2()}
             {step === 3 && renderStep3()}
          </BlockStack>
        </div>
      ) : (
        renderDashboard()
      )}
    </Page>
  );
}
