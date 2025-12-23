import { useState, useEffect } from "react";
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
  Collapsible,
  Divider,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  MenuHorizontalIcon,
  ChevronUpIcon,
  CircleUpIcon
} from "@shopify/polaris-icons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // 1. Fetch Metafields for Config and Onboarding
  // We separate this from the themes query to prevent the whole page from crashing
  // if the user hasn't granted read_themes scope yet.
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

  // 2. Try to fetch Theme Settings (requires read_themes scope)
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
    console.warn("Could not fetch theme settings. Ensure 'read_themes' scope is granted.", error);
    // Continue without theme data
  }

  // Parse Config
  const storedConfig = shopData.config?.value ? JSON.parse(shopData.config.value) : null;
  const isAppEnabled = storedConfig?.enabled ?? false;

  // Parse Onboarding
  const storedOnboarding = shopData.onboarding?.value ? JSON.parse(shopData.onboarding.value) : null;
  let completedSteps = storedOnboarding?.completedSteps ?? [];

  // 3. Check App Embed Status in Theme
  let isEmbedActive = false;
  if (themeData) {
    const settingsFile = themeData.files?.edges?.[0]?.node?.body?.content;
    if (settingsFile) {
      try {
        const settings = JSON.parse(settingsFile);
        const blocks = settings.current?.blocks || {};
        // Look for any block that is our sticky_bar and is NOT disabled
        // The type format is: shopify://apps/{app_handle}/blocks/{extension_handle}/{uuid}
        isEmbedActive = Object.values(blocks).some((block: any) => 
          block.type.includes("/blocks/sticky_bar/") && block.disabled !== true
        );
      } catch (e) {
        console.error("Error parsing settings_data.json", e);
      }
    }
  }

  // Auto-complete step 1 if embed is active
  if (isEmbedActive && !completedSteps.includes(1)) {
    completedSteps = [...completedSteps, 1];
  }

  return { 
    shop: session.shop,
    initialCompletedSteps: completedSteps,
    initialAppEnabled: isAppEnabled,
    isEmbedActive,
    shopId: shopData.id
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const shopId = formData.get("shopId");

  if (actionType === "updateSteps") {
    const steps = formData.get("completedSteps");
    if (steps) {
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
                key: "onboarding",
                type: "json",
                value: JSON.stringify({ completedSteps: JSON.parse(steps.toString()) }),
                ownerId: shopId
              }
            ]
          }
        }
      );
    }
  } else if (actionType === "toggleApp") {
    const enabled = formData.get("enabled") === "true";
    
    const queryResponse = await admin.graphql(
      `query {
        shop {
          metafield(namespace: "stickyadd", key: "config") {
            value
          }
        }
      }`
    );
    const queryJson = await queryResponse.json();
    const existingConfig = queryJson.data.shop.metafield?.value 
      ? JSON.parse(queryJson.data.shop.metafield.value) 
      : {};
    
    const newConfig = { ...existingConfig, enabled };

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
              value: JSON.stringify(newConfig),
              ownerId: shopId
            }
          ]
        }
      }
    );
  }

  return { status: "success" };
};

