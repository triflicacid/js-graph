/** Utility functions used by Graph.js */

import { inRange, lerp } from "./utils.js";

/** Calculate coordinates of change of gradient (differentiation) */
export function calcGradient(coords) {
  let pts = [];
  for (let i = 1; i < coords.length; ++i) {
    let [x1, y1] = coords[i - 1], [x2, y2] = coords[i];
    pts.push([x1, (y2 - y1) / (x2 - x1)]);
  }
  return pts;
}

/** Calculate original coordinates from change of gradient (integration) (with C=<C>) */
export function calcCoordsFromGradient(coords, C = 0) {
  coords = [...coords];
  let splits = [], last = coords[0][0];
  for (let i = 1, n = 1; i < coords.length; i++, n++) {
    let next = coords[i][0];
    if (Math.sign(last) !== Math.sign(next)) {
      splits.push(n);
      n = 0;
      break;
    }
  }

  let arrays = [];
  splits.forEach(split => arrays.push(coords.splice(0, split)));
  arrays.push(coords);

  let points = [];
  arrays.forEach(array => {
    let pts = [[0, C]];
    if (Math.sign(array[0][0]) === -1) {
      for (let i = array.length - 1, j = 0; i >= 0; --i, ++j) {
        let [x2, m] = array[i], [x1, y1] = pts[j];
        let y2 = m * (x2 - x1) + y1;
        pts.push([x2, y2]);
      }
      pts.reverse();
    } else {
      for (let i = 0; i < array.length; ++i) {
        let [x2, m] = array[i], [x1, y1] = pts[i];
        let y2 = m * (x2 - x1) + y1;
        pts.push([x2, y2]);
      }
    }
    points.push(...pts);
  });
  return points;
}

/** From array of coordinates, extract those which have a change of sign in <I>th index */
export function extractChangeOfSign(coords, index, dp = undefined) {
  let last = coords[0], arr = [];
  if (dp !== undefined) coords.forEach((_, i) => {
    coords[i][0] = +coords[i][0].toFixed(dp);
    coords[i][1] = +coords[i][1].toFixed(dp);
  });
  for (let i = 1; i < coords.length; ++i) {
    const curr = coords[i];
    if (Math.sign(last[index]) !== Math.sign(curr[index])) arr.push([last, curr]);
    last = curr;
  }
  return arr;
}

/** Get x-coordinates of assymptotes */
export function getAsymptotes(coords, ΔnMin, axis = 'x') {
  const IDX = axis === 'x' ? 0 : 1, OIDX = IDX ? 0 : 1;
  let asy = [], inAsy = false, asyN;
  for (let i = 1; i < coords.length; i++) {
    let Δn = Math.abs(coords[i - 1][OIDX] - coords[i][OIDX]);
    if (Δn >= ΔnMin) {
      inAsy = true;
      asyN = coords[i - 1][IDX];
    } else {
      if (inAsy) {
        let n = lerp(asyN, coords[i][IDX], 0.5);
        asy.push(n);
        inAsy = false;
      }
    }
  }
  return asy;
}

/** Get approx. coordinates where one part if specifid (if many is truthy, return array of coordinates) */
export function getCorrespondingCoordinate(coord, axis, coords, many = false, dp = undefined, removeDuplicate = true) {
  const IDX = axis === 'x' ? 0 : 1;
  let region = many ? [] : undefined, last = coords[0];
  if (dp !== undefined) coords.forEach((_, i) => {
    coords[i][0] = +coords[i][0].toFixed(dp);
    coords[i][1] = +coords[i][1].toFixed(dp);
  });
  for (let i = 1; i < coords.length; ++i) {
    let next = coords[i];
    if (coord === next[IDX]) {
      if (many) region.push(next);
      else { region = next; break; }
    } else if (coord === last[IDX]) {
      if (many) region.push(last);
      else { region = last; break; }
    } else if ((coord >= last[IDX] && coord <= next[IDX]) || (coord >= next[IDX] && coord <= last[IDX])) {
      if (many) {
        region.push([
          lerp(next[0], last[0], 0.5),
          lerp(next[1], last[1], 0.5)
        ]);
      } else {
        region = [
          lerp(next[0], last[0], 0.5),
          lerp(next[1], last[1], 0.5)
        ];
        break;
      }
    }
    last = next;
  }
  if (removeDuplicate && many && region.length > 1) { // Remove coords that are really close to eachother (on opposite axis)
    const oIDX = IDX ? 0 : 1, step = coords[1][oIDX] - coords[0][oIDX];
    removeCloseCoords(region, step, IDX ? 'x' : 'y');
  }
  return region;
}

/** Remove successive coords which are <d_min> from each other (mutates input array) */
export function removeCloseCoords(coords, d_min, axis) {
  const idx = axis === 'x' ? 0 : 1;
  let last = coords[0], next;
  for (let i = 1; i < coords.length;) {
    next = coords[i];
    if (Math.abs(next[idx] - last[idx]) <= d_min) {
      coords.splice(i, 1);
    } else {
      ++i;
    }
    last = next;
  }
}

