export type CustomerExportFilters = {
  filterOrders?: "all" | "has" | "none";
  filterEmail?: "all" | "yes" | "no";
  filterAddr?: "all" | "yes" | "no";
  filterWallet?: "all" | "has" | "none";
  filterJoinedFrom?: string;
  filterJoinedTo?: string;
  sort?: string;
};

export declare function filterCustomerRecords<T extends Record<string, any>>(
  customers: T[],
  filters?: CustomerExportFilters,
): T[];