export default function Index() {
  const { shop, initialCompletedSteps, initialAppEnabled, isEmbedActive, shopId } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  // State for checklist progress
  const [completedSteps, setCompletedSteps] = useState<number[]>(initialCompletedSteps);
  const [expandedStep, setExpandedStep] = useState<number | null>(
    initialCompletedSteps.includes(1) ? (initialCompletedSteps.includes(2) ? (initialCompletedSteps.includes(3) ? null : 3) : 2) : 1
  ); 
  const [isAppEnabled, setIsAppEnabled] = useState(initialAppEnabled);

  // Sync state if loader data changes (e.g. revalidation)
  useEffect(() => {
    setCompletedSteps(initialCompletedSteps);
  }, [initialCompletedSteps]);

  useEffect(() => {
    setIsAppEnabled(initialAppEnabled);
  }, [initialAppEnabled]);

  const toggleStepCompletion = (stepIndex: number) => {
    setCompletedSteps((prev) => {
      const isCompleted = prev.includes(stepIndex);
      const newSteps = isCompleted
        ? prev.filter((i) => i !== stepIndex)
        : [...prev, stepIndex];
      
      // Auto-expand next step if completing current one
      if (!isCompleted && stepIndex < 3) {
        setExpandedStep(stepIndex + 1);
      }
      
      // Submit to backend
      const formData = new FormData();
      formData.append("actionType", "updateSteps");
      formData.append("completedSteps", JSON.stringify(newSteps));
      formData.append("shopId", shopId);
      submit(formData, { method: "post" });

      return newSteps;
    });
  };

  const handleToggleApp = () => {
    const newState = !isAppEnabled;
    setIsAppEnabled(newState);
    
    const formData = new FormData();
    formData.append("actionType", "toggleApp");
    formData.append("enabled", String(newState));
    formData.append("shopId", shopId);
    submit(formData, { method: "post" });
  };

  const handleStepClick = (stepIndex: number) => {
    setExpandedStep(expandedStep === stepIndex ? null : stepIndex);
  };

  const openThemeEditor = () => {
    window.open(`https://${shop}/admin/themes/current/editor?context=apps`, '_blank');
  };

  const progress = (completedSteps.length / 3) * 100;

  return (
    <Page title="Unfair Cart Pop Up">
      <BlockStack gap="500">
        
        {/* Setup Guide Card */}
        <Card>
          <BlockStack gap="400">
            {/* Header */}
            <InlineStack align="space-between" blockAlign="start">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">Setup Guide</Text>
                <Text tone="subdued" as="p">Follow these steps to start using Unfair Cart Pop Up</Text>
              </BlockStack>
              <InlineStack gap="200">
                <Button icon={MenuHorizontalIcon} variant="plain" accessibilityLabel="Options" />
                <Button icon={ChevronUpIcon} variant="plain" accessibilityLabel="Collapse" />
              </InlineStack>
            </InlineStack>

            {/* Progress Bar */}
            <BlockStack gap="200">
              <Text variant="bodySm" tone="subdued" as="span">{completedSteps.length} / 3 completed</Text>
              <ProgressBar progress={progress} size="small" tone="primary" />
            </BlockStack>

            <Divider />

            {/* Steps */}
            <BlockStack gap="300">
              {/* Step 1 */}
              <div 
                style={{ 
                  border: '1px solid #E1E3E5', 
                  borderRadius: '8px', 
                  overflow: 'hidden'
                }}
              >
                <div 
                  onClick={() => handleStepClick(1)} 
                  style={{ 
                    cursor: 'pointer',
                    padding: '16px',
                    backgroundColor: expandedStep === 1 ? '#F7F7F8' : 'white',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      <div onClick={(e) => { e.stopPropagation(); toggleStepCompletion(1); }}>
                        <Icon 
                          source={completedSteps.includes(1) ? CheckCircleIcon : CircleUpIcon}
                          tone={completedSteps.includes(1) ? "success" : "subdued"} 
                        />
                      </div>
                      <BlockStack gap="0">
                        <Text variant="bodyMd" fontWeight="bold" as="span">Activate app embed in Shopify</Text>
                        {isEmbedActive && (
                          <Text variant="bodySm" tone="success" as="span">Detected as active</Text>
                        )}
                      </BlockStack>
                    </InlineStack>
                  </InlineStack>
                </div>
                
                <Collapsible
                  open={expandedStep === 1}
                  id="step-1-collapsible"
                  transition={{duration: '300ms', timingFunction: 'ease-in-out'}}
                  expandOnPrint
                >
                  <div style={{ padding: '0 16px 16px 16px', backgroundColor: '#F7F7F8' }}>
                    <BlockStack gap="400">
                      <Text tone="subdued" as="p">
                        Activate and save the app embed in your theme settings to make your Sticky Add to Cart Bar live.
                      </Text>
                      <InlineStack gap="300">
                        <Button variant="primary" onClick={openThemeEditor}>Activate</Button>
                        <Button variant="plain" onClick={() => toggleStepCompletion(1)}>I've done it</Button>
                      </InlineStack>
                    </BlockStack>
                  </div>
                </Collapsible>
              </div>

              {/* Step 2 */}
              <div 
                style={{ 
                  border: '1px solid #E1E3E5', 
                  borderRadius: '8px', 
                  overflow: 'hidden'
                }}
              >
                 <div 
                  onClick={() => handleStepClick(2)} 
                  style={{ 
                    cursor: 'pointer',
                    padding: '16px',
                    backgroundColor: expandedStep === 2 ? '#F7F7F8' : 'white',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                       <div onClick={(e) => { e.stopPropagation(); toggleStepCompletion(2); }}>
                        <Icon 
                          source={completedSteps.includes(2) ? CheckCircleIcon : CircleUpIcon}
                          tone={completedSteps.includes(2) ? "success" : "subdued"} 
                        />
                      </div>
                      <Text variant="bodyMd" fontWeight={expandedStep === 2 ? "bold" : "regular"} as="span">
                        Enable & Customise Sticky Add to Cart
                      </Text>
                    </InlineStack>
                  </InlineStack>
                </div>

                <Collapsible
                  open={expandedStep === 2}
                  id="step-2-collapsible"
                  transition={{duration: '300ms', timingFunction: 'ease-in-out'}}
                  expandOnPrint
                >
                  <div style={{ padding: '0 16px 16px 16px', backgroundColor: '#F7F7F8' }}>
                    <BlockStack gap="400">
                      <Text tone="subdued" as="p">
                        Customize the look and feel of your sticky add to cart bar to match your brand.
                      </Text>
                      <InlineStack gap="300">
                        <Button variant="primary" onClick={() => navigate("/app/customize")}>Customize</Button>
                        <Button variant="plain" onClick={() => toggleStepCompletion(2)}>I've done it</Button>
                      </InlineStack>
                    </BlockStack>
                  </div>
                </Collapsible>
              </div>

              {/* Step 3 */}
               <div 
                style={{ 
                  border: '1px solid #E1E3E5', 
                  borderRadius: '8px', 
                  overflow: 'hidden'
                }}
              >
                 <div 
                  onClick={() => handleStepClick(3)} 
                  style={{ 
                    cursor: 'pointer',
                    padding: '16px',
                    backgroundColor: expandedStep === 3 ? '#F7F7F8' : 'white',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                       <div onClick={(e) => { e.stopPropagation(); toggleStepCompletion(3); }}>
                        <Icon 
                          source={completedSteps.includes(3) ? CheckCircleIcon : CircleUpIcon}
                          tone={completedSteps.includes(3) ? "success" : "subdued"} 
                        />
                      </div>
                      <Text variant="bodyMd" fontWeight={expandedStep === 3 ? "bold" : "regular"} as="span">
                        Confirm Sticky Add to Cart is working properly
                      </Text>
                    </InlineStack>
                  </InlineStack>
                </div>

                <Collapsible
                  open={expandedStep === 3}
                  id="step-3-collapsible"
                  transition={{duration: '300ms', timingFunction: 'ease-in-out'}}
                  expandOnPrint
                >
                  <div style={{ padding: '0 16px 16px 16px', backgroundColor: '#F7F7F8' }}>
                    <BlockStack gap="400">
                       <Text tone="subdued" as="p">
                        Check your storefront to ensure the sticky bar appears on product pages as expected.
                      </Text>
                      <InlineStack gap="300">
                        <Button onClick={() => window.open(`https://${shop}`, '_blank')}>View Store</Button>
                         <Button variant="plain" onClick={() => toggleStepCompletion(3)}>It works</Button>
                      </InlineStack>
                    </BlockStack>
                  </div>
                </Collapsible>
              </div>
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Illustration Module */}
        <Card padding="0">
          <BlockStack gap="0">
            {/* Image Placeholder Area */}
            <div style={{
              backgroundColor: '#4a4a4a', 
              height: '240px', 
              width: '100%',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderTopLeftRadius: 'var(--p-border-radius-200)',
              borderTopRightRadius: 'var(--p-border-radius-200)',
              overflow: 'hidden'
            }}>
              {/* You can replace this with an actual image if you have one. 
                  For now, creating a mockup look with CSS/Polaris is complex inside the rect, 
                  so a solid color placeholder with maybe a text or icon is safest.
              */}
               <div style={{
                  width: '80%',
                  height: '80%',
                  backgroundColor: '#f1f2f4',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '20px'
               }}>
                  {/* Mockup Screen Content */}
                  <div style={{width: '40%', height: '20px', backgroundColor: '#d9d9d9', borderRadius: '4px', marginBottom: '10px'}}></div>
                  <div style={{width: '100%', height: '10px', backgroundColor: '#e8e8e8', borderRadius: '4px', marginBottom: '8px'}}></div>
                  <div style={{width: '90%', height: '10px', backgroundColor: '#e8e8e8', borderRadius: '4px', marginBottom: '8px'}}></div>
                  <div style={{marginTop: 'auto', display: 'flex', justifyContent: 'flex-end'}}>
                     <div style={{width: '80px', height: '30px', backgroundColor: '#005bd3', borderRadius: '4px'}}></div>
                  </div>
               </div>
            </div>

            {/* Footer Content */}
            <Box padding="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingSm" as="h3">Unfair Cart Pop Up</Text>
                    <Badge tone={isAppEnabled ? "success" : "attention"}>
                      {isAppEnabled ? "On" : "Off"}
                    </Badge>
                  </InlineStack>
                  <Text tone="subdued" as="p">
                    Enable Unfair Cart Pop Up to increase conversions and customise to fit your store style.
                  </Text>
                </BlockStack>
                <InlineStack gap="200">
                  <Button onClick={handleToggleApp}>
                    {isAppEnabled ? "Disable" : "Enable"}
                  </Button>
                  <Button variant="primary" onClick={() => navigate("/app/customize")}>Customize</Button>
                </InlineStack>
              </InlineStack>
            </Box>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}
