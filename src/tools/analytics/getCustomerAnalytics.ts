import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import { periodToShopifyQL } from "../../utils/shopifyqlHelpers.js";

// Input schema for getCustomerAnalytics
const GetCustomerAnalyticsInputSchema = z.object({
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
});

type GetCustomerAnalyticsInput = z.infer<typeof GetCustomerAnalyticsInputSchema>;

// Will be initialized in index.ts
let shopifyClient: GraphQLClient;

const getCustomerAnalytics = {
  name: "get-customer-analytics",
  description:
    "Get customer analytics including acquisition trends, retention metrics, and spending patterns. Requires read_reports scope.",
  schema: GetCustomerAnalyticsInputSchema,

  initialize(client: GraphQLClient) {
    shopifyClient = client;
  },

  execute: async (input: GetCustomerAnalyticsInput) => {
    try {
      const { period, reportType, groupBy } = input;
      const periodClause = periodToShopifyQL(period);

      // Build query based on report type
      let shopifyqlQuery: string;

      switch (reportType) {
        case "acquisition":
          // New vs returning customers over time
          shopifyqlQuery = `FROM sales SHOW total_sales, orders WHERE customer_type = 'First-time' OR customer_type = 'Returning' ${periodClause} GROUP BY customer_type, ${groupBy} ORDER BY ${groupBy}`;
          break;

        case "retention":
          // Customer retention metrics
          shopifyqlQuery = `FROM sales SHOW total_sales, orders, average_order_value ${periodClause} GROUP BY customer_type ORDER BY total_sales DESC`;
          break;

        case "spending":
          // Customer spending patterns by region
          shopifyqlQuery = `FROM sales SHOW total_sales, orders, average_order_value ${periodClause} GROUP BY billing_country ORDER BY total_sales DESC LIMIT 20`;
          break;

        case "overview":
        default:
          // General customer overview
          shopifyqlQuery = `FROM sales SHOW total_sales, orders, average_order_value ${periodClause} GROUP BY customer_type, ${groupBy} ORDER BY ${groupBy}`;
          break;
      }

      const graphqlQuery = gql`
        query GetCustomerAnalytics($query: String!) {
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
          reportType,
          columns: [],
          rows: [],
          rowCount: 0
        };
      }

      // Transform rows into objects for easier consumption
      const results = tableData.rows.map((row) => {
        const result: Record<string, string> = {};
        tableData.columns.forEach((col, index) => {
          result[col.name] = row[index];
        });
        return result;
      });

      return {
        query: shopifyqlQuery,
        period,
        reportType,
        groupBy,
        columns: tableData.columns,
        results,
        rowCount: results.length
      };
    } catch (error) {
      console.error("Error fetching customer analytics:", error);
      throw new Error(
        `Failed to fetch customer analytics: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

export { getCustomerAnalytics };
