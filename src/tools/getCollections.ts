import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";

// Input schema for getCollections
const GetCollectionsInputSchema = z.object({
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
});

type GetCollectionsInput = z.infer<typeof GetCollectionsInputSchema>;

// Will be initialized in index.ts
let shopifyClient: GraphQLClient;

const getCollections = {
  name: "get-collections",
  description:
    "Get product collections. Returns both smart (rule-based) and manual collections with product counts. Requires read_products scope.",
  schema: GetCollectionsInputSchema,

  initialize(client: GraphQLClient) {
    shopifyClient = client;
  },

  execute: async (input: GetCollectionsInput) => {
    try {
      const { limit, searchQuery, collectionType } = input;

      // Build query filter
      let queryFilter: string | undefined;
      const filters: string[] = [];

      if (searchQuery) {
        filters.push(`title:*${searchQuery}*`);
      }

      if (collectionType === "smart") {
        filters.push("collection_type:smart");
      } else if (collectionType === "manual") {
        filters.push("collection_type:custom");
      }

      if (filters.length > 0) {
        queryFilter = filters.join(" AND ");
      }

      const query = gql`
        query GetCollections($first: Int!, $query: String) {
          collections(first: $first, query: $query) {
            edges {
              node {
                id
                title
                handle
                description
                descriptionHtml
                productsCount {
                  count
                }
                sortOrder
                templateSuffix
                updatedAt
                image {
                  url
                  altText
                }
                ruleSet {
                  appliedDisjunctively
                  rules {
                    column
                    relation
                    condition
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
        collections: {
          edges: Array<{
            node: {
              id: string;
              title: string;
              handle: string;
              description: string | null;
              descriptionHtml: string | null;
              productsCount: {
                count: number;
              };
              sortOrder: string;
              templateSuffix: string | null;
              updatedAt: string;
              image: {
                url: string;
                altText: string | null;
              } | null;
              ruleSet: {
                appliedDisjunctively: boolean;
                rules: Array<{
                  column: string;
                  relation: string;
                  condition: string;
                }>;
              } | null;
            };
          }>;
        };
      };

      // Format collections
      const collections = data.collections.edges.map((edge) => {
        const col = edge.node;

        // Determine collection type based on ruleSet
        const isSmartCollection = col.ruleSet !== null && col.ruleSet.rules.length > 0;

        return {
          id: col.id,
          title: col.title,
          handle: col.handle,
          description: col.description,
          productCount: col.productsCount.count,
          sortOrder: col.sortOrder,
          templateSuffix: col.templateSuffix,
          updatedAt: col.updatedAt,
          imageUrl: col.image?.url || null,
          imageAltText: col.image?.altText || null,
          collectionType: isSmartCollection ? "smart" : "manual",
          rules: isSmartCollection
            ? {
                appliedDisjunctively: col.ruleSet!.appliedDisjunctively,
                rules: col.ruleSet!.rules
              }
            : null
        };
      });

      return {
        collections,
        collectionCount: collections.length
      };
    } catch (error) {
      console.error("Error fetching collections:", error);
      throw new Error(
        `Failed to fetch collections: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

export { getCollections };
