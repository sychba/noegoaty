# Add Analytics Dashboard & Tracking

## 1. Backend: Database Schema
- **File**: `prisma/schema.prisma`
- **Action**: Add `DailyStat` model to track `impressions`, `clicks`, `revenue`, and `orders` per shop and date.
- **Migration**: Run `npx prisma migrate dev` to update the database.

## 2. Backend: Analytics API & Webhooks
- **Analytics Endpoint**: Create `app/routes/api.analytics.tsx` to handle `POST` requests for 'impression' and 'click' events.
- **Order Webhook**: Create `app/routes/webhooks.app.orders_create.tsx` to listen for new orders.
  - Logic: Check order line items for `_attribution: 'stickyadd'` property.
  - Update `DailyStat` revenue if attribution is found.
- **Configuration**: Update `shopify.app.toml` to include `read_orders` scope and the `orders/create` webhook subscription.

## 3. Frontend: Theme Extension Tracking
- **File**: `extensions/theme-extension/blocks/sticky_bar.liquid`
- **Action**:
  - Add hidden input `properties[_attribution]` to the Add to Cart form.
  - Inject a script to `fetch` the analytics endpoint on page load (impression) and button click.
  - Use `shop.metafields.stickyadd.app_url` to dynamically get the API endpoint.

## 4. Frontend: Dashboard UI
- **File**: `app/routes/app._index.tsx`
- **Action**:
  - Update `loader` to:
    - Ensure `stickyadd.app_url` metafield is up-to-date with the current app URL.
    - Fetch aggregated stats from `DailyStat`.
  - Update `Index` component to display a 3-column grid (Revenue, Clicks, Impressions) at the top of the page.
