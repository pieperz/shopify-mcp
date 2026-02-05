#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { GraphQLClient } from "graphql-request";
import minimist from "minimist";
import { z } from "zod";

// Import existing tools
import { getCustomerOrders } from "./tools/getCustomerOrders.js";
import { getCustomers } from "./tools/getCustomers.js";
import { getOrderById } from "./tools/getOrderById.js";
import { getOrders } from "./tools/getOrders.js";
import { getProductById } from "./tools/getProductById.js";
import { getProducts } from "./tools/getProducts.js";
import { updateCustomer } from "./tools/updateCustomer.js";
import { updateOrder } from "./tools/updateOrder.js";
import { createProduct } from "./tools/createProduct.js";

// Import analytics tools (ShopifyQL)
import { runShopifyqlQuery } from "./tools/analytics/runShopifyqlQuery.js";
import { getSalesReport } from "./tools/analytics/getSalesReport.js";
import { getProductPerformance } from "./tools/analytics/getProductPerformance.js";
import { getCustomerAnalytics } from "./tools/analytics/getCustomerAnalytics.js";

// Import enhanced data access tools
import { getLocations } from "./tools/getLocations.js";
import { getInventoryLevels } from "./tools/getInventoryLevels.js";
import { getCollections } from "./tools/getCollections.js";
import { searchOrders } from "./tools/searchOrders.js";

// Parse command line arguments
const argv = minimist(process.argv.slice(2));

// Load environment variables from .env file (if it exists)
dotenv.config();

// Define environment variables - from command line or .env file
const SHOPIFY_ACCESS_TOKEN =
  argv.accessToken || process.env.SHOPIFY_ACCESS_TOKEN;
const MYSHOPIFY_DOMAIN = argv.domain || process.env.MYSHOPIFY_DOMAIN;

// Store in process.env for backwards compatibility
process.env.SHOPIFY_ACCESS_TOKEN = SHOPIFY_ACCESS_TOKEN;
process.env.MYSHOPIFY_DOMAIN = MYSHOPIFY_DOMAIN;

// Validate required environment variables
if (!SHOPIFY_ACCESS_TOKEN) {
  console.error("Error: SHOPIFY_ACCESS_TOKEN is required.");
  console.error("Please provide it via command line argument or .env file.");
  console.error("  Command line: --accessToken=your_token");
  process.exit(1);
}

if (!MYSHOPIFY_DOMAIN) {
  console.error("Error: MYSHOPIFY_DOMAIN is required.");
  console.error("Please provide it via command line argument or .env file.");
  console.error("  Command line: --domain=your-store.myshopify.com");
  process.exit(1);
}

// Create Shopify GraphQL client
const shopifyClient = new GraphQLClient(
  `https://${MYSHOPIFY_DOMAIN}/admin/api/2025-10/graphql.json`,
  {
    headers: {
      "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
      "Content-Type": "application/json"
    }
  }
);

// Initialize existing tools with shopifyClient
getProducts.initialize(shopifyClient);
getProductById.initialize(shopifyClient);
getCustomers.initialize(shopifyClient);
getOrders.initialize(shopifyClient);
getOrderById.initialize(shopifyClient);
updateOrder.initialize(shopifyClient);
getCustomerOrders.initialize(shopifyClient);
updateCustomer.initialize(shopifyClient);
createProduct.initialize(shopifyClient);

// Initialize analytics tools (ShopifyQL)
runShopifyqlQuery.initialize(shopifyClient);
getSalesReport.initialize(shopifyClient);
getProductPerformance.initialize(shopifyClient);
getCustomerAnalytics.initialize(shopifyClient);

// Initialize enhanced data access tools
getLocations.initialize(shopifyClient);
getInventoryLevels.initialize(shopifyClient);
getCollections.initialize(shopifyClient);
searchOrders.initialize(shopifyClient);

