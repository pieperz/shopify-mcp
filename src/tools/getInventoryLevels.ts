import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";

// Input schema for getInventoryLevels
const GetInventoryLevelsInputSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(20)
    .describe("Maximum number of inventory items to return"),
  sku: z.string().optional().describe("Filter by SKU (exact match)"),
  productId: z.string().optional().describe("Filter by product ID")
});

type GetInventoryLevelsInput = z.infer<typeof GetInventoryLevelsInputSchema>;

// Will be initialized in index.ts
let shopifyClient: GraphQLClient;

const getInventoryLevels = {
  name: "get-inventory-levels",
  description:
    "Get inventory levels across all locations. Returns available, incoming, committed, and reserved quantities. Requires read_inventory scope.",
  schema: GetInventoryLevelsInputSchema,

  initialize(client: GraphQLClient) {
    shopifyClient = client;
  },

  execute: async (input: GetInventoryLevelsInput) => {
    try {
      const { limit, sku, productId } = input;

      // Build query filter
      let queryFilter: string | undefined;
      if (sku) {
        queryFilter = `sku:${sku}`;
      } else if (productId) {
        // Extract numeric ID if full GID is provided
        const numericId = productId.includes("/")
          ? productId.split("/").pop()
          : productId;
        queryFilter = `product_id:${numericId}`;
      }

      const query = gql`
        query GetInventoryLevels($first: Int!, $query: String) {
          inventoryItems(first: $first, query: $query) {
            edges {
              node {
                id
                sku
                tracked
                inventoryLevels(first: 10) {
                  edges {
                    node {
                      id
                      quantities(
                        names: ["available", "incoming", "committed", "reserved", "on_hand"]
                      ) {
                        name
                        quantity
                      }
                      location {
                        id
                        name
                      }
                    }
                  }
                }
                variant {
                  id
                  title
                  displayName
                  product {
                    id
                    title
                  }
                }
              }
            }
          }
        }
      `;

      const variables = {
        first: limit,
        query: queryFilter
      };

      const data = (await shopifyClient.request(query, variables)) as {
        inventoryItems: {
          edges: Array<{
            node: {
              id: string;
              sku: string | null;
              tracked: boolean;
              inventoryLevels: {
                edges: Array<{
                  node: {
                    id: string;
                    quantities: Array<{
                      name: string;
                      quantity: number;
                    }>;
                    location: {
                      id: string;
                      name: string;
                    };
                  };
                }>;
              };
              variant: {
                id: string;
                title: string;
                displayName: string;
                product: {
                  id: string;
                  title: string;
                };
              } | null;
            };
          }>;
        };
      };

      // Format inventory items
      const inventoryItems = data.inventoryItems.edges.map((edge) => {
        const item = edge.node;

        // Format inventory levels by location
        const levels = item.inventoryLevels.edges.map((levelEdge) => {
          const level = levelEdge.node;
          const quantityMap: Record<string, number> = {};
          level.quantities.forEach((q) => {
            quantityMap[q.name] = q.quantity;
          });

          return {
            locationId: level.location.id,
            locationName: level.location.name,
            available: quantityMap["available"] || 0,
            incoming: quantityMap["incoming"] || 0,
            committed: quantityMap["committed"] || 0,
            reserved: quantityMap["reserved"] || 0,
            onHand: quantityMap["on_hand"] || 0
          };
        });

        return {
          id: item.id,
          sku: item.sku,
          tracked: item.tracked,
          variant: item.variant
            ? {
                id: item.variant.id,
                title: item.variant.title,
                displayName: item.variant.displayName,
                productId: item.variant.product.id,
                productTitle: item.variant.product.title
              }
            : null,
          inventoryLevels: levels,
          totalAvailable: levels.reduce((sum, l) => sum + l.available, 0),
          totalOnHand: levels.reduce((sum, l) => sum + l.onHand, 0)
        };
      });

      return {
        inventoryItems,
        itemCount: inventoryItems.length
      };
    } catch (error) {
      console.error("Error fetching inventory levels:", error);
      throw new Error(
        `Failed to fetch inventory levels: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

export { getInventoryLevels };
