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
  Frame,
  Popover,
  Bleed,
  Collapsible,
  RangeSlider
} from "@shopify/polaris";
import {
  MobileIcon,
  DesktopIcon,
  ViewIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from "@shopify/polaris-icons";
import "../styles/customize.css"; 

// Config defaults
const DEFAULT_CONFIG = {
  enabled: true,
  settings: {
    position: "bottom",
    openTrigger: "standard",
    layout: "floating",
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
    color: "#2563eb",
    textColor: "#ffffff",
  },
  announcement: {
    enabled: false,
    text: "Get it while it lasts 🔥",
    color: "#ff6d00",
    backgroundColor: "#ccfbf1",
  },
  display: {
    backgroundColor: "#000000",
    textColor: "#ffffff",
    glassy: true,
    rounded: "pill",
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

// --- Color Helpers ---
function hexToHsb(hex: string) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
    return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { hue: 0, saturation: 0, brightness: 0 };

  var r = parseInt(result[1], 16);
  var g = parseInt(result[2], 16);
  var b = parseInt(result[3], 16);

  r /= 255;
  g /= 255;
  b /= 255;

  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h = 0, s, v = max;

  var d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0; // achromatic
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    hue: h * 360,
    saturation: s,
    brightness: v
  };
}

function hsbToHex(hsb: {hue: number, saturation: number, brightness: number}) {
  var h = hsb.hue;
  var s = hsb.saturation;
  var b = hsb.brightness;
  
  var c = b * s;
  var x = c * (1 - Math.abs((h / 60) % 2 - 1));
  var m = b - c;
  var r = 0, g = 0, bl = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; bl = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; bl = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; bl = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; bl = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; bl = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; bl = x;
  }

  var rHex = Math.round((r + m) * 255).toString(16);
  var gHex = Math.round((g + m) * 255).toString(16);
  var bHex = Math.round((bl + m) * 255).toString(16);

  if (rHex.length === 1) rHex = "0" + rHex;
  if (gHex.length === 1) gHex = "0" + gHex;
  if (bHex.length === 1) bHex = "0" + bHex;

  return "#" + rHex + gHex + bHex;
}

const AccordionSection = ({ 
  title, 
  description, 
  id, 
  activeSection, 
  setActiveSection, 
  children 
}: { 
  title: string, 
  description: string, 
  id: string, 
  activeSection: string | null, 
  setActiveSection: (id: string | null) => void, 
  children: React.ReactNode 
}) => {
  const isOpen = activeSection === id;
  return (
    <Card>
      <div 
        onClick={() => setActiveSection(isOpen ? null : id)} 
        className="accordion-header"
      >
        <InlineStack align="space-between" blockAlign="center">
           <BlockStack gap="050">
              <Text variant="headingSm" as="h3">{title}</Text>
              <Text variant="bodySm" tone="subdued" as="p">{description}</Text>
           </BlockStack>
           <div className={`accordion-icon ${isOpen ? 'open' : ''}`}>
              <Icon source={ChevronDownIcon} />
           </div>
        </InlineStack>
      </div>
      <Collapsible
        open={isOpen}
        id={id}
        transition={{duration: '300ms', timingFunction: 'ease-in-out'}}
        expandOnPrint
      >
        <div style={{ paddingTop: '16px' }}>
             {children}
        </div>
      </Collapsible>
    </Card>
  );
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
  const [activeSection, setActiveSection] = useState<string | null>(null);
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

  // Improved Color Input using Polaris standards
  const ColorSetting = ({ label, path, value }: { label: string, path: string, value: string }) => {
    const [popoverActive, setPopoverActive] = useState(false);
    
    // Simple hex validation/fallback
    const safeValue = value || "#000000";

    const togglePopover = useCallback(
        () => setPopoverActive((active) => !active),
        [],
    );

    const handleColorChange = (newHsb: {hue: number, saturation: number, brightness: number}) => {
        const newHex = hsbToHex(newHsb);
        updateConfig(path, newHex);
    };

    return (
        <Popover
            active={popoverActive}
            activator={
                <TextField
                    label={label}
                    value={safeValue}
                    onChange={(val) => updateConfig(path, val)}
                    autoComplete="off"
                    prefix={
                        <div
                            onClick={togglePopover}
                            style={{
                                width: 24,
                                height: 24,
                                borderRadius: 4,
                                backgroundColor: safeValue,
                                border: "1px solid #dcdcdc",
                                cursor: "pointer"
                            }}
                        />
                    }
                />
            }
            onClose={togglePopover}
        >
            <div style={{ padding: '16px' }}>
                <ColorPicker onChange={handleColorChange} color={hexToHsb(safeValue)} />
            </div>
        </Popover>
    );
  };

  return (
    <Frame>
      <Page 
        fullWidth 
        title="Customize" 
        backAction={{content: 'Home', onAction: () => navigate("/app")}}
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
            <div className="custom-save-bar">
                <div className="csb-message">
                   <span>Unsaved changes</span>
                </div>
                <div className="csb-actions">
                    <button className="csb-btn" onClick={() => {
                        setConfig(initialConfig);
                        setIsDirty(false);
                    }}>
                        Discard
                    </button>
                    <button 
                        className="csb-btn primary" 
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        )}

        <Layout>
          {/* SETTINGS COLUMN (Left) */}
          <Layout.Section variant="oneThird">
             <BlockStack gap="500">
                {/* 2. LAYOUT & BEHAVIOR */}
                <AccordionSection
                    id="layout"
                    title="Layout & Behavior"
                    description="Control where and how the sticky bar appears."
                    activeSection={activeSection}
                    setActiveSection={setActiveSection}
                >
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
                </AccordionSection>

                {/* 3. CONTENT */}
                <AccordionSection
                    id="content"
                    title="Content"
                    description="Choose what information to display."
                    activeSection={activeSection}
                    setActiveSection={setActiveSection}
                >
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
                </AccordionSection>

                {/* 4. DESIGN */}
                <AccordionSection
                    id="design"
                    title="Design"
                    description="Match your brand colors and style."
                    activeSection={activeSection}
                    setActiveSection={setActiveSection}
                >
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

                    </BlockStack>
                </AccordionSection>
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
                                            '--sb-radius': config.settings.layout === 'docked' ? '0px' : (config.display.rounded === 'pill' ? '999px' : (config.display.rounded === 'rounded' ? '12px' : '0px')),
                                            '--sb-blur': config.display.glassy ? '12px' : '0px',
                                            '--sb-layout-margin': config.settings.layout === 'floating' ? '20px' : '0px',
                                            '--sb-layout-width': config.settings.layout === 'floating' ? 'fit-content' : '100%',
                                        } as any}
                                    >

                                        
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
