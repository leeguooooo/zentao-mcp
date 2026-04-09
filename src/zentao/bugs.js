import {
  normalizeResult,
  normalizeError,
  toInt,
  normalizeAccountValue,
  extractAccounts,
  matchesAccount,
} from "./normalize.js";

export async function listBugs(client, { product, page, limit }) {
  if (!product) throw new Error("product is required");

  const payload = await client.request({
    method: "GET",
    path: "/api.php/v1/bugs",
    query: {
      product,
      page: toInt(page, 1),
      limit: toInt(limit, 20),
    },
  });

  if (payload.error) return normalizeError(payload.error, payload);
  return normalizeResult(payload);
}

export async function getBug(client, { id }) {
  if (!id) throw new Error("id is required");

  const payload = await client.request({
    method: "GET",
    path: `/api.php/v1/bugs/${id}`,
  });

  if (payload.error) return normalizeError(payload.error, payload);
  return normalizeResult(payload);
}

export async function resolveBug(client, { id, resolution, resolvedBuild, assignedTo, comment }) {
  if (!id) throw new Error("id is required");
  if (!resolution) throw new Error("resolution is required");

  const body = { resolution };
  if (resolvedBuild) body.resolvedBuild = resolvedBuild;
  if (assignedTo) body.assignedTo = assignedTo;
  if (comment) body.comment = comment;

  const payload = await client.request({
    method: "POST",
    path: `/api.php/v1/bugs/${id}/resolve`,
    body,
  });

  if (payload.error) return normalizeError(payload.error, payload);
  return normalizeResult(payload);
}

export async function assignBug(client, { id, assignedTo, comment }) {
  if (!id) throw new Error("id is required");
  if (!assignedTo) throw new Error("assignedTo is required");

  const body = { assignedTo };
  if (comment) body.comment = comment;

  const payload = await client.request({
    method: "POST",
    path: `/api.php/v1/bugs/${id}/assign`,
    body,
  });

  if (payload.error) return normalizeError(payload.error, payload);
  return normalizeResult(payload);
}

export async function closeBug(client, { id, comment }) {
  if (!id) throw new Error("id is required");

  const body = {};
  if (comment) body.comment = comment;

  const payload = await client.request({
    method: "POST",
    path: `/api.php/v1/bugs/${id}/close`,
    body,
  });

  if (payload.error) return normalizeError(payload.error, payload);
  return normalizeResult(payload);
}

export async function activateBug(client, { id, assignedTo, openedBuild, comment }) {
  if (!id) throw new Error("id is required");

  // REST API v1 does not support activate — use traditional web API with session cookies
  await client.ensureSessionCookies();

  const params = new URLSearchParams();
  params.set("openedBuild", openedBuild || "trunk");
  if (assignedTo) params.set("assignedTo", assignedTo);
  if (comment) params.set("comment", comment);

  const url = `${client.baseUrl}/bug-activate-${id}.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": `${client.baseUrl}/bug-view-${id}.html`,
      Cookie: client.formatSessionCookies(),
    },
    body: params.toString(),
    redirect: "manual",
  });

  if (res.status === 302) {
    return normalizeResult({ id: Number(id), assignedTo, comment });
  }

  const text = await res.text();
  if (text.includes("parent.location") || text.includes("reload")) {
    return normalizeResult({ id: Number(id), assignedTo, comment });
  }

  try {
    const json = JSON.parse(text);
    if (json.result === "success" || json.status === "success") {
      return normalizeResult({ id: Number(id), assignedTo, comment });
    }
    const errMsg = json.message
      ? (typeof json.message === "string" ? json.message : JSON.stringify(json.message))
      : json.error || "activate failed";
    return normalizeError(errMsg, json);
  } catch {
    throw new Error(`Activate response parse failed: ${text.slice(0, 200)}`);
  }
}

export async function createBug(client, { product, title, severity, pri, type, steps, assignedTo, openedBuild }) {
  if (!product) throw new Error("product is required");
  if (!title) throw new Error("title is required");

  const body = { product: Number(product), title };
  if (severity) body.severity = Number(severity);
  if (pri) body.pri = Number(pri);
  if (type) body.type = type;
  if (steps) body.steps = steps;
  if (assignedTo) body.assignedTo = assignedTo;
  if (openedBuild) body.openedBuild = openedBuild;

  const payload = await client.request({
    method: "POST",
    path: "/api.php/v1/bugs",
    body,
  });

  if (payload.error) return normalizeError(payload.error, payload);
  return normalizeResult(payload);
}

export async function commentBug(client, { id, comment }) {
  if (!id) throw new Error("id is required");
  if (!comment) throw new Error("comment is required");

  await client.ensureSessionCookies();

  const url = `${client.baseUrl}/action-comment-bug-${id}.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": `${client.baseUrl}/bug-view-${id}.html`,
      Cookie: client.formatSessionCookies(),
    },
    body: `comment=${encodeURIComponent(comment)}`,
    redirect: "manual",
  });

  if (res.status === 302) {
    return normalizeResult({ id: Number(id), comment });
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    if (text.includes("parent.location") || text.includes("reload")) {
      return normalizeResult({ id: Number(id), comment });
    }
    throw new Error(`Comment response parse failed: ${text.slice(0, 200)}`);
  }

  if (json.status === "success") {
    return normalizeResult({ id: Number(id), comment });
  }

  return normalizeError(json.error || "comment failed", json);
}

