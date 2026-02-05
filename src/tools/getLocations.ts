import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";

// Input schema for getLocations
const GetLocationsInputSchema = z.object({
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
});

type GetLocationsInput = z.infer<typeof GetLocationsInputSchema>;

// Will be initialized in index.ts
let shopifyClient: GraphQLClient;

const getLocations = {
  name: "get-locations",
  description:
    "Get store locations. Returns all fulfillment locations including warehouses, retail stores, and drop shippers. Requires read_locations scope.",
  schema: GetLocationsInputSchema,

  initialize(client: GraphQLClient) {
    shopifyClient = client;
  },

  execute: async (input: GetLocationsInput) => {
    try {
      const { limit, includeInactive } = input;

      const query = gql`
        query GetLocations($first: Int!, $includeInactive: Boolean) {
          locations(first: $first, includeInactive: $includeInactive) {
            edges {
              node {
                id
                name
                isActive
                fulfillsOnlineOrders
                hasActiveInventory
                shipsInventory
                address {
                  address1
                  address2
                  city
                  province
                  provinceCode
                  country
                  countryCode
                  zip
                  phone
                }
              }
            }
          }
        }
      `;

      const variables = {
        first: limit,
        includeInactive
      };

      const data = (await shopifyClient.request(query, variables)) as {
        locations: {
          edges: Array<{
            node: {
              id: string;
              name: string;
              isActive: boolean;
              fulfillsOnlineOrders: boolean;
              hasActiveInventory: boolean;
              shipsInventory: boolean;
              address: {
                address1: string | null;
                address2: string | null;
                city: string | null;
                province: string | null;
                provinceCode: string | null;
                country: string | null;
                countryCode: string | null;
                zip: string | null;
                phone: string | null;
              };
            };
          }>;
        };
      };

      // Format locations
      const locations = data.locations.edges.map((edge) => {
        const loc = edge.node;
        return {
          id: loc.id,
          name: loc.name,
          isActive: loc.isActive,
          fulfillsOnlineOrders: loc.fulfillsOnlineOrders,
          hasActiveInventory: loc.hasActiveInventory,
          shipsInventory: loc.shipsInventory,
          address: {
            address1: loc.address.address1,
            address2: loc.address.address2,
            city: loc.address.city,
            province: loc.address.province,
            provinceCode: loc.address.provinceCode,
            country: loc.address.country,
            countryCode: loc.address.countryCode,
            zip: loc.address.zip,
            phone: loc.address.phone
          }
        };
      });

      return {
        locations,
        locationCount: locations.length
      };
    } catch (error) {
      console.error("Error fetching locations:", error);
      throw new Error(
        `Failed to fetch locations: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

export { getLocations };
