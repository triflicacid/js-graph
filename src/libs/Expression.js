import { Complex } from "./Complex.js";
import { parseNumber } from "./utils.js";
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
  "==": (a, b) => +(a === b),
  "!=": (a, b) => +(a !== b),
  ">": (a, b) => +(a > b),
  ">=": (a, b) => +(a >= b),
  "<": (a, b) => +(a < b),
  "<=": (a, b) => +(a <= b),
};
export const OPERATORS_IMAG = {
  "**": Complex.pow,
  "!": (a) => new Complex(+!a.isTruthy()),
  "/": Complex.div,
  "%": Complex.modulo,
  "*": Complex.mult,
  "+": Complex.add,
  "-": Complex.sub,
  "u+": (z) => z,
  "u-": (z) => Complex.mult(z, -1),
  "==": (a, b) => new Complex(+Complex.eq(a, b)),
  "!=": (a, b) => new Complex(+!Complex.eq(a, b)),
  ">": (a, b) => new Complex(+Complex.gt(a, b)),
  ">=": (a, b) => new Complex(+Complex.ge(a, b)),
  "<": (a, b) => new Complex(+Complex.lt(a, b)),
  "<=": (a, b) => new Complex(+Complex.le(a, b)),
};
/** Given an operator, return its numerical precedence */
function getPrecedence(token) {
  if (token.type === TOKEN_OP)
    return token.prec;
  return 0;
}
/** Parse string expression to array of tokens */
function parseExpression(expr, operators, numberOpts) {
  let o = tokenifyExpression(expr, operators, numberOpts);
  if (o.error)
    return o;
  o = parseTokenCallOpts(o.tokens, operators, numberOpts);
  return o;
}
/** Given string expression, return array of tokens */
function tokenifyExpression(expr, operators, numberOpts) {
  var _a;
  const tokens = [];
  for (let i = 0; i < expr.length;) {
    let token = undefined;
    if (/\s/.test(expr[i])) {
      i += expr[i].length;
      continue;
    }
    else if (expr[i] === '*' && expr[i + 1] === '*') {
      token = { type: TOKEN_OP, value: '**', args: 2, action: operators["**"], assoc: 'rtl', prec: 16 };
      i += 2;
    }
    else if (expr[i] === '=' && expr[i + 1] === '=') {
      token = { type: TOKEN_OP, value: '==', args: 2, action: operators["=="], assoc: 'ltr', prec: 9 };
      i += 2;
    }
    else if (expr[i] === '!' && expr[i + 1] === '=') {
      token = { type: TOKEN_OP, value: '!=', args: 2, action: operators["!="], assoc: 'ltr', prec: 9 };
      i += 2;
    }
    else if (expr[i] === '<' && expr[i + 1] === '=') {
      token = { type: TOKEN_OP, value: '<=', args: 2, action: operators["<="], assoc: 'ltr', prec: 10 };
      i += 2;
    }
    else if (expr[i] === '>' && expr[i + 1] === '=') {
      token = { type: TOKEN_OP, value: '>=', args: 2, action: operators[">="], assoc: 'ltr', prec: 10 };
      i += 2;
    }
    else if (expr[i] === '!') {
      token = { type: TOKEN_OP, value: '!', args: 1, action: operators["!"], assoc: 'rtl', prec: 17 };
      i += 1;
    }
    else if (expr[i] === '>') {
      token = { type: TOKEN_OP, value: '>', args: 2, action: operators[">"], assoc: 'ltr', prec: 10 };
      i += 1;
    }
    else if (expr[i] === '<') {
      token = { type: TOKEN_OP, value: '<', args: 2, action: operators["<"], assoc: 'ltr', prec: 10 };
      i += 1;
    }
    else if (expr[i] === '/') {
      token = { type: TOKEN_OP, value: '/', args: 2, action: operators["/"], assoc: 'ltr', prec: 15 };
      i += 1;
    }
    else if (expr[i] === '%') {
      token = { type: TOKEN_OP, value: '%', args: 2, action: operators["%"], assoc: 'ltr', prec: 15 };
      i += 1;
    }
    else if (expr[i] === '*') {
      token = { type: TOKEN_OP, value: '*', args: 2, action: operators["*"], assoc: 'ltr', prec: 15 };
      i += 1;
    }
    else if (expr[i] === '+') {
      token = { type: TOKEN_OP, value: '+', args: 2, action: operators["+"], assoc: 'ltr', prec: 14 };
      i += 1;
    }
    else if (expr[i] === '-') {
      token = { type: TOKEN_OP, value: '-', args: 2, action: operators["-"], assoc: 'ltr', prec: 14 };
      i += 1;
    }
    else if (expr[i] === '=') {
      token = {
        type: TOKEN_OP, value: '=', args: 2, action: (a, b, symbols) => (symbols.set(a, b), b), assoc: 'rtl', prec: 3
      };
      i += 1;
    }
    else if (expr[i] === ',') {
      token = { type: TOKEN_OP, value: ',', args: 2, action: (a, b) => b, assoc: 'ltr', prec: 1 };
      i += 1;
    }
    else if (expr[i] === '(' || expr[i] === ')') {
      token = { type: TOKEN_OP, value: expr[i] };
      i += 1;
    }
    else {
      if (/[A-Za-z_$]/.test(expr[i])) {
        let symbol = expr[i++];
        while (expr[i] && /[A-Za-z$_0-9]/.test(expr[i])) {
          symbol += expr[i++];
        }
        token = { type: TOKEN_SYM, value: symbol };
      }
      else {
        let nobj = parseNumber(expr.substring(i), numberOpts);
        if (nobj.str.length !== 0) {
          token = { type: TOKEN_NUM, value: nobj.imag ? new Complex(0, nobj.num) : nobj.num };
          i += nobj.str.length;
        }
      }
    }
    if (token) {
      tokens.push(token);
    }
    else {
      tokens.length = 0;
      return { error: true, pos: i, msg: `Unknown token '${expr[i]}' at position ${i}` };
    }
  }
  // Unary operators
  for (let i = 0; i < tokens.length; i++) {
    if (((_a = tokens[i]) === null || _a === void 0 ? void 0 : _a.type) === TOKEN_OP) {
      const OP = tokens[i];
      if (OP.args > 1) { // Not unary, make unary?
        const top = tokens[i - 1];
        if (top === undefined || (top.type === TOKEN_OP && top.value !== ')')) {
          if (OP.value === '-') {
            OP.args = 1;
            OP.action = operators['u-'];
            OP.assoc = 'rtl';
            OP.prec = 17;
          }
          else if (OP.value === '+') {
            OP.args = 1;
            OP.action = operators['u+'];
            OP.assoc = 'rtl';
            OP.prec = 17;
          }
        }
      }
    }
  }
  return { error: false, tokens };
}
/** Given an array of tokens, identify and extract call operators */
function parseTokenCallOpts(tokens, operators, numberOpts) {
  // Call operator: <symbol>(...)
  for (let i = 0; i < tokens.length - 1;) {
    if (tokens[i].type === TOKEN_SYM && tokens[i + 1].type === TOKEN_OP && tokens[i + 1].value === '(') {
      let j = i;
      i += 2;
      let contents = [], open = 1;
      while (tokens[i]) {
        if (tokens[i].type === TOKEN_OP) {
          if (tokens[i].value === '(') {
            ++open;
          }
          else if (tokens[i].value === ')') {
            --open;
            if (open === 0)
              break;
          }
        }
        contents.push(tokens[i++]);
      }
      if (open > 0)
        return { error: true, pos: i, msg: `Unclosed parenthesis (expected ${open} * ')' at position ${i})` };
      let args = [[]];
      let o = parseTokenCallOpts(contents, operators, numberOpts);
      if (o.error)
        return o;
      o.tokens.forEach(T => {
        if (T.type === TOKEN_OP && T.value === ',')
          args.push([]);
        else
          args[args.length - 1].push(T);
      });
      args = args.filter(ar => ar.length > 0).map(ar => expressionToRPN(ar));
      let call = (f, symbols) => {
        const argValues = [];
        for (let arg of args) {
          let o = evaluateExpression(arg, symbols, numberOpts);
          if (o.error)
            return o;
          argValues.push(o.value);
        }
        let x = f(...argValues, symbols);
        if (typeof x === 'number')
          return numberOpts.imag ? new Complex(x) : x;
        else if (x == undefined)
          return numberOpts.imag ? new Complex(0) : 0;
        else
          return x;
      };
      let op = { type: TOKEN_OP, value: '()', args: 1, assoc: 'ltr', prec: 20, action: call };
      tokens.splice(j + 1, contents.length + 2, op);
      ++i;
    }
    else {
      ++i;
    }
  }
  return { error: false, tokens };
}
/** Given array of tokens, make tokens to RPN form */
function expressionToRPN(original) {
  const stack = [], tokens = [];
  for (let i = 0; i < original.length; ++i) {
    const token = original[i];
    if (token.type === TOKEN_OP) {
      const OP = token;
      if (OP.value === '(') {
        stack.push(token);
      }
      else if (OP.value === ')') {
        while (stack.length > 0 && !(stack[stack.length - 1].type === TOKEN_OP && stack[stack.length - 1].value === '(')) {
          tokens.push(stack.pop());
        }
        stack.pop(); // Remove ) from stack
      }
      else {
        if (OP.assoc === 'ltr') {
          while (stack.length !== 0 && getPrecedence(original[i]) <= getPrecedence(stack[stack.length - 1]))
            tokens.push(stack.pop());
        }
        else {
          while (stack.length !== 0 && getPrecedence(original[i]) < getPrecedence(stack[stack.length - 1]))
            tokens.push(stack.pop());
        }
        stack.push(OP);
      }
    }
    else {
      tokens.push(token);
    }
  }
  while (stack.length !== 0)
    tokens.push(stack.pop()); // DUMP
  return tokens;
}
/** Parse an array of tokens to a numerical result */
function evaluateExpression(tokens, symbols, numberOpts) {
  if (tokens.length === 0)
    return { error: true, msg: `Empty expression` };
  // EVALUATE
  const stack = [];
  for (let i = 0; i < tokens.length; ++i) {
    const T = tokens[i];
    if (T.type === TOKEN_NUM)
      stack.push(T);
    else if (T.type === TOKEN_SYM)
      stack.push(T);
    else if (T.type === TOKEN_OP) {
      const OP = T;
      if (OP.value === '(' || OP.value === ')')
        return { error: true, token: T, msg: `Unbalanced parenthesis '${OP.value}' at position ${i}`, pos: i };
      if (OP.args === undefined)
        return { error: true, token: T, msg: `Unexpected operator '${OP.value}' at position ${i}`, pos: i };
      if (stack.length < OP.args)
        return { error: true, token: T, msg: `Stack underflow whilst executing operator ${OP.value} (expects ${OP.args} args, got ${stack.length})` };
      let argTokens = stack.splice(stack.length - OP.args), args = [];
      for (let j = 0; j < argTokens.length; ++j) {
        let T = argTokens[j];
        if (T.type === TOKEN_NUM) {
          args.push(T.value); // Push numeric constant
        }
        else if (T.type === TOKEN_SYM) {
          if (j === 0 && OP.value === '=')
            args.push(T.value); // Push the symbol itself
          else if (T.value === numberOpts.imag)
            args.push(Complex.I); // Imaginary unit
          else if (!symbols.has(T.value))
            return { error: true, token: T, msg: `Unbound symbol referenced '${T.value}' in operator ${OP.value}` };
          else
            args.push(symbols.get(T.value)); // Fetch symbol's value
        }
        else {
          return { error: true, token: T, msg: `Invalid token type in operator ${OP.value}` };
        }
      }
      if (numberOpts.imag)
        args = args.map(z => typeof z === 'number' ? new Complex(z) : z); // Ensure all data values are Complex
      let o = OP.action(...args, symbols);
      if (typeof o === 'object' && o.error)
        return o;
      stack.push({ type: TOKEN_NUM, value: typeof o === 'object' && o.value ? o.value : o });
    }
  }
  if (stack.length !== 1)
    return { error: true, token: null, msg: `Expected one item to be in result stack, got ${stack.length}`, stack, };
  let value;
  if (stack[0].type === TOKEN_NUM)
    value = stack[0].value;
  else if (stack[0].type === TOKEN_SYM) {
    if (stack[0].value === numberOpts.imag)
      value = Complex.I;
    else if (!symbols.has(stack[0].value))
      return { error: 1, token: stack[0], msg: `Unbound symbol referenced '${stack[0].value}'` };
    else
      value = symbols.get(stack[0].value);
  }
  else {
    return { error: true };
  }
  if (typeof value === 'number' && numberOpts.imag)
    value = Complex.parse(value);
  return { error: false, value };
}
const TOKEN_OP = 1;
const TOKEN_NUM = 2;
const TOKEN_SYM = 4;
/** Creates an expression, which may be parsed and executed.
 * Expression.numberOpts allows customision on numerical parsing.
 *   NOTE if numberOpts.imag is truthy, please pass OPERATORS_IMAG to parse
*/
export class Expression {
  constructor(expr = '') {
    this._symbols = new Map();
    this._raw = expr;
    this._tokens = [];
    this.numberOpts = {};
  }
  /** Reset symbol map and expression data */
  reset() {
    this._tokens.length = 0;
    this._symbols.clear();
    return this;
  }
  /** Load new raw expression string */
  load(expr) {
    this._tokens.length = 0;
    this._raw = expr;
    return this;
  }
  /** Get original expression string */
  getOriginal() {
    return this._raw;
  }
  setSymbol(name, value) {
    this._symbols.set(name, value);
    return this;
  }
  hasSymbol(name) {
    return this._symbols.has(name);
  }
  getSymbol(name) {
    return this._symbols.get(name);
  }
  delSymbol(name) {
    return this._symbols.delete(name);
  }
  setSymbolMap(map) {
    this._symbols = map;
  }
  /** Parse raw to token array */
  parse(operators) {
    if (operators === undefined)
      operators = OPERATORS_DEFAULT;
    this._tokens.length = 0;
    const o = parseExpression(this._raw, operators, this.numberOpts);
    if (o.tokens) {
      this._tokens = o.tokens;
      const tokens = expressionToRPN(this._tokens);
      this._tokens = tokens;
      o.tokens = tokens;
    }
    return o;
  }
  /** Evaluate parsed string. */
  evaluate() {
    return evaluateExpression(this._tokens, this._symbols, this.numberOpts);
  }
  /** Return new Expression, copying symbolMap */
  copy(expr = undefined) {
    let E = new Expression(expr);
    // this._symbols.forEach((v, k) => E._symbols.set(k, v));
    E._symbols = this._symbols;
    return E;
  }
}