export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === "textContent") node.textContent = value;
    else if (key === "className") node.className = value;
    else if (key === "dataset") {
      for (const [name, dataValue] of Object.entries(value)) node.dataset[name] = dataValue;
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (typeof value === "boolean") {
      if (value) node.setAttribute(key, "");
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function formatPrice(priceCents) {
  if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
    throw new TypeError("Price must be a non-negative whole number of cents");
  }
  const naira = priceCents / 100;
  return `₦${naira.toLocaleString("en-NG", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`;
}
