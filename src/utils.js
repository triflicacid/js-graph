// ALPHA CHANNEL VALUE FOR DIMMED COLORS
export const HEX_ALPHA = "80";

/** Round N to the nearest multiple of M using the round function roundF (=Math.round) */
export const roundMultiple = (n, m, roundFn = Math.round) => roundFn(n / m) * m;

export const roundTowards0 = n => n < 0 ? Math.ceil(n) : Math.floor(n);
export const roundTowardsInf = n => n < 0 ? Math.floor(n) : Math.ceil(n);

/** Round number to <DP>=0 decimal places */
export const round = (n, dp = 0) => {
  const k = Math.pow(10, dp);
  return Math.round(n * k) / k;
};

/** Get mouse coordinates over an element from an event */
export function extractCoords(event) {
  const box = event.target.getBoundingClientRect();
  const coords = [event.clientX - box.left, event.clientY - box.top];
  return coords;
}

export const getTextMetrics = (ctx, text) => {
  const metrics = ctx.measureText(text);
  return {
    width: metrics.width,
    height: metrics.fontBoundingBoxDescent + metrics.fontBoundingBoxAscent,
  };
};

/** Are the coordinates over the element */
export function isMouseOver(element, x, y) {
  let bb = element.getBoundingClientRect();
  return x >= bb.left && x < bb.right && y >= bb.top && y < bb.bottom;
}

/** Linear interpolate between two bounds */
export const lerp = (min, max, dist) => min + (max - min) * dist;

export function clamp(n, min = -Infinity, max = Infinity) {
  if (n <= min) return min;
  if (n >= max) return max;
  return n;
}

/** Hide element */
export function hideEl(el) {
  el.setAttribute("hidden", "hidden");
}

/** Show element */
export function showEl(el) {
  el.removeAttribute("hidden");
}

/** Draw a circle */
export function circle(ctx, x, y, r, fillStyle = undefined) {
  ctx.beginPath();
  if (fillStyle) ctx.fillStyle = fillStyle;
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();
}

/** Plot a path */
export function plotPath(ctx, points) {
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; ++i) ctx.lineTo(...points[i]);
}

/** Create an HTML button */
export function createButton(innerHTML, title=undefined, onClick=undefined) {
  const btn = document.createElement('button');
  btn.innerHTML = innerHTML;
  if (title) btn.title = title;
  if (onClick) btn.addEventListener("click", onClick);
  return btn;
}

/** Lerp array of coordinates IN PLACE (mutates input array) */
export function lerpCoords(coords, dist) {
  coords.forEach(([b, a], i) => {
    coords[i][0] = lerp(b[0], a[0], dist);
    coords[i][1] = lerp(b[1], a[1], dist);
  });
  return coords;
}

/** Default: base e */
export function log(a, b = undefined) {
  if (b === undefined) return Math.log(a);
  else return Math.log(a) / Math.log(b);
}

/** arguments = [], [min] or [min, max] */
export function random(a = undefined, b = undefined) {
  if (a === undefined) return Math.random();
  if (b === undefined) return Math.random() * a;
  return a + Math.random() * (b - a);
}

export function rotateCoords(coords, theta) {
  const rotated = [];
  const S = Math.sin(theta), C = Math.cos(theta);
  for (const [x, y] of coords) {
    rotated.push([
      2 + x * S + y * C, // x*sin(theta) + y*cos(theta)
      3 + x * C - y * S  // x*cos(theta) - y*sin(theta) 
    ]);
  }
  return rotated;
}

/** Download the link <href> with name <fname> to client */
export function downloadLink(href, fname) {
  const a = document.createElement('a');
  a.href = href;
  a.setAttribute('download', fname);
  a.click();
  a.remove();
}

/** Download the given <text> in a file called <fname> */
export function downloadTextFile(text, fname) {
  let data = new Blob([text], { type: 'text/plain' });
  let url = window.URL.createObjectURL(data);
  downloadLink(url, fname);
}

export function factorial(n) {
  for (let k = n - 1; k > 1; k--) n *= k;
  return n;
}

export const inRange = (value, target, offset) => target - offset <= value && value <= target + offset;