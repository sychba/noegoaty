import { useState, useCallback } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  BlockStack,
  Text,
  ColorPicker,
  Box,
  InlineStack,
  Divider,
  Button,
  Badge,
  Icon,
  ContextualSaveBar,
  Frame,
  Popover,
  Bleed,
  RangeSlider
} from "@shopify/polaris";
import {
  MobileIcon,
  DesktopIcon,
  ViewIcon
} from "@shopify/polaris-icons";
import "../styles/customize.css"; 

// Config defaults
const DEFAULT_CONFIG = {
  enabled: true,
  settings: {
    position: "bottom",
    openTrigger: "standard",
    layout: "docked",
  },
  product: {
    showImage: true,
    showTitle: true,
    showPrice: true,
    showCompareAtPrice: true,
  },
  controls: {
    showVariantSelector: true,
    showQuantitySelector: true,
  },
  button: {
    text: "Add to cart",
    color: "#005bd3",
    textColor: "#ffffff",
  },
  announcement: {
    enabled: true,
    text: "Get it while it lasts 🔥",
    color: "#ff6d00",
    backgroundColor: "#ccfbf1",
  },
  display: {
    backgroundColor: "#202223",
    textColor: "#ffffff",
    glassy: false,
    rounded: "rounded",
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `query {
      shop {
        metafield(namespace: "stickyadd", key: "config") {
          value
        }
      }
    }`
  );
  const responseJson = await response.json();
  const storedConfig = responseJson.data?.shop?.metafield?.value
    ? JSON.parse(responseJson.data.shop.metafield.value)
    : null;

  return { 
    config: { 
      ...DEFAULT_CONFIG, 
      ...storedConfig,
      settings: { ...DEFAULT_CONFIG.settings, ...storedConfig?.settings },
      product: { ...DEFAULT_CONFIG.product, ...storedConfig?.product },
      controls: { ...DEFAULT_CONFIG.controls, ...storedConfig?.controls },
      button: { ...DEFAULT_CONFIG.button, ...storedConfig?.button },
      announcement: { ...DEFAULT_CONFIG.announcement, ...storedConfig?.announcement },
      display: { ...DEFAULT_CONFIG.display, ...storedConfig?.display },
    }
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const configJson = formData.get("config");
  if (!configJson) return { status: "error" };

  await admin.graphql(
    `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            namespace: "stickyadd",
            key: "config",
            type: "json",
            value: configJson.toString(),
            ownerId: (await admin.graphql(`query { shop { id } }`).then(r => r.json())).data.shop.id
          }
        ]
      }
    }
  );
  return { status: "success" };
};

export default function Customize() {
  const { config: initialConfig } = useLoaderData<typeof loader>();
  const [config, setConfig] = useState(() => ({
    ...DEFAULT_CONFIG,
    ...initialConfig,
    settings: { ...DEFAULT_CONFIG.settings, ...initialConfig?.settings },
    product: { ...DEFAULT_CONFIG.product, ...initialConfig?.product },
    controls: { ...DEFAULT_CONFIG.controls, ...initialConfig?.controls },
    button: { ...DEFAULT_CONFIG.button, ...initialConfig?.button },
    announcement: { ...DEFAULT_CONFIG.announcement, ...initialConfig?.announcement },
    display: { ...DEFAULT_CONFIG.display, ...initialConfig?.display },
  }));
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const submit = useSubmit();
  const nav = useNavigation();
  const isSaving = nav.state === "submitting";

  const updateConfig = useCallback((path: string, value: any) => {
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      const keys = path.split(".");
      let current = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
    setIsDirty(true);
  }, []);

  const handleSave = () => {
    submit({ config: JSON.stringify(config) }, { method: "post" });
    setIsDirty(false);
  };

  if (!config) return null;

  // HSB to HEX helper (simplified)
  const hsbToHex = (h: number, s: number, b: number) => {
    // Basic conversion logic or use a library. For now, we'll just handle the hex string directly in the state
    // and rely on the color picker's 'onChange' which usually provides hsb. 
    // However, Polaris ColorPicker works with HSB. We need to convert HEX <-> HSB.
    // To simplify for this demo, we will use a text input with color prefix for now, 
    // or assume we have a converter. 
    // **Better approach for "Shopify-like"**: Use the Text Field with a color prefix.
    return ""; 
  };

  // Improved Color Input using Polaris standards
  const ColorSetting = ({ label, path, value }: { label: string, path: string, value: string }) => {
    const [active, setActive] = useState(false);
    
    // Simple hex validation/fallback
    const safeValue = value || "#000000";

    return (
        <TextField
            label={label}
            value={safeValue}
            onChange={(val) => updateConfig(path, val)}
            autoComplete="off"
            prefix={
                <div
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        backgroundColor: safeValue,
                        border: "1px solid #dcdcdc"
                    }}
                />
            }
        />
    );
  };

  return (
    <Frame>
      <Page 
        fullWidth 
        title="Customize" 
        backAction={{content: 'Home', url: '/app'}}
        primaryAction={{
            content: 'Save',
            loading: isSaving,
            disabled: !isDirty,
            onAction: handleSave,
        }}
        secondaryActions={[
             {
                content: viewMode === 'desktop' ? 'Switch to Mobile' : 'Switch to Desktop',
                icon: viewMode === 'desktop' ? MobileIcon : DesktopIcon,
                onAction: () => setViewMode(prev => prev === 'desktop' ? 'mobile' : 'desktop')
             }
        ]}
      >
        {isDirty && (
            <ContextualSaveBar
                message="Unsaved changes"
                saveAction={{
                    onAction: handleSave,
                    loading: isSaving,
                    disabled: false,
                }}
                discardAction={{
                    onAction: () => {
                        setConfig(initialConfig);
                        setIsDirty(false);
                    },
                }}
            />
        )}

        <Layout>
          {/* SETTINGS COLUMN (Left) */}
          <Layout.Section variant="oneThird">
             <BlockStack gap="500">
                {/* 1. STATUS */}
                <Card>
                    <BlockStack gap="400">
                        <Text variant="headingSm" as="h2">App Status</Text>
                        <InlineStack align="space-between" blockAlign="center">
                            <Text as="p">Enable Sticky Bar</Text>
                            <Checkbox
                                label="Enable"
                                labelHidden
                                checked={config.enabled}
                                onChange={(val) => updateConfig("enabled", val)}
                            />
                        </InlineStack>
                        <Text variant="bodySm" tone="subdued" as="p">
                            {config.enabled ? "The sticky bar is visible on your store." : "The sticky bar is currently hidden."}
                        </Text>
                    </BlockStack>
                </Card>

                {/* 2. LAYOUT & BEHAVIOR */}
                <Layout.AnnotatedSection
                    title="Layout & Behavior"
                    description="Control where and how the sticky bar appears."
                >
                    <Card>
                        <BlockStack gap="400">
                             <Select
                                label="Position"
                                options={[
                                    {label: 'Bottom of screen', value: 'bottom'},
                                    {label: 'Top of screen', value: 'top'},
                                ]}
                                value={config.settings.position}
                                onChange={(val) => updateConfig("settings.position", val)}
                            />
                            <Select
                                label="Design Style"
                                options={[
                                    {label: 'Full Width (Docked)', value: 'docked'},
                                    {label: 'Floating Card', value: 'floating'},
                                ]}
                                value={config.settings.layout}
                                onChange={(val) => updateConfig("settings.layout", val)}
                            />
                             <Select
                                label="Show Trigger"
                                helpText="When should the bar appear?"
                                options={[
                                    {label: 'Immediately', value: 'early'},
                                    {label: 'After scrolling past Add to Cart', value: 'standard'},
                                    {label: 'Near bottom of page', value: 'late'},
                                ]}
                                value={config.settings.openTrigger}
                                onChange={(val) => updateConfig("settings.openTrigger", val)}
                            />
                        </BlockStack>
                    </Card>
                </Layout.AnnotatedSection>

                {/* 3. CONTENT */}
                <Layout.AnnotatedSection
                    title="Content"
                    description="Choose what information to display."
                >
                    <Card>
                        <BlockStack gap="400">
                             <Checkbox
                                label="Show Product Image"
                                checked={config.product.showImage}
                                onChange={(val) => updateConfig("product.showImage", val)}
                            />
                            <Checkbox
                                label="Show Product Title"
                                checked={config.product.showTitle}
                                onChange={(val) => updateConfig("product.showTitle", val)}
                            />
                            <Checkbox
                                label="Show Price"
                                checked={config.product.showPrice}
                                onChange={(val) => updateConfig("product.showPrice", val)}
                            />
                            <Divider />
                             <Checkbox
                                label="Variant Selector"
                                helpText="Allow customers to change variants directly in the bar"
                                checked={config.controls.showVariantSelector}
                                onChange={(val) => updateConfig("controls.showVariantSelector", val)}
                            />
                            <Checkbox
                                label="Quantity Selector"
                                checked={config.controls.showQuantitySelector}
                                onChange={(val) => updateConfig("controls.showQuantitySelector", val)}
                            />
                        </BlockStack>
                    </Card>
                </Layout.AnnotatedSection>

                {/* 4. DESIGN */}
                <Layout.AnnotatedSection
                    title="Design"
                    description="Match your brand colors and style."
                >
                    <Card>
                        <BlockStack gap="400">
                             <TextField
                                label="Button Label"
                                value={config.button.text}
                                onChange={(val) => updateConfig("button.text", val)}
                                autoComplete="off"
                            />
                            <ColorSetting 
                                label="Button Background" 
                                path="button.color" 
                                value={config.button.color} 
                            />
                            <ColorSetting 
                                label="Button Text" 
                                path="button.textColor" 
                                value={config.button.textColor} 
                            />
                            <Divider />
                             <ColorSetting 
                                label="Bar Background" 
                                path="display.backgroundColor" 
                                value={config.display.backgroundColor} 
                            />
                            <ColorSetting 
                                label="Bar Text" 
                                path="display.textColor" 
                                value={config.display.textColor} 
                            />
                            <Select
                                label="Corner Radius"
                                options={[
                                    {label: 'Square', value: 'none'},
                                    {label: 'Rounded (8px)', value: 'rounded'},
                                    {label: 'Pill (Full)', value: 'pill'},
                                ]}
                                value={config.display.rounded}
                                onChange={(val) => updateConfig("display.rounded", val)}
                            />
                             <Checkbox
                                label="Enable Glassmorphism (Blur)"
                                checked={config.display.glassy}
                                onChange={(val) => updateConfig("display.glassy", val)}
                            />
                        </BlockStack>
                    </Card>
                </Layout.AnnotatedSection>

                 {/* 5. ANNOUNCEMENT */}
                 <Layout.AnnotatedSection
                    title="Announcement"
                    description="Add a promotional message above the bar."
                >
                     <Card>
                        <BlockStack gap="400">
                             <InlineStack align="space-between">
                                <Text as="p">Show Announcement</Text>
                                <Checkbox
                                    label="Enable"
                                    labelHidden
                                    checked={config.announcement.enabled}
                                    onChange={(val) => updateConfig("announcement.enabled", val)}
                                />
                             </InlineStack>
                             
                             {config.announcement.enabled && (
                                <>
                                    <TextField
                                        label="Message"
                                        value={config.announcement.text}
                                        onChange={(val) => updateConfig("announcement.text", val)}
                                        autoComplete="off"
                                    />
                                    <ColorSetting 
                                        label="Background Color" 
                                        path="announcement.backgroundColor" 
                                        value={config.announcement.backgroundColor} 
                                    />
                                     <ColorSetting 
                                        label="Text Color" 
                                        path="announcement.color" 
                                        value={config.announcement.color} 
                                    />
                                </>
                             )}
                        </BlockStack>
                     </Card>
                 </Layout.AnnotatedSection>

             </BlockStack>
          </Layout.Section>

          {/* PREVIEW COLUMN (Right) */}
          <Layout.Section>
            <div style={{position: 'sticky', top: '20px'}}>
                <Card>
                    <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                            <Text variant="headingSm" as="h2">Live Preview</Text>
                            <Badge tone="info">{viewMode === 'mobile' ? 'Mobile' : 'Desktop'}</Badge>
                        </InlineStack>
                        
                        <Box 
                            background="bg-surface-secondary" 
                            padding="400" 
                            borderRadius="300"
                            minHeight="600px"
                        >
                            <div className={`preview-container ${viewMode}`}>
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
                                        <div className="mock-section"></div>
                                    </div>

                                    {/* ACTUAL STICKY BAR RENDER */}
                                    <div 
                                        className={`sticky-bar-preview ${config.settings.position}`}
                                        style={{
                                            '--sb-bg': config.display.backgroundColor,
                                            '--sb-text': config.display.textColor,
                                            '--sb-btn-bg': config.button.color,
                                            '--sb-btn-text': config.button.textColor,
                                            '--sb-radius': config.display.rounded === 'pill' ? '999px' : (config.display.rounded === 'rounded' ? '12px' : '0px'),
                                            '--sb-blur': config.display.glassy ? '10px' : '0px',
                                            '--sb-layout-margin': config.settings.layout === 'floating' ? '20px' : '0px',
                                            '--sb-layout-width': config.settings.layout === 'floating' ? 'calc(100% - 40px)' : '100%',
                                            '--sb-layout-radius': config.settings.layout === 'floating' ? '16px' : '0px',
                                        } as any}
                                    >
                                        {config.announcement.enabled && (
                                            <div className="sb-announcement" style={{
                                                backgroundColor: config.announcement.backgroundColor,
                                                color: config.announcement.color
                                            }}>
                                                {config.announcement.text}
                                            </div>
                                        )}
                                        
                                        <div className="sb-main">
                                            <div className="sb-product">
                                                {config.product.showImage && <div className="sb-thumb"></div>}
                                                <div className="sb-info">
                                                    {config.product.showTitle && <span className="sb-title">Classic T-Shirt</span>}
                                                    {config.product.showPrice && <span className="sb-price">$29.00</span>}
                                                </div>
                                            </div>

                                            <div className="sb-actions">
                                                {config.controls.showVariantSelector && (
                                                    <div className="sb-variant-select">Medium / Black</div>
                                                )}
                                                <button className="sb-atc-button">
                                                    {config.button.text}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </Box>
                    </BlockStack>
                </Card>
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