export async function fetchAllBugsForProduct(client, { product, perPage, maxItems }) {
  const bugs = [];
  let page = 1;
  let total = null;
  const pageSize = toInt(perPage, 100);
  const cap = toInt(maxItems, 0);

  while (true) {
    const payload = await client.request({
      method: "GET",
      path: "/api.php/v1/bugs",
      query: { product, page, limit: pageSize },
    });

    if (payload.error) throw new Error(payload.error);

    const pageBugs = Array.isArray(payload.bugs) ? payload.bugs : [];
    total = payload.total ?? total;
    for (const bug of pageBugs) {
      bugs.push(bug);
      if (cap > 0 && bugs.length >= cap) return { bugs, total };
    }

    if (total !== null && payload.limit) {
      if (page * payload.limit >= total) break;
    } else if (pageBugs.length < pageSize) {
      break;
    }

    page += 1;
  }

  return { bugs, total };
}

export async function bugsStats(client, { productIds, groupBy, from, to, perPage }) {
  if (!Array.isArray(productIds) || !productIds.length) {
    return normalizeError("productIds is required and must be a non-empty array");
  }

  const { listProducts } = await import("./products.js");

  const productsResponse = await listProducts(client, { page: 1, limit: 1000 });
  if (productsResponse.status !== 1) return productsResponse;
  const allProducts = productsResponse.result.products || [];

  const productSet = new Set(productIds.map((id) => Number(id)));
  const products = allProducts.filter((p) => productSet.has(Number(p.id)));

  if (!products.length) {
    return normalizeError("No matching products found for the given product-ids");
  }

  const hasTimeFilter = Boolean(from || to);
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate) fromDate.setHours(0, 0, 0, 0);
  if (toDate) toDate.setHours(23, 59, 59, 999);

  const allBugs = [];

  for (const product of products) {
    const { bugs } = await fetchAllBugsForProduct(client, {
      product: product.id,
      perPage,
    });
    for (const bug of bugs) {
      allBugs.push({ ...bug, _productId: product.id, _productName: product.name });
    }
  }

  const isResolved = (bug) => {
    const s = String(bug.status || "").toLowerCase();
    return s === "resolved" || s === "closed";
  };

  const inTimeRange = (bug) => {
    if (!hasTimeFilter) return true;
    const dateStr = bug.resolvedDate;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  const targetGroupBy = (groupBy || "product").toLowerCase();
  const totalBugs = allBugs.length;

  if (targetGroupBy === "product") {
    const groups = [];
    for (const product of products) {
      const productBugs = allBugs.filter((b) => b._productId === product.id);
      const total = productBugs.length;
      const resolved = productBugs.filter((b) => isResolved(b) && inTimeRange(b)).length;
      const active = total - productBugs.filter((b) => isResolved(b)).length;
      const group = { productId: product.id, productName: product.name, total, resolved, active };
      if (!hasTimeFilter) group.rate = total > 0 ? resolved / total : 0;
      groups.push(group);
    }
    const totalAll = groups.reduce((s, g) => s + g.total, 0);
    const resolvedAll = groups.reduce((s, g) => s + g.resolved, 0);
    const activeAll = groups.reduce((s, g) => s + g.active, 0);
    const result = {
      groupBy: "product",
      hasTimeFilter,
      from: from || null,
      to: to || null,
      totalBugs: totalAll,
      totalResolved: resolvedAll,
      totalActive: activeAll,
      groups,
    };
    if (!hasTimeFilter) result.rate = totalAll > 0 ? resolvedAll / totalAll : 0;
    return normalizeResult(result);
  }

  if (targetGroupBy === "person") {
    const personMap = {};
    const unresolvedCount = allBugs.filter((b) => !isResolved(b)).length;

    for (const bug of allBugs) {
      if (!isResolved(bug)) continue;
      if (!inTimeRange(bug)) continue;
      const accounts = extractAccounts(bug.resolvedBy);
      const account = accounts.length > 0 ? accounts[0] : "(unknown)";
      if (!personMap[account]) personMap[account] = { person: account, resolved: 0 };
      personMap[account].resolved += 1;
    }

    const groups = Object.values(personMap).sort((a, b) => b.resolved - a.resolved);
    const resolvedAll = groups.reduce((s, g) => s + g.resolved, 0);

    const result = {
      groupBy: "person",
      hasTimeFilter,
      from: from || null,
      to: to || null,
      totalBugs,
      totalResolved: resolvedAll,
      totalActive: unresolvedCount,
      groups,
    };
    if (!hasTimeFilter) result.rate = totalBugs > 0 ? resolvedAll / totalBugs : 0;
    return normalizeResult(result);
  }

  return normalizeError(`Unknown group-by value: ${groupBy}. Use "product" or "person".`);
}

