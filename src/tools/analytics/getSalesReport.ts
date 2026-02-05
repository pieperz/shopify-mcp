import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import { buildShopifyQLQuery } from "../../utils/shopifyqlHelpers.js";

// Input schema for getSalesReport
const GetSalesReportInputSchema = z.object({
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
});

type GetSalesReportInput = z.infer<typeof GetSalesReportInputSchema>;

// Will be initialized in index.ts
let shopifyClient: GraphQLClient;

const getSalesReport = {
  name: "get-sales-report",
  description:
    "Get a pre-built sales analytics report. Returns sales data grouped by time period, product, channel, or region. Requires read_reports scope.",
  schema: GetSalesReportInputSchema,

  initialize(client: GraphQLClient) {
    shopifyClient = client;
  },

  execute: async (input: GetSalesReportInput) => {
    try {
      const { period, groupBy, metrics, limit } = input;

      // Build the ShopifyQL query
      const shopifyqlQuery = buildShopifyQLQuery({
        from: "sales",
        show: metrics,
        groupBy,
        period,
        limit
      });

      const graphqlQuery = gql`
        query GetSalesReport($query: String!) {
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
          groupBy,
          columns: [],
          rows: [],
          rowCount: 0
        };
      }

      return {
        query: shopifyqlQuery,
        period,
        groupBy,
        columns: tableData.columns,
        rows: tableData.rows,
        rowCount: tableData.rows.length
      };
    } catch (error) {
      console.error("Error fetching sales report:", error);
      throw new Error(
        `Failed to fetch sales report: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

export { getSalesReport };
