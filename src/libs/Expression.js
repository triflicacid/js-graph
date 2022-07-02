import { Complex } from "./Complex.js";

const radices = { x: 16, d: 10, b: 2, o: 8 };
const radicesRegex = { 16: /[0-9A-Fa-f]/, 10: /[0-9]/, 2: /[01]/, 8: /[0-7]/ };
export function parseNumber(string, opts = {}) {
  opts.exponent ??= true;
  opts.decimal ??= true;
  opts.signed ??= true;

  let pos = 0, sign = 1, strBeforeDot = '', strAfterDot = '', radix = 10, exp = null;
  let metSign = !opts.signed, metDigitBeforeDecimal = false, metDot = false, metDigitAfterDecimal = false, metE = false, metSeperator = false, metRadix = false, metImag = false;

  for (pos = 0; pos < string.length; pos++) {
    if (!metSign && (string[pos] === '-' || string[pos] === '+')) { // Sign
      metSign = true;
      sign = string[pos] === '-' ? -1 : 1;
      metSeperator = false;
    } else if (pos === 0 && string[pos] === '0' && string[pos + 1] in radices) { // Radix
      pos++;
      radix = radices[string[pos]];
    } else if (radicesRegex[radix].test(string[pos])) { // Digit
      metSeperator = false;
      if (!metSign) metSign = true; // Default to '+'
      if (metDot) {
        strAfterDot += string[pos];
        metDigitAfterDecimal = true;
      } else {
        strBeforeDot += string[pos];
        metDigitBeforeDecimal = true;
      }
    } else if (opts.decimal && string[pos] === '.') { // seperator
      if (metSeperator) throw new Error("Invalid syntax: expected digit in number literal");
      if (!metDot) {
        metDot = true;
      } else {
        break; // INVALID
      }
    } else if (string[pos].toLowerCase() === 'e') {
      if (metSeperator) throw new Error("Invalid syntax: expected digit in number literal");
      metSeperator = false;
      if (opts.exponent) {
        const newOpts = { ...opts };
        newOpts.exponent = false;
        const obj = parseNumber(string.substr(pos + 1), newOpts);
        if (obj.str === '') break;
        pos += 1 + obj.pos;
        exp = obj;
        break;
      } else {
        break; // INVALID
      }
    } else if (opts.seperator && string[pos] === opts.seperator) {
      if (metSeperator) {
        throw new Error(`Invalid number literal: unexpected seperator`);
      } else {
        if (metDot && !metDigitAfterDecimal) break;
        if (!metDigitBeforeDecimal) break;
        metSeperator = true;
      }
    } else {
      break; // INVALID
    }
  }

  if (opts.imag && (strBeforeDot !== '' || strAfterDot !== '') && string[pos] === opts.imag) {
    pos++;
    metImag = true;
  }

  if (strBeforeDot !== '') strBeforeDot = parseInt(strBeforeDot, radix).toString();
  if (strAfterDot !== '') strAfterDot = parseInt(strAfterDot, radix).toString();
  let str = strBeforeDot + (metDot ? '.' + strAfterDot : '');
  if (str === '.' || str.startsWith('.e')) {
    pos = 0;
    str = '';
  }

  let num = sign * +str, base = num, nexp = 1;
  if (exp) {
    num *= Math.pow(10, exp.num);
    str += 'e' + exp.str;
    nexp = exp.num;
  }
  return { pos, str: string.substring(0, pos), sign, base, exp: nexp, radix, num, imag: metImag };
}

export const OPERATORS_DEFAULT = {
  "**": Math.pow,
  "!": (a) => +!a,
  "/": (a, b) => a / b,
  "%": (a, b) => a % b,
  "*": (a, b) => a * b,
  "+": (a, b) => a + b,
  "u+": (a) => +a,
  "-": (a, b) => a - b,
  "u-": (a) => -a,
};

export const OPERATORS_IMAG = {
  "**": Complex.pow,
  "!": a => new Complex(+!a.isTruthy()),
  "/": Complex.div,
  "%": Complex.modulo,
  "*": Complex.mult,
  "+": Complex.add,
  "-": Complex.sub,
  "u+": (z) => z,
  "u-": (z) => Complex.mult(z, -1),
};