export async function bugsMine(client, { account, scope, status, productIds, includeZero, perPage, maxItems, includeDetails }) {
  const { listProducts } = await import("./products.js");

  const matchAccount = normalizeAccountValue(account || client.account);
  const targetScope = (scope || "assigned").toLowerCase();
  const rawStatus = status ?? "active";
  const statusList = Array.isArray(rawStatus) ? rawStatus : String(rawStatus).split(/[|,]/);
  const statusSet = new Set(
    statusList.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
  );
  const allowAllStatus = statusSet.has("all") || statusSet.size === 0;

  const productsResponse = await listProducts(client, { page: 1, limit: 1000 });
  if (productsResponse.status !== 1) return productsResponse;
  const products = productsResponse.result.products || [];

  const productSet = Array.isArray(productIds) && productIds.length
    ? new Set(productIds.map((id) => Number(id)))
    : null;

  const rows = [];
  const bugs = [];
  let totalMatches = 0;
  const maxCollect = toInt(maxItems, 200);

  for (const product of products) {
    if (productSet && !productSet.has(Number(product.id))) continue;
    const { bugs: productBugs } = await fetchAllBugsForProduct(client, {
      product: product.id,
      perPage,
    });

    const matches = productBugs.filter((bug) => {
      if (!allowAllStatus) {
        const bugStatus = String(bug.status || "").trim().toLowerCase();
        if (!statusSet.has(bugStatus)) return false;
      }
      const assigned = matchesAccount(bug.assignedTo, matchAccount);
      const opened = matchesAccount(bug.openedBy, matchAccount);
      const resolved = matchesAccount(bug.resolvedBy, matchAccount);
      if (targetScope === "assigned") return assigned;
      if (targetScope === "opened") return opened;
      if (targetScope === "resolved") return resolved;
      return assigned || opened || resolved;
    });

    if (!includeZero && matches.length === 0) continue;
    totalMatches += matches.length;

    rows.push({
      id: product.id,
      name: product.name,
      totalBugs: toInt(product.totalBugs, 0),
      myBugs: matches.length,
    });

    if (includeDetails && bugs.length < maxCollect) {
      for (const bug of matches) {
        if (bugs.length >= maxCollect) break;
        bugs.push({
          id: bug.id,
          title: bug.title,
          product: bug.product,
          status: bug.status,
          pri: bug.pri,
          severity: bug.severity,
          assignedTo: bug.assignedTo,
          openedBy: bug.openedBy,
          resolvedBy: bug.resolvedBy,
          openedDate: bug.openedDate,
        });
      }
    }
  }

  return normalizeResult({
    account: matchAccount,
    scope: targetScope,
    status: allowAllStatus ? "all" : Array.from(statusSet),
    total: totalMatches,
    products: rows,
    bugs: includeDetails ? bugs : [],
  });
}
