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
  RadioButton,
} from "@shopify/polaris";
// @ts-ignore
// import { ResourcePicker } from "@shopify/app-bridge-react"; 
// V4 removed ResourcePicker component. We must use window.shopify.resourcePicker
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
  let firstProduct = null;

  try {
    const dataQuery = await admin.graphql(
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
        products(first: 1, sortKey: CREATED_AT, reverse: false) {
          edges {
            node {
              title
              handle
              featuredImage {
                url
              }
              variants(first: 1) {
                edges {
                  node {
                    price
                    title
                  }
                }
              }
            }
          }
        }
      }`
    );
    const dataResponse = await dataQuery.json();
    themeData = dataResponse.data?.themes?.edges?.[0]?.node;
    firstProduct = dataResponse.data?.products?.edges?.[0]?.node;
  } catch (error) {
    console.warn("Could not fetch theme/product settings.", error);
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
    storedConfig, // Pass this to pre-fill config form
    firstProduct
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
  const { shop, setupComplete, currentStep, isAppEnabled, isEmbedActive, shopId, storedConfig, firstProduct } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  // Local state for the stepper
  const [step, setStep] = useState(currentStep);
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  // Targeting State for Step 2
  const [targetingRule, setTargetingRule] = useState<'all' | 'specific'>('all');
  // const [showResourcePicker, setShowResourcePicker] = useState(false); // No longer needed as state, we call function
  const [selectedPreviewProduct, setSelectedPreviewProduct] = useState<any>(firstProduct);

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

  const openResourcePicker = async () => {
      // @ts-ignore
      if (window.shopify) {
          // @ts-ignore
          const selected = await window.shopify.resourcePicker({
              type: 'product',
              multiple: false,
              action: 'select'
          });
          
          if (selected && selected.length > 0) {
              handleResourceSelection(selected[0]);
          }
      } else {
          console.warn("Shopify App Bridge not found");
      }
  };

  const handleResourceSelection = (selection: any) => {
    if (selection) {
        const product = {
            title: selection.title,
            handle: selection.handle,
            featuredImage: selection.images?.[0] ? { url: selection.images[0].originalSrc } : null,
            variants: {
                edges: selection.variants?.map((v: any) => ({
                    node: {
                        price: v.price,
                        title: v.title
                    }
                })) || []
            }
        };
        setSelectedPreviewProduct(product);
    }
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

  // STEP 2: DISPLAY SETTINGS (TARGETING)
  const renderStep2 = () => (
      <BlockStack gap="500">
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                  <Text variant="headingLg" as="h2">Where to Display?</Text>
                  <Text tone="subdued" as="p">Choose where the sticky bar should appear and pick a product to preview.</Text>
              </BlockStack>
              <Button variant="plain" icon={ArrowLeftIcon} onClick={handleBackStep}>Back</Button>
          </InlineStack>
        </BlockStack>

        <Card>
            <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Display Rules</Text>
                <BlockStack gap="200">
                    <RadioButton
                        label="All Products (Recommended)"
                        helpText="Show the sticky bar on every product page."
                        checked={targetingRule === 'all'}
                        id="target_all"
                        name="targeting"
                        onChange={() => setTargetingRule('all')}
                    />
                    <RadioButton
                        label="Specific Products"
                        helpText="Only show on selected products."
                        checked={targetingRule === 'specific'}
                        id="target_specific"
                        name="targeting"
                        onChange={() => {
                            setTargetingRule('specific');
                            openResourcePicker();
                        }}
                    />
                </BlockStack>

                <Divider />

                <BlockStack gap="200">
                    <Text variant="headingSm" as="h3">Preview Product</Text>
                    <Text tone="subdued" as="p">This product will be used to generate the live preview in the next steps.</Text>
                    
                    <InlineStack align="start" blockAlign="center" gap="400">
                         {selectedPreviewProduct?.featuredImage?.url && (
                             <img 
                                src={selectedPreviewProduct.featuredImage.url} 
                                alt="" 
                                style={{width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee'}} 
                            />
                         )}
                         <BlockStack gap="100">
                             <Text variant="bodyMd" fontWeight="bold" as="span">{selectedPreviewProduct?.title || "No product selected"}</Text>
                             <Button variant="plain" onClick={() => openResourcePicker()}>Change Preview Product</Button>
                         </BlockStack>
                    </InlineStack>
                </BlockStack>

                <InlineStack align="end">
                    <Button variant="primary" onClick={() => handleNextStep()}>Next Step</Button>
                </InlineStack>
            </BlockStack>
        </Card>
      </BlockStack>
  );

  // STEP 3: STYLE SELECTION
  const renderStep3 = () => (
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

      <Layout>
        {/* LEFT: PRESETS */}
        <Layout.Section variant="oneThird">
            <BlockStack gap="400">
                <Grid>
                    {PRESETS.map((preset) => (
                    <Grid.Cell key={preset.id} columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
                        <div 
                        style={{cursor: 'pointer'}}
                        onClick={() => {
                            // Update local config with preset values immediately
                            setConfigOptions((prev: any) => ({
                                ...prev,
                                ...preset.config,
                                display: { ...prev.display, ...preset.config.display },
                                button: { ...prev.button, ...preset.config.button },
                                settings: { ...prev.settings, ...preset.config.settings }
                            }));
                        }}
                        >
                        <Card>
                            <BlockStack gap="300">
                                {/* Visual Indicator for Selection */}
                                <div style={{
                                    border: JSON.stringify(configOptions.display) === JSON.stringify({ ...configOptions.display, ...preset.config.display }) 
                                            && configOptions.button.color === preset.config.button.color
                                            ? '2px solid #005bd3' : '2px solid transparent',
                                    borderRadius: '8px',
                                    padding: '4px',
                                    margin: '-4px'
                                }}>
                                    <BlockStack gap="100">
                                        <Text variant="headingSm" as="h3">{preset.title}</Text>
                                        <Text variant="bodySm" tone="subdued" as="p">{preset.description}</Text>
                                    </BlockStack>
                                </div>
                            </BlockStack>
                        </Card>
                        </div>
                    </Grid.Cell>
                    ))}
                </Grid>
                <Button fullWidth variant="primary" size="large" onClick={() => handleNextStep(null, false)}>
                    Continue with this Style
                </Button>
            </BlockStack>
        </Layout.Section>

        {/* RIGHT: PREVIEW */}
        <Layout.Section>
             <Card>
                <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingSm" as="h2">Live Preview</Text>
                      <InlineStack gap="200">
                        <Button
                          size="slim"
                          variant={previewMode === "desktop" ? "primary" : "tertiary"}
                          icon={DesktopIcon}
                          onClick={() => setPreviewMode("desktop")}
                        >
                          Desktop
                        </Button>
                        <Button
                          size="slim"
                          variant={previewMode === "mobile" ? "primary" : "tertiary"}
                          icon={MobileIcon}
                          onClick={() => setPreviewMode("mobile")}
                        >
                          Mobile
                        </Button>
                      </InlineStack>
                    </InlineStack>
                    <Box 
                        background="bg-surface-secondary" 
                        padding="400" 
                        borderRadius="300"
                        minHeight="500px"
                    >
                        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                          <div className={`preview-container ${previewMode}`}>
                            <div className="mock-browser">
                                <div className="mock-header">
                                    <div className="mock-dot red"></div>
                                    <div className="mock-dot yellow"></div>
                                    <div className="mock-dot green"></div>
                                    <div className="mock-url">{shop}/products/{selectedPreviewProduct?.handle || 'example-product'}</div>
                                </div>
                                
                                <div className="mock-content" style={{overflow: "hidden", position: "relative"}}>
                                   {selectedPreviewProduct ? (
                                       <div className="mock-store-preview" style={{
                                           width: "100%", 
                                           height: "100%", 
                                           background: "#fff", 
                                           display: "flex", 
                                           flexDirection: "column"
                                        }}>
                                            <div style={{height: 60, borderBottom: "1px solid #eee", display: "flex", alignItems: "center", padding: "0 20px", justifyContent: "space-between"}}>
                                                <div style={{fontWeight: "bold", fontSize: 18}}>{shop.split(".")[0].toUpperCase()}</div>
                                                <div style={{display: "flex", gap: 10}}>
                                                    <div style={{width: 20, height: 2, background: "#333"}}></div>
                                                    <div style={{width: 20, height: 2, background: "#333"}}></div>
                                                </div>
                                            </div>
                                            
                                            <div style={{flex: 1, padding: "40px", display: "flex", gap: "40px", maxWidth: "900px", margin: "0 auto"}}>
                                                <div style={{flex: 1}}>
                                                    {selectedPreviewProduct.featuredImage?.url ? (
                                                        <img src={selectedPreviewProduct.featuredImage.url} alt={selectedPreviewProduct.title} style={{width: "100%", borderRadius: 8}} />
                                                    ) : (
                                                        <div style={{width: "100%", paddingBottom: "100%", background: "#f4f4f4", borderRadius: 8}}></div>
                                                    )}
                                                </div>
                                                <div style={{flex: 1, paddingTop: 20}}>
                                                    <h1 style={{fontSize: 24, fontWeight: "bold", marginBottom: 10}}>{selectedPreviewProduct.title}</h1>
                                                    <div style={{fontSize: 20, marginBottom: 20}}>${selectedPreviewProduct.variants?.edges?.[0]?.node?.price || "29.00"}</div>
                                                    <div style={{height: 100, background: "#f9f9f9", marginBottom: 20, borderRadius: 4}}></div>
                                                    <div style={{height: 50, background: "#202223", borderRadius: 4, width: "200px"}}></div>
                                                </div>
                                            </div>
                                       </div>
                                   ) : (
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
                                   )}
                                </div>

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
                                            {configOptions.product.showImage && (
                                                selectedPreviewProduct?.featuredImage?.url ? (
                                                    <img src={selectedPreviewProduct.featuredImage.url} alt="" className="sb-thumb-img" style={{width: 40, height: 40, objectFit: 'cover', borderRadius: 4}} />
                                                ) : (
                                                    <div className="sb-thumb"></div>
                                                )
                                            )}
                                            <div className="sb-info">
                                                {configOptions.product.showTitle && <span className="sb-title">{selectedPreviewProduct?.title || 'Classic T-Shirt'}</span>}
                                                {configOptions.product.showPrice && <span className="sb-price">${selectedPreviewProduct?.variants?.edges?.[0]?.node?.price || '29.00'}</span>}
                                            </div>
                                        </div>

                                        <div className="sb-actions">
                                            {configOptions.controls.showVariantSelector && (
                                                <div className="sb-variant-select">
                                                    {selectedPreviewProduct?.variants?.edges?.[0]?.node?.title !== 'Default Title' 
                                                        ? selectedPreviewProduct?.variants?.edges?.[0]?.node?.title 
                                                        : 'One Size'}
                                                </div>
                                            )}
                                            {configOptions.controls.showQuantitySelector && (
                                                 <div style={{border:"1px solid rgba(255,255,255,0.3)", borderRadius: 4, padding: "6px 10px", fontSize: 13, opacity: 0.8}}>1</div>
                                            )}
                                            <button className="sb-atc-button">
                                                {configOptions.button.text}
                                            </button>
                                        </div>
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

  // STEP 4: CUSTOMIZE & PREVIEW
  const renderStep4 = () => (
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
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingSm" as="h2">Live Preview</Text>
                      <InlineStack gap="200">
                        <Button
                          size="slim"
                          variant={previewMode === "desktop" ? "primary" : "tertiary"}
                          icon={DesktopIcon}
                          onClick={() => setPreviewMode("desktop")}
                        >
                          Desktop
                        </Button>
                        <Button
                          size="slim"
                          variant={previewMode === "mobile" ? "primary" : "tertiary"}
                          icon={MobileIcon}
                          onClick={() => setPreviewMode("mobile")}
                        >
                          Mobile
                        </Button>
                      </InlineStack>
                    </InlineStack>
                    <Box 
                        background="bg-surface-secondary" 
                        padding="400" 
                        borderRadius="300"
                        minHeight="500px"
                    >
                         <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                           <div className={`preview-container ${previewMode}`}>
                            <div className="mock-browser">
                                <div className="mock-header">
                                    <div className="mock-dot red"></div>
                                    <div className="mock-dot yellow"></div>
                                    <div className="mock-dot green"></div>
                                    <div className="mock-url">{shop}/products/{selectedPreviewProduct?.handle || 'example-product'}</div>
                                </div>
                                
                                <div className="mock-content" style={{overflow: "hidden", position: "relative"}}>
                                   {selectedPreviewProduct ? (
                                       <div className="mock-store-preview" style={{
                                           width: "100%", 
                                           height: "100%", 
                                           background: "#fff", 
                                           display: "flex", 
                                           flexDirection: "column"
                                        }}>
                                            <div style={{height: 60, borderBottom: "1px solid #eee", display: "flex", alignItems: "center", padding: "0 20px", justifyContent: "space-between"}}>
                                                <div style={{fontWeight: "bold", fontSize: 18}}>{shop.split(".")[0].toUpperCase()}</div>
                                                <div style={{display: "flex", gap: 10}}>
                                                    <div style={{width: 20, height: 2, background: "#333"}}></div>
                                                    <div style={{width: 20, height: 2, background: "#333"}}></div>
                                                </div>
                                            </div>
                                            
                                            <div style={{flex: 1, padding: "40px", display: "flex", gap: "40px", maxWidth: "900px", margin: "0 auto"}}>
                                                <div style={{flex: 1}}>
                                                    {selectedPreviewProduct.featuredImage?.url ? (
                                                        <img src={selectedPreviewProduct.featuredImage.url} alt={selectedPreviewProduct.title} style={{width: "100%", borderRadius: 8}} />
                                                    ) : (
                                                        <div style={{width: "100%", paddingBottom: "100%", background: "#f4f4f4", borderRadius: 8}}></div>
                                                    )}
                                                </div>
                                                <div style={{flex: 1, paddingTop: 20}}>
                                                    <h1 style={{fontSize: 24, fontWeight: "bold", marginBottom: 10}}>{selectedPreviewProduct.title}</h1>
                                                    <div style={{fontSize: 20, marginBottom: 20}}>${selectedPreviewProduct.variants?.edges?.[0]?.node?.price || "29.00"}</div>
                                                    <div style={{height: 100, background: "#f9f9f9", marginBottom: 20, borderRadius: 4}}></div>
                                                    <div style={{height: 50, background: "#202223", borderRadius: 4, width: "200px"}}></div>
                                                </div>
                                            </div>
                                       </div>
                                   ) : (
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
                                   )}
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
                                            {configOptions.product.showImage && (
                                                selectedPreviewProduct?.featuredImage?.url ? (
                                                    <img src={selectedPreviewProduct.featuredImage.url} alt="" className="sb-thumb-img" style={{width: 40, height: 40, objectFit: 'cover', borderRadius: 4}} />
                                                ) : (
                                                    <div className="sb-thumb"></div>
                                                )
                                            )}
                                            <div className="sb-info">
                                                {configOptions.product.showTitle && <span className="sb-title">{selectedPreviewProduct?.title || 'Classic T-Shirt'}</span>}
                                                {configOptions.product.showPrice && <span className="sb-price">${selectedPreviewProduct?.variants?.edges?.[0]?.node?.price || '29.00'}</span>}
                                            </div>
                                        </div>

                                        <div className="sb-actions">
                                            {configOptions.controls.showVariantSelector && (
                                                <div className="sb-variant-select">
                                                    {selectedPreviewProduct?.variants?.edges?.[0]?.node?.title !== 'Default Title' 
                                                        ? selectedPreviewProduct?.variants?.edges?.[0]?.node?.title 
                                                        : 'One Size'}
                                                </div>
                                            )}
                                            {configOptions.controls.showQuantitySelector && (
                                                 <div style={{border:"1px solid rgba(255,255,255,0.3)", borderRadius: 4, padding: "6px 10px", fontSize: 13, opacity: 0.8}}>1</div>
                                            )}
                                            <button className="sb-atc-button">
                                                {configOptions.button.text}
                                            </button>
                                        </div>
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
                  <Text variant="bodySm" tone="subdued" as="span">Step {step} of 4</Text>
                  <Text variant="bodySm" tone="subdued" as="span">{Math.round(((step - 1) / 4) * 100)}% Complete</Text>
               </InlineStack>
               <ProgressBar progress={((step - 1) / 4) * 100} size="small" tone="primary" />
             </BlockStack>

             {step === 1 && renderStep1()}
             {step === 2 && renderStep2()}
             {step === 3 && renderStep3()}
             {step === 4 && renderStep4()}
          </BlockStack>
        </div>
      ) : (
        renderDashboard()
      )}
    </Page>
  );
}