function getPrecedence(token) {
  if (token.type === TOKEN_OP) return (token).prec;
  return 0;
}

const TOKEN_OP = 1;
const TOKEN_NUM = 2;
const TOKEN_SYM = 4;
const LABELREGEX = /^[A-Za-z][A-Za-z0-9_\$]*$/;

/** Creates an expression, which may be parsed and executed.
 * Expression.numberOpts allows customision on numerical parsing.
 *   NOTE if numberOpts.imag is truthy, please pass OPERATORS_IMAG to parse
*/
export class Expression {
  constructor(expr = '') {
    this._raw = expr;
    this._tokens = [];
    this._symbols = new Map();
    this.numberOpts = {};
  }

  reset() {
    this._tokens.length = 0;
    this._symbols.clear();
    return this;
  }

  load(expr) {
    this._tokens.length = 0;
    this._raw = expr;
    return this;
  }

  setSymbol(name, value) {
    this._symbols.set(name, value);
    return value;
  }

  hasSymbol(name) {
    return this._symbols.has(name);
  }

  getSymbol(name) {
    return this._symbols.get(name);
  }

  setSymbolMap(map) {
    this._symbols = map;
  }

  /** Parse raw to token array */
  parse(operators = undefined) {
    if (operators === undefined) operators = OPERATORS_DEFAULT;
    this._tokens.length = 0;
    for (let i = 0; i < this._raw.length;) {
      let token = undefined;

      if (/\s/.test(this._raw[i])) {
        i += this._raw[i].length;
        continue;
      } else if (this._raw[i] === '*' && this._raw[i + 1] === '*') {
        token = { type: TOKEN_OP, value: '**', unary: false, action: operators["**"], assoc: 'rtl', prec: 16 };
        i += 2;
      } else if (this._raw[i] === '!') {
        token = { type: TOKEN_OP, value: '!', unary: true, action: operators["!"], assoc: 'rtl', prec: 17 };
        i += 1;
      } else if (this._raw[i] === '/') {
        token = { type: TOKEN_OP, value: '/', unary: false, action: operators["/"], assoc: 'ltr', prec: 15 };
        i += 1;
      } else if (this._raw[i] === '%') {
        token = { type: TOKEN_OP, value: '%', unary: false, action: operators["%"], assoc: 'ltr', prec: 15 };
        i += 1;
      } else if (this._raw[i] === '*') {
        token = { type: TOKEN_OP, value: '*', unary: false, action: operators["*"], assoc: 'ltr', prec: 15 };
        i += 1;
      } else if (this._raw[i] === '+') {
        token = { type: TOKEN_OP, value: '+', unary: false, action: operators["+"], assoc: 'ltr', prec: 14 };
        i += 1;
      } else if (this._raw[i] === '-') {
        token = { type: TOKEN_OP, value: '-', unary: false, action: operators["-"], assoc: 'ltr', prec: 14 };
        i += 1;
      } else if (this._raw[i] === '=') {
        token = { type: TOKEN_OP, value: '=', unary: false, action: (a, b) => this.setSymbol(a, b), assoc: 'rtl', prec: 3 };
        i += 1;
      } else if (this._raw[i] === ',') {
        token = { type: TOKEN_OP, value: ',', unary: false, action: (a, b) => b, assoc: 'ltr', prec: 1 };
        i += 1;
      } else if (this._raw[i] === '(' || this._raw[i] === ')') {
        token = { type: TOKEN_OP, value: this._raw[i] };
        i += 1;
      } else {
        let str = this._raw.substring(i), cp = str.indexOf(')');
        if (cp > -1) str = str.substring(0, cp);
        let nextSpace = str.indexOf(' ');
        let symbol = nextSpace === -1 ? str : str.substring(0, nextSpace);
        if (this.hasSymbol(symbol) || LABELREGEX.test(symbol)) {
          token = { type: TOKEN_SYM, value: symbol };
          i += symbol.length;
        } else {
          let nobj = parseNumber(this._raw.substring(i), this.numberOpts);
          if (nobj.str.length !== 0) {
            token = { type: TOKEN_NUM, value: nobj.imag ? new Complex(0, nobj.num) : nobj.num };
            i += nobj.str.length;
          }
        }
      }

      if (token) {
        this._tokens.push(token);
      } else {
        return { error: true, msg: `Syntax Error: unknown token '${this._raw[i]}' at position ${i}`, pos: i };
      }
    }

    // Unary operators
    for (let i = 0; i < this._tokens.length; i++) {
      if (this._tokens[i]?.type === TOKEN_OP) {
        const OP = this._tokens[i];
        if (!OP.unary) {
          const top = this._tokens[i - 1];
          if (top === undefined || (top.type === TOKEN_OP && top.value !== ')')) {
            if (OP.value === '-') {
              OP.unary = true;
              OP.action = operators['u-'];
              OP.assoc = 'rtl';
              OP.prec = 17;
            } else if (OP.value === '+') {
              OP.unary = true;
              OP.action = operators['u+'];
              OP.assoc = 'rtl';
              OP.prec = 17;
            }
          }
        }
      }
    }
    return { error: false };
  }

