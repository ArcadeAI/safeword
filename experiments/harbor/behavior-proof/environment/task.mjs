export function checkout(total, stock, paid) {
  return paid ? "confirmed" : "payment-required";
}
