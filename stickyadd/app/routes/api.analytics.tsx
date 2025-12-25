import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ message: "Method not allowed" }, { status: 405 });
  }

  // Handle preflight requests if needed (though usually handled by OPTIONS)
  // But here we are just doing POST.

  try {
    const data = await request.json();
    const { shop, type } = data;

    if (!shop || !type) {
      return Response.json({ message: "Missing required fields" }, { 
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updateData: any = {};
    if (type === "impression") {
      updateData.impressions = { increment: 1 };
    } else if (type === "click") {
      updateData.clicks = { increment: 1 };
    } else {
      return Response.json({ message: "Invalid type" }, { 
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    await db.dailyStat.upsert({
      where: {
        shop_date: {
          shop,
          date: today,
        },
      },
      update: updateData,
      create: {
        shop,
        date: today,
        impressions: type === "impression" ? 1 : 0,
        clicks: type === "click" ? 1 : 0,
        revenue: 0,
        orders: 0,
      },
    });

    return Response.json({ status: "success" }, { 
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });

  } catch (error) {
    console.error("Analytics Error:", error);
    return Response.json({ message: "Internal server error" }, { 
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};

export const loader = async ({ request }: ActionFunctionArgs) => {
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            }
        });
    }
    return Response.json({ message: "Analytics API" });
};
