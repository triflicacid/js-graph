import { Complex } from "./Complex.js";
import { parseNumber } from "./utils.js";
//#endregion
//#region OPERATORS
/** Default operators */
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
/** OPERATORS_DEFAULT overloaded to handle Complex numbers */
export const OPERATORS_IMAG = {
  "**": Complex.pow,
  "!": (a) => new Complex(+!a.isTruthy()),
  "/": Complex.div,
  "%": Complex.modulo,
  "*": Complex.mult,
  "+": Complex.add,
  "-": Complex.sub,
  "u+": (z) => z,
  "u-": (z) => z.neg(),
  "==": (a, b) => new Complex(+Complex.eq(a, b)),
  "!=": (a, b) => new Complex(+!Complex.eq(a, b)),
  ">": (a, b) => new Complex(+Complex.gt(a, b)),
  ">=": (a, b) => new Complex(+Complex.ge(a, b)),
  "<": (a, b) => new Complex(+Complex.lt(a, b)),
  "<=": (a, b) => new Complex(+Complex.le(a, b)),
};
//#endregion
/** Given an operator, return its numerical precedence */
function getPrecedence(token) {
  if (token.type === TOKEN_OP)
    return token.prec;
  return 0;
}
/** Parse string expression to array of tokens */
function parseExpression(source, E) {
  let o = tokenifyExpression(source, E);
  if (o.error)
    return o;
  o = parseTokenCallOpts(o.tokens, E);
  return o;
}
/** Given string expression, return array of tokens */
function tokenifyExpression(source, E) {
  var _a;
  const tokens = [];
  for (let i = 0; i < source.length;) {
    let token = undefined;
    if (/\s/.test(source[i])) {
      i += source[i].length;
      continue;
    }
    else if (source[i] === '*' && source[i + 1] === '*') {
      token = { type: TOKEN_OP, value: '**', args: 2, action: E.operators["**"], assoc: 'rtl', prec: 16, pos: i, posend: i + 1 };
      i += 2;
    }
    else if (source[i] === '=' && source[i + 1] === '=') {
      token = { type: TOKEN_OP, value: '==', args: 2, action: E.operators["=="], assoc: 'ltr', prec: 9, pos: i, posend: i + 1 };
      i += 2;
    }
    else if (source[i] === '!' && source[i + 1] === '=') {
      token = { type: TOKEN_OP, value: '!=', args: 2, action: E.operators["!="], assoc: 'ltr', prec: 9, pos: i, posend: i + 1 };
      i += 2;
    }
    else if (source[i] === '<' && source[i + 1] === '=') {
      token = { type: TOKEN_OP, value: '<=', args: 2, action: E.operators["<="], assoc: 'ltr', prec: 10, pos: i, posend: i + 1 };
      i += 2;
    }
    else if (source[i] === '>' && source[i + 1] === '=') {
      token = { type: TOKEN_OP, value: '>=', args: 2, action: E.operators[">="], assoc: 'ltr', prec: 10, pos: i, posend: i + 1 };
      i += 2;
    }
    else if (source[i] === '!') {
      token = { type: TOKEN_OP, value: '!', args: 1, action: E.operators["!"], assoc: 'rtl', prec: 17, pos: i, posend: i };
      i += 1;
    }
    else if (source[i] === '>') {
      token = { type: TOKEN_OP, value: '>', args: 2, action: E.operators[">"], assoc: 'ltr', prec: 10, pos: i, posend: i };
      i += 1;
    }
    else if (source[i] === '<') {
      token = { type: TOKEN_OP, value: '<', args: 2, action: E.operators["<"], assoc: 'ltr', prec: 10, pos: i, posend: i };
      i += 1;
    }
    else if (source[i] === '/') {
      token = { type: TOKEN_OP, value: '/', args: 2, action: E.operators["/"], assoc: 'ltr', prec: 15, pos: i, posend: i };
      i += 1;
    }
    else if (source[i] === '%') {
      token = { type: TOKEN_OP, value: '%', args: 2, action: E.operators["%"], assoc: 'ltr', prec: 15, pos: i, posend: i };
      i += 1;
    }
    else if (source[i] === '*') {
      token = { type: TOKEN_OP, value: '*', args: 2, action: E.operators["*"], assoc: 'ltr', prec: 15, pos: i, posend: i };
      i += 1;
    }
    else if (source[i] === '+') {
      token = { type: TOKEN_OP, value: '+', args: 2, action: E.operators["+"], assoc: 'ltr', prec: 14, pos: i, posend: i };
      i += 1;
    }
    else if (source[i] === '-') {
      token = { type: TOKEN_OP, value: '-', args: 2, action: E.operators["-"], assoc: 'ltr', prec: 14, pos: i, posend: i };
      i += 1;
    }
    else if (source[i] === '=') {
      token = {
        type: TOKEN_OP, value: '=', args: 2, action: (a, b, E) => {
          E.setSymbol(a, b);
          return b;
        }, assoc: 'rtl', prec: 3, pos: i, posend: i
      };
      i += 1;
    }
    else if (source[i] === ',') {
      token = { type: TOKEN_OP, value: ',', args: 2, action: (a, b) => b, assoc: 'ltr', prec: 1, pos: i, posend: i };
      i += 1;
    }
    else if (source[i] === '(' || source[i] === ')') {
      token = { type: TOKEN_OP, value: source[i], pos: i, posend: i };
      i += 1;
    }
    else {
      if (/[A-Za-z_$]/.test(source[i])) {
        let j = i, symbol = source[i++];
        while (source[i] && /[A-Za-z$_0-9]/.test(source[i]))
          symbol += source[i++];
        token = { type: TOKEN_SYM, value: symbol, pos: j, posend: i - 1 };
      }
      else {
        let nobj = parseNumber(source.substring(i), E.numberOpts);
        if (nobj.str.length !== 0) {
          token = { type: TOKEN_NUM, value: nobj.imag ? new Complex(0, nobj.num) : nobj.num, pos: i, posend: i + nobj.str.length };
          i += nobj.str.length;
        }
      }
    }
    if (token) {
      tokens.push(token);
    }
    else {
      tokens.length = 0;
      return { error: true, pos: i, posend: i, msg: `Unknown token encountered '${source[i]}'` };
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
            OP.action = E.operators['u-'];
            OP.assoc = 'rtl';
            OP.prec = 17;
          }
          else if (OP.value === '+') {
            OP.args = 1;
            OP.action = E.operators['u+'];
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
function parseTokenCallOpts(tokens, E) {
  // Call operator: <symbol>(...)
  for (let i = 0; i < tokens.length - 1;) {
    if (tokens[i].type === TOKEN_SYM && tokens[i + 1].type === TOKEN_OP && tokens[i + 1].value === '(') {
      const j = i;
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
      let o = parseTokenCallOpts(contents, E);
      if (o.error)
        return o;
      o.tokens.forEach((T) => {
        if (T.type === TOKEN_OP && T.value === ',')
          args.push([]);
        else
          args[args.length - 1].push(T);
      });
      args = args.filter(ar => ar.length > 0).map(ar => tokensToRPN(ar));
      const getlen = (t) => t.reduce((p, c) => { var _a; return p + ((_a = c.tlen) !== null && _a !== void 0 ? _a : 1); }, 0);
      let op = { type: TOKEN_OP, value: '()', args: 1, assoc: 'ltr', prec: 20, action: undefined, data: args, tlen: getlen(contents) + 2, pos: tokens[j].pos, posend: tokens[i].posend };
      tokens.splice(j + 1, op.tlen, op);
      i = j + 2;
    }
    else {
      ++i;
    }
  }
  return { error: false, tokens };
}
/** Given array of tokens, make tokens to RPN form */
function tokensToRPN(original) {
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
/** Parse an array of tokens to a numerical result. Returns value, or undefined. If there was an error, E.error will be populated */
function evaluateExpression(tokens, E) {
  var _a;
  if (tokens.length === 0)
    return void (E.error = { error: true, msg: `Empty expression` });
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
        return void (E.error = { error: true, token: T, msg: `Unbalanced parenthesis '${OP.value}' at position ${i}` });
      if (OP.args === undefined)
        return void (E.error = { error: true, token: T, msg: `Unexpected operator '${OP.value}' at position ${i}` });
      if (stack.length < OP.args)
        return void (E.error = { error: true, token: T, msg: `Stack underflow whilst executing operator ${OP.value} (expects ${OP.args} args, got ${stack.length})` });
      let argTokens = stack.splice(stack.length - OP.args), args = [];
      for (let j = 0; j < argTokens.length; ++j) {
        let T = argTokens[j];
        if (T.type === TOKEN_NUM) {
          args.push(T.value); // Push numeric constant
        }
        else if (T.type === TOKEN_SYM) {
          if (j === 0 && OP.value === '=')
            args.push(T.value); // Push the symbol itself
          else if (T.value === E.numberOpts.imag)
            args.push(Complex.I); // Imaginary unit
          else if (E.hasSymbol(T.value))
            args.push(E.getSymbol(T.value));
          else
            return void (E.error = { error: true, token: T, msg: `Unbound symbol '${T.value}' referenced in operator '${OP.value}'` });
        }
        else {
          return void (E.error = { error: true, token: T, msg: `Invalid token type in operator '${OP.value}'` });
        }
      }
      if (E.numberOpts.imag)
        args = args.map(z => typeof z === 'number' ? new Complex(z) : z); // Ensure all data values are Complex
      let val;
      if (OP.action) {
        if (OP.value === '=' && E.constSymbols.has(args[0]))
          return void (E.error = { error: true, token: argTokens[0], msg: `Cannot assign to constant symbol '${args[0]}'` });
        val = OP.action(...args, E);
      }
      else if (OP.value === '()') {
        // CALL
        const f = args[0];
        E.push(argTokens[0].value, OP); // PUSH CALLSTACK
        const argValues = [];
        for (let arg of OP.data) {
          let a = evaluateExpression(arg, E);
          if (E.error)
            return; // Propagate error
          argValues.push(a);
        }
        let x;
        if (typeof f === 'function') {
          try {
            x = f(...argValues, E);
          }
          catch (e) {
            E.error = { error: true, msg: e instanceof Error ? e.message : e.toString(), token: OP };
            return;
          }
        }
        else if (typeof f === 'object' && f.type === 'fn') {
          const fn = f;
          if (!fn.tokens)
            E.parseSymbol(argTokens[0].value); // Parse on the fly
          if (argValues.length > fn.args.length) {
            E.pop();
            return void (E.error = { error: true, token: OP, msg: `Function ${argTokens[0].value} expected ${fn.args.length} arguments, got ${argValues.length}` });
          }
          for (let i = 0; i < fn.args.length; ++i) {
            if (argValues[i] === undefined && (fn.defaults === undefined || fn.defaults[i] === undefined)) {
              E.pop();
              return void (E.error = { error: true, token: OP, msg: `Function ${argTokens[0].value}: no value provided for argument '${fn.args[i]}'` });
            }
            E.defSymbol(fn.args[i], (_a = argValues[i]) !== null && _a !== void 0 ? _a : fn.defaults[i]);
          }
          x = evaluateExpression(fn.tokens, E);
          if (E.error)
            return; // Propagate error
        }
        else {
          return void (E.error = { error: true, token: OP, msg: `Operator '()' used on non-callable '${f}'` });
        }
        if (typeof x === 'number')
          val = E.numberOpts.imag ? new Complex(x) : x;
        else if (x == undefined)
          val = E.numberOpts.imag ? new Complex(0) : 0;
        else
          val = x;
        E.pop(); // POP CALLSTACK
      }
      else {
        return void (E.error = { error: true, token: OP, msg: `Unknown operator '${OP.value}'` });
      }
      if (E.error)
        return; // Propagate error
      stack.push({ type: TOKEN_NUM, value: val });
    }
  }
  if (stack.length > 1)
    return void (E.error = { error: true, token: stack[1], msg: `Expected one item to be in result stack, got ${stack.length}` });
  let value;
  if (stack[0].type === TOKEN_NUM)
    value = stack[0].value;
  else if (stack[0].type === TOKEN_SYM) {
    if (stack[0].value === E.numberOpts.imag)
      value = Complex.I;
    else if (E.hasSymbol(stack[0].value))
      value = E.getSymbol(stack[0].value);
    else
      return void (E.error = { error: true, token: stack[0], msg: `Unbound symbol referenced '${stack[0].value}'` });
  }
  else {
    return void (E.error = { error: true, token: stack[0], msg: `Unterminal token in result stack` });
  }
  if (typeof value === 'number' && E.numberOpts.imag)
    value = Complex.parse(value);
  return value;
}
/** Given error object, return string representation (returns '' if not an error) */
export function errorToString(error) {
  if (error) {
    if (error.hasOwnProperty("token")) {
      let e = error;
      return `[!] ${e.msg}` + (e.token ? ` [position ${e.token.pos}]` : '');
    }
    else {
      let e = error;
      return `[!] ${e.msg}` + (e.pos === undefined ? '' : ` [position ${e.pos}]`);
    }
  }
  else {
    return "";
  }
}
const TOKEN_OP = 1;
const TOKEN_NUM = 2;
const TOKEN_SYM = 4;
/**
 * Creates an expression, which may be parsed and executed.
 *
 * Expression.numberOpts allows customision on numerical parsing.
 *
 * Values may be numbers, Complex instanced, Functions, or objects (IFunction) which behave as a function.
 * When changes are made to IFunction.source, call Expression.parseSymbol(<name>) to update it, otherwise the change WILL NOT take effect.
*/
export class Expression {
  constructor(expr = '') {
    this.constSymbols = new Map(); // Symbols whose values are not changed
    this.operators = OPERATORS_DEFAULT; // Operators to be used in parsing
    this.callstack = [];
    this.source = expr;
    this._tokens = [];
    this.numberOpts = {
      exponent: true,
      decimal: true,
      seperator: '_',
      signed: false,
      imag: undefined, // Disallow
    };
    this.callstack.push({ name: '_MAIN', symbols: new Map() }); // Initialise call stack
  }
  /** Reset symbol map and expression data */
  reset() {
    this._tokens.length = 0;
    this.callstack.length = 1;
    this.callstack[0].symbols.clear();
    return this;
  }
  /** Load new raw expression string */
  load(expr) {
    this._tokens.length = 0;
    this.source = expr;
    return this;
  }
  /** Define given symbol in topmost scope */
  defSymbol(name, value = 0) {
    if (this.constSymbols.has(name))
      throw new Error(`Cannot re-use constant symbol '${name}'`);
    this.callstack[this.callstack.length - 1].symbols.set(name, value);
    return this;
  }
  /** Set value of existing symbol to a value. If symbol does not exist, create it in the topmost scope. */
  setSymbol(name, value) {
    if (this.callstack.length === 0)
      return this;
    if (this.constSymbols.has(name))
      throw new Error(`Cannot assign to constant '${name}'`);
    for (let i = this.callstack.length - 1; i >= 0; --i) {
      if (this.callstack[i].symbols.has(name)) {
        this.callstack[i].symbols.set(name, value);
        return this;
      }
    }
    this.callstack[this.callstack.length - 1].symbols.set(name, value);
    return this;
  }
  /** Does the given symbol exist? */
  hasSymbol(name) {
    return this.constSymbols.has(name) || this.callstack.some(({ symbols }) => symbols.has(name));
  }
  /** Get value of given symbol, or undefined */
  getSymbol(name) {
    if (this.constSymbols.has(name))
      return this.constSymbols.get(name);
    for (let i = this.callstack.length - 1; i >= 0; --i) {
      if (this.callstack[i].symbols.has(name)) {
        return this.callstack[i].symbols.get(name);
      }
    }
    return undefined;
  }
  /** Delete first occurence of a given symbol */
  delSymbol(name) {
    if (this.constSymbols.has(name)) {
      this.constSymbols.delete(name);
      return this;
    }
    for (let i = this.callstack.length - 1; i >= 0; --i) {
      if (this.callstack[i].symbols.has(name)) {
        this.callstack[i].symbols.delete(name);
        break;
      }
    }
    return this;
  }
  /** Set internal error object (NB overrides current error if there is one) */
  setError(msg, pos) {
    this.error = { error: true, msg, pos };
  }
  /**
   * Handle the error:
   * - Empty call stack
   * - Remove error flag
   * - Return error as string
  */
  handleError() {
    var _a;
    if (this.error) {
      let msg = errorToString(this.error);
      if (this.error && this.error.token) {
        const e = this.error;
        const fname = this.callstack[this.callstack.length - 1].name, fval = this.getSymbol(fname);
        let source = fval && typeof fval === "object" && fval.type === "fn" ? fval.body : this.source;
        let snippet = source.substring(e.token.pos, e.token.posend + 1);
        msg += '\n  ' + snippet + '\n  ' + '~'.repeat(snippet.length);
      }
      const stack = [];
      for (let i = 0; i < this.callstack.length; i++) {
        let frame = this.callstack[i], str = `In function <${frame.name}>`;
        if (frame.token) {
          str += ` at position ${frame.token.pos}:`;
          const fname = (_a = this.callstack[i - 1]) === null || _a === void 0 ? void 0 : _a.name, fval = fname ? this.getSymbol(fname) : undefined;
          let source = fval && typeof fval === "object" && fval.type === "fn" ? fval.body : this.source;
          let snippet = source.substring(frame.token.pos, frame.token.posend + 1);
          str += '\n  ' + snippet + '\n  ' + '~'.repeat(snippet.length);
        }
        else {
          str += ':';
        }
        stack.push(str);
      }
      this.callstack.length = 1;
      this.error = undefined;
      return stack.join("\n") + "\n" + msg;
    }
    else {
      return;
    }
  }
  /** Push iterm to the call stack */
  push(name, invoker) {
    this.callstack.push({ name, symbols: new Map(), token: invoker });
    return this;
  }
  /** Pop item from the call stack */
  pop() {
    this.callstack.pop();
    return this;
  }
  /** Parse a symbol (i.e. a user-defined function) */
  parseSymbol(name) {
    if (this.hasSymbol(name)) {
      const value = this.getSymbol(name);
      if (typeof value === "object" && value.type === "fn") {
        const fn = value;
        let o = parseExpression(fn.body, this);
        if (o.error) {
          this.error = o;
        }
        else {
          fn.tokens = tokensToRPN(o.tokens);
        }
      }
    }
    return this;
  }
  /** call this.parseSymbol on every elligible symbol */
  parseAllSymbols() {
    this.constSymbols.forEach((_, name) => this.parseSymbol(name));
    for (let i = this.callstack.length - 1; i >= 0; --i) {
      this.callstack[i].symbols.forEach((_, name) => this.parseSymbol(name));
    }
  }
  /** Parse raw to token array */
  parse() {
    this.error = undefined;
    this.callstack.length = 1;
    this._tokens.length = 0;
    const o = parseExpression(this.source, this);
    if (o.error) {
      this.error = o; // !ERROR!
    }
    else {
      this._tokens = o.tokens;
      const tokens = tokensToRPN(this._tokens);
      this._tokens = tokens;
      o.tokens = tokens;
    }
    return this;
  }
  /** Evaluate parsed string. */
  evaluate() {
    if (this.error)
      return;
    return evaluateExpression(this._tokens, this);
  }
}