const ACTIVE_ORDER_STATUSES = new Set(["pending", "confirmed", "out_for_delivery"]);

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getAllOrders(customer) {
  const rawOrders = Array.isArray(customer.orders) ? customer.orders : [];
  const current = Array.isArray(customer.currentOrders)
    ? customer.currentOrders
    : rawOrders.filter((order) => ACTIVE_ORDER_STATUSES.has(normalize(order?.status)));
  const history = Array.isArray(customer.orderHistory)
    ? customer.orderHistory
    : rawOrders.filter((order) => !ACTIVE_ORDER_STATUSES.has(normalize(order?.status)));
  return current.length + history.length > 0 ? [...current, ...history] : rawOrders;
}

export function filterCustomerRecords(customers, filters = {}) {
  let result = [...customers];

  if (filters.filterOrders === "has") {
    result = result.filter((customer) => getAllOrders(customer).length > 0);
  } else if (filters.filterOrders === "none") {
    result = result.filter((customer) => getAllOrders(customer).length === 0);
  }

  if (filters.filterEmail === "yes") {
    result = result.filter((customer) => !!customer.email?.trim());
  } else if (filters.filterEmail === "no") {
    result = result.filter((customer) => !customer.email?.trim());
  }

  if (filters.filterAddr === "yes") {
    result = result.filter((customer) => (customer.addresses?.length ?? 0) > 0);
  } else if (filters.filterAddr === "no") {
    result = result.filter((customer) => (customer.addresses?.length ?? 0) === 0);
  }

  if (filters.filterWallet === "has") {
    result = result.filter((customer) => (Number(customer.walletBalance) || 0) > 0);
  } else if (filters.filterWallet === "none") {
    result = result.filter((customer) => (Number(customer.walletBalance) || 0) === 0);
  }

  if (filters.filterJoinedFrom) {
    result = result.filter((customer) => new Date(customer.createdAt) >= new Date(filters.filterJoinedFrom));
  }
  if (filters.filterJoinedTo) {
    result = result.filter((customer) => new Date(customer.createdAt) <= new Date(`${filters.filterJoinedTo}T23:59:59`));
  }

  if (filters.sort === "wallet_desc") {
    result.sort((a, b) => (Number(b.walletBalance) || 0) - (Number(a.walletBalance) || 0));
  } else if (filters.sort === "wallet_asc") {
    result.sort((a, b) => (Number(a.walletBalance) || 0) - (Number(b.walletBalance) || 0));
  }

  return result;
}

export function toCustomerExportRow(customer) {
  return {
    "Full Name": String(customer.name ?? ""),
    Phone: String(customer.phone ?? ""),
  };
}