export function getCorrepondingCoordinateIndex(coord, axis, coords, many = false, dp = undefined) {
  const IDX = axis === 'x' ? 0 : 1;
  let region = many ? [] : undefined, last = coords[0];
  if (dp !== undefined) coords.forEach((_, i) => {
    coords[i][0] = +coords[i][0].toFixed(dp);
    coords[i][1] = +coords[i][1].toFixed(dp);
  });
  if (coord === last[IDX]) return 0;
  for (let i = 1; i < coords.length; ++i) {
    let next = coords[i];
    if (coord === next[IDX]) {
      if (many) region.push(i);
      else { region = i; break; }
    } else if ((coord >= last[IDX] && coord <= next[IDX]) || (coord >= next[IDX] && coord <= last[IDX])) {
      let dl = Math.abs(coord - last[IDX]); // Difference: value and last
      let dn = Math.abs(coord - next[IDX]); // Difference: value and next
      let j = dl < dn ? i - 1 : i; // Find smallest difference
      if (many) {
        region.push(j);
      } else {
        region = j;
        break;
      }
    }
    last = next;
  }
  return region;
}

/** From two arrays, return array of intercepts */
export function getIntercepts(coords1, coords2, dp = undefined) {
  let arr = [];
  if (dp !== undefined) {
    coords1.forEach((_, i) => {
      coords1[i][0] = +coords1[i][0].toFixed(dp);
      coords1[i][1] = +coords1[i][1].toFixed(dp);
    });
    coords2.forEach((_, i) => {
      coords2[i][0] = +coords2[i][0].toFixed(dp);
      coords2[i][1] = +coords2[i][1].toFixed(dp);
    });
  }
  const diff = Math.max(Math.abs(coords1[1][0] - coords1[0][0]), Math.abs(coords2[1][0] - coords2[0][0])) * 2;
  for (let i = 0; i < coords1.length; ++i) {
    const curr1 = coords1[i];
    for (let j = 0; j < coords2.length; ++j) {
      const curr2 = coords2[j];
      if (Math.abs(curr2[0] - curr1[0]) <= diff && Math.abs(curr2[1] - curr1[1]) <= diff)
        arr.push([lerp(curr2[0], curr1[0], 0.5), lerp(curr2[1], curr1[1], 0.5)]);
    }
  }
  removeCloseCoords(arr, Math.abs(coords1[1][0] - coords1[0][0]) * 2, 'x');
  removeCloseCoords(arr, Math.abs(coords1[1][1] - coords1[0][1]) * 2, 'y');
  return arr;
}

/** Return coefficients of x^0, x^1, ..., x^n for Taylor approximation given coordinates */
export function taylorApprox(coords, n, around = 0) {
  let denom = 1; // Denominator of fractions
  const i0 = getCorrepondingCoordinateIndex(around, 'x', coords, false);
  const before = [], after = []; // Coordinates before/after (0,y) at i0
  for (let a = 1; a <= n * 2; a++) {
    before.unshift(coords[i0 - a]);
    after.push(coords[i0 + a]);
  }
  let ncoords = [...before, coords[i0], ...after].filter(x => x);
  const coeffs = [coords[i0][1]];
  for (let a = 0; a < n; a++) {
    denom *= a + 1;
    ncoords = calcGradient(ncoords);
    const coord = getCorrespondingCoordinate(around, 'x', ncoords, false);
    const y = coord == undefined ? around : coord[1];
    coeffs.push(1 / denom * y);
  }
  return coeffs;
}

/** Check for change in gradient around point coords[i]. Return UNDEFINED or BOOLEAN */
export const checkForInflection = (coords, i) => coords[i - 1] === undefined || coords[i + 1] === undefined ? undefined : Math.sign(coords[i][1] - coords[i - 1][1]) === Math.sign(coords[i][1] - coords[i + 1][1]);

export function getMaxPoints(coords) {
  let maxY = -Infinity;
  let points = [];
  let D = 0.00001;
  for (let i = 0; i < coords.length; i++) {
    if (coords[i][1] > maxY && !inRange(coords[i][1], maxY, D) && checkForInflection(coords, i)) {
      maxY = coords[i][1];
      points.length = 0;
      points.push(coords[i]);
    } else if (inRange(coords[i][1], maxY, D) && checkForInflection(coords, i) && (points.length < 1 || !inRange(coords[i][0], points[points.length - 1][0], D))) {
      points.push(coords[i]);
    }
  }
  return points;
}

export function getMinPoints(coords) {
  let minY = Infinity;
  let points = [];
  let D = 0.00001;
  for (let i = 0; i < coords.length; ++i) {
    if (coords[i][1] < minY && !inRange(coords[i][1], minY, D) && checkForInflection(coords, i)) {
      minY = coords[i][1];
      points.length = 0;
      points.push(coords[i]);
    } else if (inRange(coords[i][1], minY, D) && checkForInflection(coords, i) && (points.length < 1 || !inRange(coords[i][0], points[points.length - 1][0], D))) {
      points.push(coords[i]);
    }
  }
  return points;
}

/** Create AudioContext from array of coords. Return { AudioContext, AudioBufferSourceNode } */
export function getAudioFromCoords(coords, durationMult = 1, mult = 1) {
  const audioContext = new AudioContext();

  const buff = audioContext.createBuffer(1, coords.length * durationMult, audioContext.sampleRate);
  const nowBuff = buff.getChannelData(0);
  for (let i = 0, o = 0; i < coords.length; ++i, o += durationMult) {
    const val = coords[i][1] * mult; // In range [-1.0, 1.0]
    for (let j = 0; j < durationMult; j++) nowBuff[o + j] = val;
  }
  const source = audioContext.createBufferSource();
  source.buffer = buff;
  source.connect(audioContext.destination);

  let gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);
  source.connect(gainNode);
  gainNode.gain.exponentialRampToValueAtTime(1, 0);

  return { audioContext, source, gainNode };
}