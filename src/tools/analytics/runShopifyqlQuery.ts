import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";

// Input schema for runShopifyqlQuery
const RunShopifyqlQueryInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "ShopifyQL query string. Must include FROM and SHOW clauses. Example: 'FROM sales SHOW total_sales GROUP BY day SINCE last_week'"
    )
});

type RunShopifyqlQueryInput = z.infer<typeof RunShopifyqlQueryInputSchema>;

// Will be initialized in index.ts
let shopifyClient: GraphQLClient;

const runShopifyqlQuery = {
  name: "run-shopifyql-query",
  description:
    "Execute a custom ShopifyQL query for analytics. Use this for flexible, custom analytics queries. Requires read_reports scope. ShopifyQL syntax: FROM <table> SHOW <metrics> [WHERE <conditions>] [SINCE/DURING <period>] [GROUP BY <dimension>] [ORDER BY <field>] [LIMIT <n>]. Tables: sales, orders, products, customers. Example: 'FROM sales SHOW total_sales, orders GROUP BY day SINCE -30d ORDER BY day'",
  schema: RunShopifyqlQueryInputSchema,

  initialize(client: GraphQLClient) {
    shopifyClient = client;
  },

  execute: async (input: RunShopifyqlQueryInput) => {
    try {
      const { query: shopifyqlQuery } = input;

      const graphqlQuery = gql`
        query RunShopifyQLQuery($query: String!) {
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
        return { columns: [], rows: [], rowCount: 0 };
      }

      return {
        columns: tableData.columns,
        rows: tableData.rows,
        rowCount: tableData.rows.length
      };
    } catch (error) {
      console.error("Error executing ShopifyQL query:", error);
      throw new Error(
        `Failed to execute ShopifyQL query: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

export { runShopifyqlQuery };
