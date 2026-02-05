import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import { periodToShopifyQL } from "../../utils/shopifyqlHelpers.js";

// Input schema for getProductPerformance
const GetProductPerformanceInputSchema = z.object({
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
});

type GetProductPerformanceInput = z.infer<
  typeof GetProductPerformanceInputSchema
>;

// Will be initialized in index.ts
let shopifyClient: GraphQLClient;

const getProductPerformance = {
  name: "get-product-performance",
  description:
    "Get product performance analytics. Returns top products ranked by sales, orders, or units sold. Requires read_reports scope.",
  schema: GetProductPerformanceInputSchema,

  initialize(client: GraphQLClient) {
    shopifyClient = client;
  },

  execute: async (input: GetProductPerformanceInput) => {
    try {
      const { period, sortBy, limit, productType } = input;

      // Build the ShopifyQL query
      const metrics = ["product_title", "total_sales", "orders", "units_sold"];
      const periodClause = periodToShopifyQL(period);
      const whereClause = productType
        ? `WHERE product_type = '${productType}'`
        : "";

      const shopifyqlQuery = `FROM sales SHOW ${metrics.join(", ")} ${whereClause} ${periodClause} GROUP BY product_title ORDER BY ${sortBy} DESC LIMIT ${limit}`;

      const graphqlQuery = gql`
        query GetProductPerformance($query: String!) {
          shopifyqlQuery(query: $query) {
            tableData {
              columns {
                name
                dataType
                displayName
              }
              rows
            }
            parseErrors
          }
        }
      `;

      const variables = { query: shopifyqlQuery };

      const data = (await shopifyClient.request(graphqlQuery, variables)) as {
        shopifyqlQuery: {
          tableData: {
            columns: Array<{
              name: string;
              dataType: string;
              displayName: string;
            }>;
            rows: string[][];
          } | null;
          parseErrors: string[];
        };
      };

      // Handle ShopifyQL parse errors
      if (
        data.shopifyqlQuery.parseErrors &&
        data.shopifyqlQuery.parseErrors.length > 0
      ) {
        throw new Error(
          `ShopifyQL parse errors: ${data.shopifyqlQuery.parseErrors.join("; ")}`
        );
      }

      // Format response
      const tableData = data.shopifyqlQuery.tableData;
      if (!tableData) {
        return {
          query: shopifyqlQuery,
          period,
          sortBy,
          columns: [],
          products: [],
          productCount: 0
        };
      }

      // Transform rows into product objects for easier consumption
      const products = tableData.rows.map((row) => {
        const product: Record<string, string> = {};
        tableData.columns.forEach((col, index) => {
          product[col.name] = row[index];
        });
        return product;
      });

      return {
        query: shopifyqlQuery,
        period,
        sortBy,
        columns: tableData.columns,
        products,
        productCount: products.length
      };
    } catch (error) {
      console.error("Error fetching product performance:", error);
      throw new Error(
        `Failed to fetch product performance: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

export { getProductPerformance };
