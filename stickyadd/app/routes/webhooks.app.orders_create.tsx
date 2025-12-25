import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  if (topic === "ORDERS_CREATE") {
    console.log(`Received ${topic} webhook for ${shop}`);
    
    // Check for attribution
    // Payload is the order object
    const order = payload as any;
    
    // Check line items for property _attribution: 'stickyadd'
    let attributedRevenue = 0;
    let hasAttribution = false;

    if (order.line_items && Array.isArray(order.line_items)) {
        for (const item of order.line_items) {
            if (item.properties && Array.isArray(item.properties)) {
                const attr = item.properties.find((p: any) => p.name === "_attribution" && p.value === "stickyadd");
                if (attr) {
                    hasAttribution = true;
                    // Revenue from this item: price * quantity
                    // Note: price is string in Shopify API usually
                    attributedRevenue += parseFloat(item.price) * item.quantity;
                }
            }
        }
    }

    if (hasAttribution) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await db.dailyStat.upsert({
            where: {
                shop_date: {
                    shop,
                    date: today,
                },
            },
            update: {
                revenue: { increment: attributedRevenue },
                orders: { increment: 1 },
            },
            create: {
                shop,
                date: today,
                revenue: attributedRevenue,
                orders: 1,
                impressions: 0,
                clicks: 0,
            },
        });
        console.log(`Attributed order ${order.id} to stickyadd: $${attributedRevenue}`);
    }
  }

  return new Response();
};
