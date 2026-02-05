import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";

// Input schema for searchOrders
const SearchOrdersInputSchema = z.object({
  query: z
    .string()
    .describe(
      "Search query using Shopify search syntax. Examples: 'financial_status:paid', 'fulfillment_status:unfulfilled', 'created_at:>2024-01-01', 'customer_email:test@example.com', 'tag:vip'"
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
});

type SearchOrdersInput = z.infer<typeof SearchOrdersInputSchema>;

// Will be initialized in index.ts
let shopifyClient: GraphQLClient;

const searchOrders = {
  name: "search-orders",
  description:
    "Search orders with advanced filtering. Use Shopify query syntax for powerful filtering by status, date, customer, tags, and more. Requires read_orders scope.",
  schema: SearchOrdersInputSchema,

  initialize(client: GraphQLClient) {
    shopifyClient = client;
  },

  execute: async (input: SearchOrdersInput) => {
    try {
      const { query: searchQuery, limit, sortKey, reverse } = input;

      const query = gql`
        query SearchOrders(
          $first: Int!
          $query: String!
          $sortKey: OrderSortKeys
          $reverse: Boolean
        ) {
          orders(
            first: $first
            query: $query
            sortKey: $sortKey
            reverse: $reverse
          ) {
            edges {
              node {
                id
                name
                createdAt
                updatedAt
                processedAt
                displayFinancialStatus
                displayFulfillmentStatus
                confirmed
                closed
                cancelledAt
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                subtotalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalTaxSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalShippingPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                customer {
                  id
                  firstName
                  lastName
                  email
                }
                shippingAddress {
                  city
                  province
                  country
                }
                tags
                note
                lineItems(first: 5) {
                  edges {
                    node {
                      title
                      quantity
                      originalTotalSet {
                        shopMoney {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const variables = {
        first: limit,
        query: searchQuery,
        sortKey,
        reverse
      };

      const data = (await shopifyClient.request(query, variables)) as {
        orders: {
          edges: Array<{
            node: {
              id: string;
              name: string;
              createdAt: string;
              updatedAt: string;
              processedAt: string | null;
              displayFinancialStatus: string;
              displayFulfillmentStatus: string;
              confirmed: boolean;
              closed: boolean;
              cancelledAt: string | null;
              totalPriceSet: {
                shopMoney: { amount: string; currencyCode: string };
              };
              subtotalPriceSet: {
                shopMoney: { amount: string; currencyCode: string };
              };
              totalTaxSet: {
                shopMoney: { amount: string; currencyCode: string };
              };
              totalShippingPriceSet: {
                shopMoney: { amount: string; currencyCode: string };
              };
              customer: {
                id: string;
                firstName: string | null;
                lastName: string | null;
                email: string | null;
              } | null;
              shippingAddress: {
                city: string | null;
                province: string | null;
                country: string | null;
              } | null;
              tags: string[];
              note: string | null;
              lineItems: {
                edges: Array<{
                  node: {
                    title: string;
                    quantity: number;
                    originalTotalSet: {
                      shopMoney: { amount: string; currencyCode: string };
                    };
                  };
                }>;
              };
            };
          }>;
        };
      };

      // Format orders
      const orders = data.orders.edges.map((edge) => {
        const order = edge.node;

        return {
          id: order.id,
          name: order.name,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          processedAt: order.processedAt,
          financialStatus: order.displayFinancialStatus,
          fulfillmentStatus: order.displayFulfillmentStatus,
          confirmed: order.confirmed,
          closed: order.closed,
          cancelledAt: order.cancelledAt,
          totalPrice: {
            amount: order.totalPriceSet.shopMoney.amount,
            currencyCode: order.totalPriceSet.shopMoney.currencyCode
          },
          subtotalPrice: {
            amount: order.subtotalPriceSet.shopMoney.amount,
            currencyCode: order.subtotalPriceSet.shopMoney.currencyCode
          },
          totalTax: {
            amount: order.totalTaxSet.shopMoney.amount,
            currencyCode: order.totalTaxSet.shopMoney.currencyCode
          },
          totalShipping: {
            amount: order.totalShippingPriceSet.shopMoney.amount,
            currencyCode: order.totalShippingPriceSet.shopMoney.currencyCode
          },
          customer: order.customer
            ? {
                id: order.customer.id,
                firstName: order.customer.firstName,
                lastName: order.customer.lastName,
                email: order.customer.email
              }
            : null,
          shippingAddress: order.shippingAddress
            ? {
                city: order.shippingAddress.city,
                province: order.shippingAddress.province,
                country: order.shippingAddress.country
              }
            : null,
          tags: order.tags,
          note: order.note,
          lineItems: order.lineItems.edges.map((li) => ({
            title: li.node.title,
            quantity: li.node.quantity,
            totalPrice: {
              amount: li.node.originalTotalSet.shopMoney.amount,
              currencyCode: li.node.originalTotalSet.shopMoney.currencyCode
            }
          }))
        };
      });

      return {
        query: searchQuery,
        sortKey,
        reverse,
        orders,
        orderCount: orders.length
      };
    } catch (error) {
      console.error("Error searching orders:", error);
      throw new Error(
        `Failed to search orders: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

export { searchOrders };