  /** Evaluate parsed string. */
  evaluate() {
    // TO RPN
    const stack = [], tokens = [];
    for (let i = 0; i < this._tokens.length; ++i) {
      const token = this._tokens[i];
      if (token.type === TOKEN_OP) {
        const OP = token;
        if (OP.value === '(') {
          stack.push(token);
        } else if (OP.value === ')') {
          while (stack.length > 0 && !(stack[stack.length - 1].type === TOKEN_OP && stack[stack.length - 1].value === '(')) {
            tokens.push(stack.pop());
          }
          stack.pop(); // Remove ) from stack
        } else {
          if (OP.assoc === 'ltr') {
            while (stack.length !== 0 && getPrecedence(this._tokens[i]) <= getPrecedence(this._tokens[this._tokens.length - 1])) tokens.push(stack.pop());
          } else {
            while (stack.length !== 0 && getPrecedence(this._tokens[i]) < getPrecedence(this._tokens[this._tokens.length - 1])) tokens.push(stack.pop());
          }
          stack.push(OP);
        }
      } else {
        tokens.push(token);
      }
    }
    while (stack.length !== 0) tokens.push(stack.pop()); // DUMP

    // EVALUATE
    stack.length = 0;
    for (let i = 0; i < tokens.length; ++i) {
      const T = tokens[i];
      if (T.type === TOKEN_NUM) stack.push(T);
      else if (T.type === TOKEN_SYM) stack.push(T);
      else if (T.type === TOKEN_OP) {
        const OP = T;
        if (OP.unary ? stack.length < 1 : stack.length < 2) return { error: 1, token: T, msg: `Stack underflow whilst executing operator ${OP.value}` };
        let result;
        let aT = stack.pop(), a;
        if (aT.type === TOKEN_NUM) a = aT.value;
        else if (aT.type === TOKEN_SYM) {
          if (!this.hasSymbol(aT.value)) return { error: 1, token: aT, msg: `Unbound symbol referenced '${aT.value}' in operator ${OP.value}` };
          a = this.getSymbol(aT.value);
        } else return { error: 1, token: aT, msg: `Invalid token type in operator ${OP.value}` };
        if (OP.unary) {
          result = OP.action(a);
        } else {
          let bT = stack.pop(), b;
          if (bT.type === TOKEN_NUM) b = bT.value;
          else if (bT.type === TOKEN_SYM) {
            if (OP.value === '=') {
              b = bT.value;
            } else {
              if (!this.hasSymbol(bT.value)) return { error: 1, token: bT, msg: `Unbound symbol referenced '${bT.value}' in operator ${OP.value}` };
              b = this.getSymbol(bT.value);
            }
          } else return { error: 1, token: bT, msg: `Invalid token type in operator ${OP.value}` };
          result = OP.action(b, a);
        }
        stack.push({ type: TOKEN_NUM, value: result });
      }
    }

    if (stack.length !== 1) return { error: 1, token: null, msg: `Expected one item to be in result stack, got ${stack.length}`, stack, };
    let value;
    if (stack[0].type === TOKEN_NUM) value = stack[0].value;
    else if (stack[0].type === TOKEN_SYM) {
      if (!this.hasSymbol(stack[0].value)) return { error: 1, token: stack[0], msg: `Unbound symbol referenced '${stack[0].value}'` };
      value = this.getSymbol(stack[0].value);
    } else {
      return { error: 1 };
    }
    return { error: 0, value };
  }
} 