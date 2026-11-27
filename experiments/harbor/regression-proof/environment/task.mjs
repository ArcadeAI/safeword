export function discount(price, percent) {
  return Math.floor(price * (100 - percent)) / 100;
}
