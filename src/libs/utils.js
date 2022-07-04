const radices = { x: 16, d: 10, b: 2, o: 8 };
const radicesRegex = { 16: /[0-9A-Fa-f]/, 10: /[0-9]/, 2: /[01]/, 8: /[0-7]/ };
export function parseNumber(string, opts = {}) {
  var _a, _b, _c;
  (_a = opts.exponent) !== null && _a !== void 0 ? _a : (opts.exponent = true);
  (_b = opts.decimal) !== null && _b !== void 0 ? _b : (opts.decimal = true);
  (_c = opts.signed) !== null && _c !== void 0 ? _c : (opts.signed = true);
  let pos = 0, sign = 1, strBeforeDot = '', strAfterDot = '', radix = 10, exp = null;
  let metSign = !opts.signed, metDigitBeforeDecimal = false, metDot = false, metDigitAfterDecimal = false, metE = false, metSeperator = false, metRadix = false, metImag = false;
  for (pos = 0; pos < string.length; pos++) {
    if (!metSign && (string[pos] === '-' || string[pos] === '+')) { // Sign
      metSign = true;
      sign = string[pos] === '-' ? -1 : 1;
      metSeperator = false;
    }
    else if (pos === 0 && string[pos] === '0' && string[pos + 1] in radices) { // Radix
      pos++;
      radix = radices[string[pos]];
    }
    else if (radicesRegex[radix].test(string[pos])) { // Digit
      metSeperator = false;
      if (!metSign)
        metSign = true; // Default to '+'
      if (metDot) {
        strAfterDot += string[pos];
        metDigitAfterDecimal = true;
      }
      else {
        strBeforeDot += string[pos];
        metDigitBeforeDecimal = true;
      }
    }
    else if (opts.decimal && string[pos] === '.') { // seperator
      if (metSeperator)
        throw new Error("Invalid syntax: expected digit in number literal");
      if (!metDot) {
        metDot = true;
      }
      else {
        break; // INVALID
      }
    }
    else if (string[pos].toLowerCase() === 'e') {
      if (metSeperator)
        throw new Error("Invalid syntax: expected digit in number literal");
      metSeperator = false;
      if (opts.exponent) {
        const newOpts = Object.assign({}, opts);
        newOpts.exponent = false;
        const obj = parseNumber(string.substr(pos + 1), newOpts);
        if (obj.str === '')
          break;
        pos += 1 + obj.pos;
        exp = obj;
        break;
      }
      else {
        break; // INVALID
      }
    }
    else if (opts.seperator && string[pos] === opts.seperator) {
      if (metSeperator) {
        throw new Error(`Invalid number literal: unexpected seperator`);
      }
      else {
        if (metDot && !metDigitAfterDecimal)
          break;
        if (!metDigitBeforeDecimal)
          break;
        metSeperator = true;
      }
    }
    else {
      break; // INVALID
    }
  }
  if (opts.imag && (strBeforeDot !== '' || strAfterDot !== '') && string[pos] === opts.imag) {
    pos++;
    metImag = true;
  }
  let str = strBeforeDot + (metDot ? '.' + strAfterDot : '');
  if (str === '.' || str.startsWith('.e')) {
    pos = 0;
    str = '';
  }
  let num = sign * base_to_float(str, radix), base = num, nexp = 1;
  if (exp) {
    num *= Math.pow(10, exp.num);
    str += 'e' + exp.str;
    nexp = exp.num;
  }
  return { pos, str: string.substring(0, pos), sign, base, exp: nexp, radix, num, imag: metImag };
}

/** Convert string in a given base to a number. May include a decimal point */
export function base_to_float(str, base) {
  let dec = 0;
  const di = str.indexOf(".");
  let k = str.length === 1 ? 1 : Math.pow(base, (di === -1 ? str.length : di) - 1), i = 0;
  while (i < str.length) {
    if (str[i] !== '.') {
      let code = str[i].charCodeAt(0);
      dec += (code - (code <= 57 ? 48 : 55)) * k;
      k /= base;
    }
    i++;
  }
  return dec;
}