// Set up MCP server
const server = new McpServer({
  name: "shopify",
  version: "1.1.0",
  description:
    "MCP Server for Shopify API with ShopifyQL analytics, enabling deep interaction with store data through GraphQL API"
});

// Add tools individually, using their schemas directly
server.tool(
  "get-products",
  {
    searchTitle: z.string().optional(),
    limit: z.number().default(10)
  },
  async (args) => {
    const result = await getProducts.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-product-by-id",
  {
    productId: z.string().min(1)
  },
  async (args) => {
    const result = await getProductById.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-customers",
  {
    searchQuery: z.string().optional(),
    limit: z.number().default(10)
  },
  async (args) => {
    const result = await getCustomers.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-orders",
  {
    status: z.enum(["any", "open", "closed", "cancelled"]).default("any"),
    limit: z.number().default(10)
  },
  async (args) => {
    const result = await getOrders.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the getOrderById tool
server.tool(
  "get-order-by-id",
  {
    orderId: z.string().min(1)
  },
  async (args) => {
    const result = await getOrderById.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the updateOrder tool
server.tool(
  "update-order",
  {
    id: z.string().min(1),
    tags: z.array(z.string()).optional(),
    email: z.string().email().optional(),
    note: z.string().optional(),
    customAttributes: z
      .array(
        z.object({
          key: z.string(),
          value: z.string()
        })
      )
      .optional(),
    metafields: z
      .array(
        z.object({
          id: z.string().optional(),
          namespace: z.string().optional(),
          key: z.string().optional(),
          value: z.string(),
          type: z.string().optional()
        })
      )
      .optional(),
    shippingAddress: z
      .object({
        address1: z.string().optional(),
        address2: z.string().optional(),
        city: z.string().optional(),
        company: z.string().optional(),
        country: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        province: z.string().optional(),
        zip: z.string().optional()
      })
      .optional()
  },
  async (args) => {
    const result = await updateOrder.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the getCustomerOrders tool
server.tool(
  "get-customer-orders",
  {
    customerId: z
      .string()
      .regex(/^\d+$/, "Customer ID must be numeric")
      .describe("Shopify customer ID, numeric excluding gid prefix"),
    limit: z.number().default(10)
  },
  async (args) => {
    const result = await getCustomerOrders.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the updateCustomer tool
server.tool(
  "update-customer",
  {
    id: z
      .string()
      .regex(/^\d+$/, "Customer ID must be numeric")
      .describe("Shopify customer ID, numeric excluding gid prefix"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    tags: z.array(z.string()).optional(),
    note: z.string().optional(),
    taxExempt: z.boolean().optional(),
    metafields: z
      .array(
        z.object({
          id: z.string().optional(),
          namespace: z.string().optional(),
          key: z.string().optional(),
          value: z.string(),
          type: z.string().optional()
        })
      )
      .optional()
  },
  async (args) => {
    const result = await updateCustomer.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the createProduct tool
server.tool(
  "create-product",
  {
    title: z.string().min(1),
    descriptionHtml: z.string().optional(),
    vendor: z.string().optional(),
    productType: z.string().optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).default("DRAFT"),
  },
  async (args) => {
    const result = await createProduct.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// ==========================================
// ShopifyQL Analytics Tools
// ==========================================

// Run custom ShopifyQL query
server.tool(
  "run-shopifyql-query",
  {
    query: z
      .string()
      .min(1)
      .describe(
        "ShopifyQL query string. Must include FROM and SHOW clauses. Example: 'FROM sales SHOW total_sales GROUP BY day SINCE last_week'"
      )
  },
  async (args) => {
    const result = await runShopifyqlQuery.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Get sales report
server.tool(
  "get-sales-report",
  {
    period: z
      .enum([
        "today",
        "yesterday",
        "last_7_days",
        "last_30_days",
        "last_90_days",
        "last_month",
        "this_month",
        "this_year",
        "last_year"
      ])
      .default("last_30_days")
      .describe("Time period for the report"),
    groupBy: z
      .enum(["day", "week", "month", "product", "channel", "region"])
      .default("day")
      .describe("How to group the sales data"),
    metrics: z
      .array(
        z.enum([
          "total_sales",
          "net_sales",
          "orders",
          "average_order_value",
          "gross_profit",
          "units_sold",
          "returns",
          "discounts"
        ])
      )
      .default(["total_sales", "orders"])
      .describe("Metrics to include in the report"),
    limit: z
      .number()
      .min(1)
      .max(500)
      .default(100)
      .describe("Maximum number of rows to return")
  },
  async (args) => {
    const result = await getSalesReport.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Get product performance
server.tool(
  "get-product-performance",
  {
    period: z
      .enum([
        "last_7_days",
        "last_30_days",
        "last_90_days",
        "this_month",
        "last_month",
        "this_year"
      ])
      .default("last_30_days")
      .describe("Time period for analysis"),
    sortBy: z
      .enum(["total_sales", "orders", "units_sold"])
      .default("total_sales")
      .describe("Metric to sort results by"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .default(20)
      .describe("Number of products to return"),
    productType: z.string().optional().describe("Filter by product type")
  },
  async (args) => {
    const result = await getProductPerformance.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Get customer analytics
server.tool(
  "get-customer-analytics",
  {
    period: z
      .enum([
        "last_7_days",
        "last_30_days",
        "last_90_days",
        "this_month",
        "last_month",
        "this_year",
        "last_year"
      ])
      .default("last_30_days")
      .describe("Time period for analysis"),
    reportType: z
      .enum(["acquisition", "retention", "spending", "overview"])
      .default("overview")
      .describe("Type of customer analytics report"),
    groupBy: z
      .enum(["day", "week", "month"])
      .default("day")
      .describe("Time granularity for trending data")
  },
  async (args) => {
    const result = await getCustomerAnalytics.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// ==========================================
// Enhanced Data Access Tools
// ==========================================

// Get locations
server.tool(
  "get-locations",
  {
    limit: z
      .number()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of locations to return"),
    includeInactive: z
      .boolean()
      .default(false)
      .describe("Whether to include deactivated locations")
  },
  async (args) => {
    const result = await getLocations.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Get inventory levels
server.tool(
  "get-inventory-levels",
  {
    limit: z
      .number()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of inventory items to return"),
    sku: z.string().optional().describe("Filter by SKU (exact match)"),
    productId: z.string().optional().describe("Filter by product ID")
  },
  async (args) => {
    const result = await getInventoryLevels.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Get collections
server.tool(
  "get-collections",
  {
    limit: z
      .number()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of collections to return"),
    searchQuery: z.string().optional().describe("Search collections by title"),
    collectionType: z
      .enum(["smart", "manual", "all"])
      .default("all")
      .describe("Filter by collection type (smart = automated rules, manual = hand-picked)")
  },
  async (args) => {
    const result = await getCollections.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Search orders
server.tool(
  "search-orders",
  {
    query: z
      .string()
      .describe(
        "Search query using Shopify search syntax. Examples: 'financial_status:paid', 'fulfillment_status:unfulfilled', 'created_at:>2024-01-01', 'tag:vip'"
      ),
    limit: z
      .number()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of orders to return"),
    sortKey: z
      .enum([
        "CREATED_AT",
        "CUSTOMER_NAME",
        "FINANCIAL_STATUS",
        "FULFILLMENT_STATUS",
        "ORDER_NUMBER",
        "PROCESSED_AT",
        "TOTAL_PRICE",
        "UPDATED_AT"
      ])
      .default("CREATED_AT")
      .describe("Field to sort orders by"),
    reverse: z
      .boolean()
      .default(true)
      .describe("Reverse sort order (true = descending, most recent first)")
  },
  async (args) => {
    const result = await searchOrders.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Start the server
const transport = new StdioServerTransport();
server
  .connect(transport)
  .then(() => {})
  .catch((error: unknown) => {
    console.error("Failed to start Shopify MCP Server:", error);
  });
