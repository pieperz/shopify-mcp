/**
 * ShopifyQL Helper Utilities
 * Convert user-friendly inputs to ShopifyQL syntax
 */

/**
 * Convert user-friendly period strings to ShopifyQL date syntax
 */
export function periodToShopifyQL(period: string): string {
  const periodMap: Record<string, string> = {
    today: "SINCE today",
    yesterday: "DURING yesterday",
    last_7_days: "SINCE -7d",
    last_30_days: "SINCE -30d",
    last_90_days: "SINCE -90d",
    last_month: "DURING last_month",
    this_month: "SINCE startOfMonth(0m)",
    this_year: "SINCE startOfYear(0y)",
    last_year: "DURING last_year"
  };
  return periodMap[period] || "SINCE -30d";
}

/**
 * Convert groupBy option to ShopifyQL GROUP BY clause
 */
export function groupByToShopifyQL(groupBy: string): string {
  const groupByMap: Record<string, string> = {
    day: "GROUP BY day",
    week: "GROUP BY week",
    month: "GROUP BY month",
    product: "GROUP BY product_title",
    product_type: "GROUP BY product_type",
    channel: "GROUP BY sales_channel",
    region: "GROUP BY billing_country",
    customer_type: "GROUP BY customer_type"
  };
  return groupByMap[groupBy] || "GROUP BY day";
}

/**
 * Convert groupBy option to ShopifyQL ORDER BY clause
 */
export function groupByToOrderBy(groupBy: string): string {
  const orderByMap: Record<string, string> = {
    day: "ORDER BY day",
    week: "ORDER BY week",
    month: "ORDER BY month",
    product: "ORDER BY total_sales DESC",
    product_type: "ORDER BY total_sales DESC",
    channel: "ORDER BY total_sales DESC",
    region: "ORDER BY total_sales DESC",
    customer_type: "ORDER BY total_sales DESC"
  };
  return orderByMap[groupBy] || "ORDER BY day";
}

/**
 * Build a complete ShopifyQL query from parts
 */
export function buildShopifyQLQuery(options: {
  from: string;
  show: string[];
  where?: string;
  groupBy?: string;
  period: string;
  orderBy?: string;
  limit?: number;
}): string {
  const parts = [`FROM ${options.from}`, `SHOW ${options.show.join(", ")}`];

  if (options.where) {
    parts.push(`WHERE ${options.where}`);
  }

  parts.push(periodToShopifyQL(options.period));

  if (options.groupBy) {
    parts.push(groupByToShopifyQL(options.groupBy));
  }

  if (options.orderBy) {
    parts.push(options.orderBy);
  } else if (options.groupBy) {
    parts.push(groupByToOrderBy(options.groupBy));
  }

  if (options.limit) {
    parts.push(`LIMIT ${options.limit}`);
  }

  return parts.join(" ");
}
