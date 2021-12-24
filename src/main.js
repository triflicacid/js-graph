import { Graph } from "./Graph.js";
import Popup from "./Popup.js";
import { circle, extractCoords, getCorrespondingCoordinate, clamp, round, log, lerp, getCorrepondingCoordinateIndex, getAudioFromCoords, random, downloadTextFile, factorial } from "./utils.js";

const canvas = document.getElementById('canvas');
canvas.width = window.innerWidth - 15;
canvas.height = window.innerHeight - 250;

const g = new Graph(canvas, canvas);
var soundLoop = true, soundDurMult = 1, soundMultiplier = 1;
var DP_ACCURACY = 5, SHOW_COORDS = true;
globalThis.g = g;
// MAP LINE TYPES TO DESCRIPTION
const LINE_TYPES = {
  'a': 'addition',
  'c': 'raw coordinates',
  'd': 'differentiate',
  'e': 'equation',
  'i': 'integrand',
  'm': 'multiply',
  'p': 'parameter',
  's': 'subtraction',
  't': 'translate',
  'x': 'x-coordinates',
  'y': 'y-coordinates',
  'θ': 'polar',
};
const LINE_DESCRIPTIONS = {
  'a': `Add coords of given lines together`,
  'c': `Plot raw coordinates`,
  'd': `Sketch the change in gradient of the given line`,
  'e': `Equation - sketch when lhs == rhs`,
  'i': `Assuming given line is change in gradient, sketch the original line (anti-'d')`,
  'm': `Multiply coords of given lines together`,
  'p': `The paramater p is varied within a range and passed to function which returns [x,y] coordinate`,
  's': `Subtract coords of given lines from one another`,
  't': `Translate line by scale, shift and rotation`,
  'x': 'x-coordinates are controlled and passed to function which returns y-coordinate',
  'y': 'y-coordinates are controlled and passed to function which returns x-coordinate',
  'θ': 'Polar: θ is an angle in radians with the polar point [fn(θ), θ] being plotted.',
};

//#region CONFIG POPUP
function generateConfigPopup() {
  const popup = new Popup('Configuration');
  const pcTable = document.createElement("table");
  popup.insertAdjacentElement("beforeend", pcTable);
  pcTable.insertAdjacentHTML("beforeend", "<thead><tr><th>Field</th><th>Value</th></tr></thead>");
  const pcTbody = pcTable.createTBody();
  [
    { field: 'Start X', title: 'Left-most X value', type: 'number', get: () => g.opts.xstart, set: v => g.opts.xstart = +v },
    { field: 'X Step', title: 'Width of gap between x-axis markers', type: 'number', get: () => g.opts.xstep, set: v => g.opts.xstep = +v },
    { field: 'X Step Gap', title: 'Gap (in pixels) between each x-axis marker', type: 'number', get: () => g.opts.xstepGap, set: v => g.opts.xstepGap = +v },
    { field: 'Mark X', title: 'Mark x-axis', type: 'boolean', get: () => g.opts.markXAxis, set: v => g.opts.markXAxis = v },

    { field: 'Start Y', title: 'Top-most Y value', type: 'number', get: () => g.opts.ystart, set: v => g.opts.ystart = +v },
    { field: 'Y Step', title: 'Height of gap between y-axis markers', type: 'number', get: () => g.opts.ystep, set: v => g.opts.ystep = +v },
    { field: 'Y Step Gap', title: 'Gap (in pixels) between each y-axis marker', type: 'number', get: () => g.opts.ystepGap, set: v => g.opts.ystepGap = +v },
    { field: 'Mark Y', title: 'Mark y-axis', type: 'boolean', get: () => g.opts.markYAxis, set: v => g.opts.markYAxis = v },

    { field: '&Nscr;-Coords', title: 'Number of coordinat points to plot for each line function (directly impacts performance)', type: 'number', get: () => g.opts.ncoords, set: v => g.opts.ncoords = +v },
    { field: 'Approx. Acc.', title: 'Accuracy (decimal places) of approximations i.e. finding roots', type: 'number', get: () => DP_ACCURACY, set: v => DP_ACCURACY = v },
    { field: 'Line Width', title: 'Line width of each line function', type: 'number', min: 0, get: () => g.opts.lineWidth, set: v => g.opts.lineWidth = +v },
    { field: 'Axis Thickness', title: 'Line thickness of the y/x-axis', type: 'number', get: () => g.opts.axisThickness, set: v => g.opts.axisThickness = v },
    { field: 'Grid', title: 'Show grid', type: 'boolean', get: () => g.opts.grid, set: v => g.opts.grid = v },
    { field: 'Grid Thickness', title: 'Line thickness of the grid', type: 'number', get: () => g.opts.gridThickness, set: v => g.opts.gridThickness = v },
    { field: 'Sub-Grid Divs', title: 'Divisions inside each x/y-axis step', type: 'number', get: () => g.opts.subGridDivs, set: v => g.opts.subGridDivs = v },
    { field: 'Show Coords', title: 'Show approx. coordinates next to cursor', type: 'boolean', get: () => SHOW_COORDS, set: v => SHOW_COORDS = v },
    { field: 'Caching', title: 'Enable graph caching (speeds up performance)', type: 'boolean', get: () => doCache, set: v => doCache = v },

    { field: 'Sound Loop', title: 'Loop sound audio', type: 'boolean', get: () => soundLoop, set: v => soundLoop = v },
    { field: 'Sound K', title: 'Multiply sound data by this constant', type: 'number', get: () => soundMultiplier, set: v => soundMultiplier = v },
    { field: 'Sound Dur. K', title: 'Multiply sound duration by this constant', type: 'number', get: () => soundDurMult, set: v => soundDurMult = v },

  ].forEach(opts => {
    const tr = document.createElement("tr");
    pcTbody.appendChild(tr);
    tr.insertAdjacentHTML("beforeend", `<th><abbr title='${opts.title}'>${opts.field}</abbr></th>`);
    let td = document.createElement('td');
    tr.appendChild(td);
    const input = document.createElement('input');
    if (opts.type === 'number') {
      input.type = 'number';
      if (opts.min !== undefined) input.min = opts.min;
      if (opts.max !== undefined) input.max = opts.max;
      input.addEventListener('change', () => {
        opts.set(clamp(+input.value, opts.min, opts.max));
      });
    } else if (opts.type === 'boolean') {
      input.type = 'checkbox';
      input.checked = opts.get();
      input.addEventListener('change', () => {
        opts.set(input.checked);
      });
    } else {
      input.type = 'text';
      input.addEventListener('change', () => {
        opts.set(input.value);
      });
    }
    input.value = opts.get();
    td.appendChild(input);
  });
  return popup;
}
//#endregion

//#region SAVED CURVES POPUP
const curves = [ // [name, title, opts]
  ['Butterfly', 'Butterfly curve', ['θ', 'exp(cos(θ)) - 2*cos(4*θ) + sin((2*θ-pi)/24)**5']],
  ['Cannabis', 'Cannabis leaf looking curve (first number is radius)', ['θ', '2 * (1+0.9*cos(8*θ))*(1+0.1*cos(24*θ))*(0.9+0.1*cos(200*θ))*(1+sin(θ))']],
  ['Cardoid', 'Produces cardoid when K.a = K.b', ['θ', 'K.a - K.b*cos(θ)']],
  ['Circle', 'Circle with K.n radius', ['p', ['cos(p)', 'sin(p)'], [0, 6.3]]],
  ['Factorial', 'Sketch factorial. Area 0-inf approximates K.n!', ['x', 'x**K.n * e**(-x)']],
  ['Heart', 'Heart-shaped polar curve', ['θ', '(sin(θ) * sqrt(abs(cos(θ))))/(sin(θ)+1.4) - 2*sin(θ) + 2']],
  ['Note A', 'Curve of note A', ['x', 'sin(880*pi*x)']],
  ['Note C#', 'Curve of note C#', ['x', 'sin(1100*pi*x)']],
  ['Note E', 'Curve of note E', ['x', 'sin(1320*pi*x)']],
  ['Normal Dist', 'Normal Distribution curve', ['x', '(1/(K.σ * sqrt(2 * pi))) * e ** (-0.5 * ((x - K.μ) / K.σ) ** 2)']],
  ['Penis', 'Phallic-looking curve', ['x', 'abs(sin(x)) + 5*exp(-(x**100))*cos(x)', undefined, { condRaw: 'x >= -3 && x <= 3', cond: x => x >= -3 && x <= 3 }]],
  ['Quartic', 'Sequence formula', ['x', '(24+14*x+11*x**2-2*x**3+x**4)/24']],
  ['Square Wave', 'Square wave with frequency K.f', ['x', 'sgn(sin(2*pi*K.f*x))']],
];
function generateSavedCurvesPopup() {
  const popup = new Popup('Saved Curves');
  curves.forEach(([name, title, args]) => {
    const el = document.createElement("span");
    const btn = document.createElement('button');
    btn.innerHTML = name;
    btn.title = title;
    btn.addEventListener('click', () => {
      let line = createLine(...args);
      addLine(line);
      doTableUpdate = true;
      update = true;
      newCache = true;
    });
    el.appendChild(btn);
    popup.insertAdjacentElement("beforeend", el);
  });
  return popup;
}
//#endregion

//#region FUNCTIONS POPUP
const funcInfo = {}; // [name: string]: { source: string, args: string[], internal: boolean }
const funcs = {};
function addFunc(name, args, source) {
  funcInfo[name] = { args, source };
  funcs[name] = new Function(...args, 'return ' + source);
  globalThis[name] = funcs[name];
}
function addInternalFunc(name, fn) {
  funcInfo[name] = { internal: true };
  funcs[name] = fn;
  globalThis[name] = fn;
}
function removeFunc(name) {
  if (name in funcInfo) {
    delete funcInfo[name];
    delete funcs[name];
    delete globalThis[name];
    return true;
  } else {
    return false;
  }
}
function generateFunctionPopup() {
  const popup = new Popup('Functions'), container = document.createElement('div');
  popup.setContent(container);
  // const internalDiv = document.createElement("div");
  // container.appendChild(internalDiv);
  // internalDiv.innerHTML = '<strong>Internal</strong>: ' + Object.entries(funcInfo).sort().filter(([name, info]) => info.internal).map(([name, info]) => `<code>${name}</code>`).join(', ');
  const table = document.createElement('table');
  table.insertAdjacentHTML("beforeend", "<thead><tr><th>Function</th><th>Arguments</th><th>Body</th><th>Delete</th></tr></thead>");
  container.appendChild(table);
  const tbody = table.createTBody();
  function createRow(name) {
    const tr = document.createElement("tr"), info = funcInfo[name];
    tr.insertAdjacentHTML("beforeend", `<th>${name}</th>`);
    if (info.internal) {
      tr.insertAdjacentHTML("beforeend", `<td colspan='2'><em>[Internal]</em></td>`);
    } else {
      let td = document.createElement("td");
      let inpArguments = document.createElement("input");
      inpArguments.value = info.args.join(', ');
      inpArguments.title = 'Function arguments seperated by commas';
      inpArguments.addEventListener('change', () => {
        info.args = inpArguments.value.split(',').map(x => x.trim());
        inpArguments.value = info.args.join(', ');
        addFunc(name, info.args, info.source);
      });
      td.appendChild(inpArguments);
      tr.appendChild(td);

      td = document.createElement("td");
      let inpBody = document.createElement("input");
      inpBody.value = info.source.trim();
      inpBody.title = 'Function body (JS code)';
      inpBody.addEventListener('change', () => {
        info.source = inpBody.value.trim();
        inpBody.value = info.source;
        addFunc(name, info.args, info.source);
      });
      td.appendChild(inpBody);
      tr.appendChild(td);
    }
    let delBtn = document.createElement("button");
    delBtn.innerHTML = '&times;';
    delBtn.addEventListener('click', () => {
      let ok = removeFunc(name);
      if (ok) {
        tr.remove();
      }
    });
    let td = document.createElement("td");
    td.appendChild(delBtn);
    tr.appendChild(td);
    return tr;
  }

  for (let name in funcInfo) {
    if (funcInfo.hasOwnProperty(name) && !funcInfo[name].internal) tbody.appendChild(createRow(name));
  }
  let tfoot = table.createTFoot(), tr = document.createElement("tr"), td = document.createElement("td"), newBtn = document.createElement("button");
  table.appendChild(tfoot);
  newBtn.innerHTML = '&plus; Define Function';
  newBtn.addEventListener('click', () => {
    let name = prompt('Enter function name');
    if (name) {
      if (name in funcInfo) return alert(`Function called ${name} already exists`);
      addFunc(name, ['x'], 'x');
      tbody.appendChild(createRow(name));
    }
  });
  td.appendChild(newBtn);
  td.colSpan = 4;
  tr.appendChild(td);
  tfoot.appendChild(tr);
  return popup;
}
//#endregion

//#region NEW/EDIT LINE POPUP
/** Show popup for a new line. If lineData is provided, immediatley display options. */
function generateNewLinePopup(callback, lineData = undefined) {
  const popup = new Popup("Create Line"), container = document.createElement("div");
  popup.setContent(container);
  let el = document.createElement("p");

  let inputType = document.createElement("select");
  inputType.insertAdjacentHTML("beforeend", "<option selected disabled>TYPES</option>");
  el.innerHTML = '<strong>Line Type</strong>: ';
  el.appendChild(inputType);
  Object.entries(LINE_TYPES).forEach(([type, desc]) => inputType.insertAdjacentHTML("beforeend", `<option value='${type}' title='${desc}'>${type} - ${LINE_TYPES[type]}</option>`));
  container.appendChild(el);

  const div = document.createElement("div");
  container.appendChild(div);
  inputType.addEventListener('change', () => generateAdditional({ type: inputType.value }, 1));

  if (lineData !== undefined) {
    inputType.value = lineData.type;
    inputType.disabled = true;
    generateAdditional(lineData, 2);
  }

  function generateAdditional(line, btnType = 0) {
    div.innerHTML = `<em>${LINE_DESCRIPTIONS[line.type]}</em><br>`;
    switch (line.type) {
      case 'x':
      case 'y': {
        let el = document.createElement("p");
        div.appendChild(el);
        el.innerHTML = `&#402;(&${line.type}scr;) = `;
        let inputEquation = document.createElement("input");
        if (!line.fnRaw) {
          line.fnRaw = line.type;
          line.fn = Function(line.type, 'return ' + line.type);
        }
        inputEquation.type = "text";
        inputEquation.value = line.fnRaw;
        inputEquation.addEventListener('change', () => {
          let fn, fnRaw = inputEquation.value;
          try {
            fn = Function(line.type, 'return ' + fnRaw);
          } catch (e) {
            alert(`Error defining function: ${e.message}`);
            inputEquation.value = line.fnRaw;
            return;
          }
          line.fnRaw = fnRaw;
          line.fn = fn;
        });
        el.appendChild(inputEquation);

        el = document.createElement("p");
        div.appendChild(el);
        el.innerHTML = `&Iscr;&fscr; `;
        let inputCond = document.createElement("input");
        inputCond.type = "text";
        if (line.cond) inputCond.value = line.condRaw;
        inputCond.placeholder = (line.type === 'x' ? '𝓍' : '𝓎') + ' ∈ ℝ';
        inputCond.title = 'Only plot coordinate if TRUE';
        inputCond.addEventListener('change', () => {
          console.log("Change")
          let fn, fnRaw = inputCond.value;
          if (fnRaw === '') {
            delete line.condRaw;
            delete line.cond;
          } else {
            try {
              fn = Function(line.type, 'return ' + fnRaw);
            } catch (e) {
              alert(`Error defining function: ${e.message}`);
              inputCond.value = line.condRaw ?? '';
              return;
            }
            line.condRaw = fnRaw;
            line.cond = fn;
          }
        });
        el.appendChild(inputCond);
        break;
      }
      case 'e': {
        let el = document.createElement("p");
        div.appendChild(el);
        let inputLHS = document.createElement("input");
        if (!line.lhsRaw) {
          line.lhsRaw = 'x';
          line.lhs = Function('x', 'y', 'return ' + line.lhsRaw);
        }
        inputLHS.type = "text";
        inputLHS.value = line.lhsRaw;
        inputLHS.addEventListener('change', () => {
          let fn, fnRaw = inputLHS.value;
          try {
            fn = Function('x', 'y', 'return ' + fnRaw);
          } catch (e) {
            alert(`Error defining function: ${e.message}`);
            inputLHS.value = line.lhsRaw;
            return;
          }
          line.lhsRaw = fnRaw;
          line.lhs = fn;
        });
        el.appendChild(inputLHS);
        el.insertAdjacentHTML("beforeend", " = ");
        let inputRHS = document.createElement("input");
        if (!line.lhsRaw) {
          line.rhsRaw = 'x';
          line.rhs = Function('x', 'y', 'return ' + line.rhsRaw);
        }
        inputRHS.type = "text";
        inputRHS.value = line.rhsRaw;
        inputRHS.addEventListener('change', () => {
          let fn, fnRaw = inputRHS.value;
          try {
            fn = Function('x', 'y', 'return ' + fnRaw);
          } catch (e) {
            alert(`Error defining function: ${e.message}`);
            inputRHS.value = line.rhsRaw;
            return;
          }
          line.rhsRaw = fnRaw;
          line.rhs = fn;
        });
        el.appendChild(inputRHS);
        break;
      }
      case 'θ': {
        line.range ??= [0, 2 * Math.PI];

        let el = document.createElement("p");
        div.appendChild(el);
        el.innerHTML = `&#402;(θ) = `;
        let inputEquation = document.createElement("input");
        if (!line.fnRaw) {
          line.fnRaw = line.type;
          line.fn = Function(line.type, 'return ' + line.type);
        }
        inputEquation.type = "text";
        inputEquation.value = line.fnRaw;
        inputEquation.addEventListener('change', () => {
          let fn, fnRaw = inputEquation.value;
          try {
            fn = Function(line.type, 'return ' + fnRaw);
          } catch (e) {
            alert(`Error defining function: ${e.message}`);
            inputEquation.value = line.fnRaw;
            return;
          }
          line.fnRaw = fnRaw;
          line.fn = fn;
        });
        el.appendChild(inputEquation);

        el = document.createElement("p");
        let inputRangeMin = document.createElement("input");
        inputRangeMin.type = 'text';
        inputRangeMin.value = line.range[0];
        inputRangeMin.addEventListener("change", () => updateRange());
        el.appendChild(inputRangeMin);
        el.insertAdjacentHTML("beforeend", ` &leq; θ &leq; `);
        let inputRangeMax = document.createElement("input");
        inputRangeMax.type = 'text';
        inputRangeMax.value = line.range[1];
        inputRangeMax.addEventListener("change", () => updateRange());
        el.appendChild(inputRangeMax);
        div.appendChild(el);

        el = document.createElement("p");
        el.innerHTML = '<strong>θ Step</strong>: ';
        let inputStep = document.createElement("input");
        inputStep.type = 'text';
        inputStep.title = 'Step of θ. Leave blank for default.';
        inputStep.placeholder = 'Default';
        if (line.range[2] !== undefined) inputStep.value = line.range[2];
        inputStep.addEventListener("change", () => {
          if (inputStep.value.length === 0) {
            line.range.splice(2, 1);
          } else {
            let step;
            try {
              step = +eval(inputStep.value.trim());
            } catch (e) {
              return alert(`Error: ${e.message}`);
            }
            if (step <= 0 || isNaN(step) || !isFinite(step)) return alert(`Invalid step: must be finite number >0`);
            line.range[2] = step;
            inputStep.value = step;
          }
        });
        el.appendChild(inputStep);
        div.appendChild(el);

        function updateRange() {
          try {
            let min = +eval(inputRangeMin.value), max = +eval(inputRangeMax.value);
            if (min >= max) return alert(`Invalid bound relationship`);
            if (isNaN(min) || !isFinite(min)) return alert(`Invalid lower bound - must be finite number`);
            if (isNaN(max) || !isFinite(max)) return alert(`Invalid upper bound - must be finite number`);
            line.range[0] = min;
            line.range[1] = max;
            inputRangeMin.value = min;
            inputRangeMax.value = max;
          } catch (e) {
            alert(`Error updating range: ${e.message}`);
          }
        }

        break;
      }
      case 'p': {
        const varSymbol = 'p';
        line.range = [-2, 2];

        let el = document.createElement("p");
        el.innerHTML = `&#402;<sub>&xscr;</sub>(${varSymbol}) = `;
        let inputEquationX = document.createElement("input");
        inputEquationX.type = "text";
        if (!line.fnxRaw) {
          line.fnxRaw = varSymbol;
          line.fnx = Function(varSymbol, 'return ' + line.fnxRaw);
        }
        inputEquationX.value = line.fnxRaw;
        inputEquationX.addEventListener('change', () => {
          let fn, fnRaw = inputEquationX.value;
          try {
            fn = Function(varSymbol, 'return ' + fnRaw);
          } catch (e) {
            inputEquationX.value = line.fnxRaw;
            alert(`Error: ${e.message}`);
            return;
          }
          line.fnxRaw = fnRaw;
          line.fnx = fn;
        });
        el.appendChild(inputEquationX);
        div.appendChild(el);

        el = document.createElement("p");
        el.innerHTML = `&#402;<sub>&yscr;</sub>(${varSymbol}) = `;
        let inputEquationY = document.createElement("input");
        inputEquationY.type = "text";
        if (!line.fnyRaw) {
          line.fnyRaw = varSymbol;
          line.fny = Function(varSymbol, 'return ' + line.fnyRaw);
        }
        inputEquationY.value = line.fnyRaw;
        inputEquationY.addEventListener('change', () => {
          let fn, fnRaw = inputEquationY.value;
          try {
            fn = Function(varSymbol, 'return ' + fnRaw);
          } catch (e) {
            inputEquationY.value = line.fnyRaw;
            alert(`Error: ${e.message}`);
            return;
          }
          line.fnyRaw = fnRaw;
          line.fny = fn;
        });
        el.appendChild(inputEquationY);
        div.appendChild(el);

        el = document.createElement("p");
        let inputRangeMin = document.createElement("input");
        inputRangeMin.type = 'text';
        inputRangeMin.value = line.range[0];
        inputRangeMin.addEventListener("change", () => updateRange());
        el.appendChild(inputRangeMin);
        el.insertAdjacentHTML("beforeend", ` &leq; ${varSymbol} &leq; `);
        let inputRangeMax = document.createElement("input");
        inputRangeMax.type = 'text';
        inputRangeMax.value = line.range[1];
        inputRangeMax.addEventListener("change", () => updateRange());
        el.appendChild(inputRangeMax);
        div.appendChild(el);

        el = document.createElement("p");
        el.innerHTML = `<strong>${varSymbol} Step</strong>: `;
        let inputStep = document.createElement("input");
        inputStep.type = 'text';
        inputStep.title = `Step of ${varSymbol}. Leave blank for default.`;
        inputStep.placeholder = 'Default';
        if (line.range[2] !== undefined) inputStep.value = line.range[2];
        inputStep.addEventListener("change", () => {
          if (inputStep.value.length === 0) {
            line.range.splice(2, 1);
          } else {
            let step;
            try {
              step = +eval(inputStep.value.trim());
            } catch (e) {
              return alert(`Error: ${e.message}`);
            }
            if (step <= 0 || isNaN(step) || !isFinite(step)) return alert(`Invalid step: must be finite number >0`);
            line.range[2] = step;
            inputStep.value = step;
          }
        });
        el.appendChild(inputStep);
        div.appendChild(el);

        function updateRange() {
          try {
            let min = +eval(inputRangeMin.value), max = +eval(inputRangeMax.value);
            if (min >= max) return alert(`Invalid bound relationship`);
            if (isNaN(min) || !isFinite(min)) return alert(`Invalid lower bound - must be finite number`);
            if (isNaN(max) || !isFinite(max)) return alert(`Invalid upper bound - must be finite number`);
            line.range = [min, max];
            inputRangeMin.value = min;
            inputRangeMax.value = max;
          } catch (e) {
            alert(`Error updating range: ${e.message}`);
          }
        }
        break;
      }
      case 'd':
      case 'i': {
        const method = line.type === 'd' ? 'differentiate' : 'integrate';
        let el = document.createElement("p");
        el.innerHTML = `ID of line to ${method}: `;
        let selectID = document.createElement("select");
        selectID.insertAdjacentHTML("beforeend", "<option selected disabled>ID</option>");
        g.getLines().forEach(id => selectID.insertAdjacentHTML('beforeend', `<option ${id}>${id}</option>`));
        if (line.id === undefined) line.id = NaN; else selectID.value = line.id;
        selectID.addEventListener("change", () => line.id = +selectID.value);
        el.appendChild(selectID);
        div.appendChild(el);

        if (line.type === 'i') {
          line.C ??= 0;
          el = document.createElement("p");
          el.innerHTML = '<abbr title="Integration Constant">&Cscr;</abbr> = ';
          let inputC = document.createElement("input");
          inputC.type = 'text';
          inputC.value = line.C;
          inputC.addEventListener("change", () => {
            let C;
            try {
              C = +eval(inputC.value);
            } catch (e) {
              return alert(`Error whilst updating C: ${e.message}`);
            }
            line.C = C;
            inputC.value = C;
          });
          el.appendChild(inputC);
          div.appendChild(el);
        }
        break;
      }
      case 'a':
      case 'm':
      case 's': {
        line.ids ??= [];
        let symbol;
        if (line.type === 's') symbol = '-';
        else if (line.type === 'm') symbol = '*';
        else symbol = '+';
        let el = document.createElement("p");
        el.innerHTML = `Enter line IDs seperated by ${symbol}:<br>`;
        let input = document.createElement("input");
        input.type = "text";
        input.placeholder = `0 ${symbol} 1`;
        input.value = line.ids.join(' ' + symbol + ' ');
        input.addEventListener('change', () => {
          try {
            let ids = input.value.split(symbol).map(x => parseInt(x.trim()));
            line.ids = ids;
            input.value = ids.join(' ' + symbol + ' ');
          } catch (e) {
            return alert(`Error: ${e.message}`);
          }
        });
        el.appendChild(input);
        div.appendChild(el);
        break;
      }
      case 't': {
        line.C ??= [1, 0, 1, 0, 0];

        let el = document.createElement('p');
        div.appendChild(el);
        el.innerHTML = `ID of line to translate: `;
        let selectID = document.createElement("select");
        selectID.insertAdjacentHTML("beforeend", "<option selected disabled>ID</option>");
        g.getLines().forEach(id => selectID.insertAdjacentHTML('beforeend', `<option ${id}>${id}</option>`));
        line.id ??= NaN;
        if (!isNaN(line.id)) selectID.value = line.id;
        selectID.addEventListener("change", () => line.id = +selectID.value);
        el.appendChild(selectID);

        // TRANSLATE (SHIFT)
        el = document.createElement('p');
        el.insertAdjacentHTML('beforeend', `<strong>Translate</strong>: (`);
        let transInputX = document.createElement('input');
        transInputX.type = 'number';
        transInputX.value = line.C[1];
        transInputX.title = 'X Coordinate';
        transInputX.step = g.opts.xstep;
        transInputX.classList.add('small');
        transInputX.addEventListener('change', e => {
          line.C[1] = +e.target.value;
        });
        el.appendChild(transInputX);
        el.insertAdjacentHTML('beforeend', `, `);
        let transInputY = document.createElement('input');
        transInputY.type = 'number';
        transInputY.classList.add('small');
        transInputY.value = line.C[3];
        transInputY.title = 'Y Coordinate';
        transInputY.step = g.opts.ystep;
        transInputY.addEventListener('change', e => {
          line.C[3] = +e.target.value;
        });
        el.appendChild(transInputY);
        el.insertAdjacentHTML('beforeend', `)`);
        div.appendChild(el);

        // TRANSLATE (SCALE)
        el = document.createElement("p");
        div.appendChild(el);
        el.insertAdjacentHTML('beforeend', `<strong>Scale</strong>: `);
        let scaleInputX = document.createElement('input');
        scaleInputX.type = 'number';
        scaleInputX.value = line.C[0];
        scaleInputX.title = 'X Coordinate multiplier';
        scaleInputX.classList.add('small');
        scaleInputX.addEventListener('change', e => {
          line.C[0] = +e.target.value;
        });
        el.appendChild(scaleInputX);
        el.insertAdjacentHTML('beforeend', `&Xscr;, `);
        let scaleInputY = document.createElement('input');
        scaleInputY.type = 'number';
        scaleInputY.value = line.C[2];
        scaleInputY.title = 'Y Coordinate multiplier';
        scaleInputY.classList.add('small');
        scaleInputY.addEventListener('change', e => {
          line.C[2] = +e.target.value;
        });
        el.appendChild(scaleInputY);
        el.insertAdjacentHTML('beforeend', '&Yscr;');

        // TRANSLATE (ROTATION)
        el = document.createElement("p");
        div.appendChild(el);
        el.insertAdjacentHTML('beforeend', `<strong><abbr title='Rotate function by <angle> radians'>Angle</abbr></strong>: `);
        let rotInput = document.createElement('input');
        rotInput.type = 'text';
        rotInput.value = line.C[4];
        rotInput.addEventListener('change', e => {
          try {
            const theta = (+eval(e.target.value)) % (2 * Math.PI);
            rotInput.value = theta;
            line.C[4] = theta;
            displayRadians(theta);
          } catch (e) {
            rotInput.value = line.C[4];
            alert(`Error setting angle: ${e.message}`);
          }
        });
        el.appendChild(rotInput);
        el.insertAdjacentHTML('beforeend', ' &#8776; ');
        const rotValue = document.createElement('span');
        const displayRadians = theta => rotValue.innerHTML = `<abbr title='${theta} rad'>${round(theta / Math.PI, 3)}&pi;</abbr>`;
        displayRadians(line.C[4]);
        el.appendChild(rotValue);
        el.insertAdjacentHTML('beforeend', ' rad');
        break;
      }
      case 'c': {
        let table = document.createElement('table'), tbody = table.createTBody();
        table.insertAdjacentHTML("afterbegin", "<thead><tr><th>&Xscr;</th><th>&Yscr;</th></tr></thead>");
        div.appendChild(table);
        line.coords ??= [];
        function generateRow(x, y, i) {
          let tr = document.createElement('tr'), td;
          tbody.appendChild(tr);

          td = document.createElement('td');
          tr.appendChild(td);
          let inputX = document.createElement('input');
          inputX.type = "text";
          inputX.value = x;
          inputX.addEventListener("change", () => {
            try {
              let x = +eval(inputX.value);
              inputX.value = x;
              line.coords[i][0] = x;
            } catch (e) {
              alert(`Error: ${e.message}`);
            }
          });
          td.appendChild(inputX);

          td = document.createElement('td');
          tr.appendChild(td);
          let inputY = document.createElement('input');
          inputY.type = "text";
          inputY.value = y;
          inputY.addEventListener("change", () => {
            try {
              let y = +eval(inputY.value);
              inputY.value = y;
              line.coords[i][1] = y;
            } catch (e) {
              alert(`Error: ${e.message}`);
            }
          });
          td.appendChild(inputY);

          let btnDel = document.createElement('button');
          btnDel.innerHTML = '&times';
          btnDel.title = 'Remove coordinate pair';
          btnDel.addEventListener('click', () => {
            line.coords.splice(i, 1);
            tr.remove();
          });

          td = document.createElement('td');
          td.appendChild(btnDel);
          tr.appendChild(td);
          return tr;
        }
        line.coords.forEach(([x, y], i) => tbody.appendChild(generateRow(x, y, i)));
        let tfoot = table.createTFoot(), tr = document.createElement('tr'), td = document.createElement('td');
        tfoot.appendChild(tr);
        tr.appendChild(td);
        let btnNew = document.createElement('button');
        btnNew.innerHTML = '+ Add';
        btnNew.addEventListener("click", () => {
          let coords = [0, 0];
          line.coords.push(coords);
          tbody.appendChild(generateRow(...coords, line.coords.length - 1));
        });
        td.appendChild(btnNew);
        break;
      }
      default:
        div.innerHTML = `<em><strong>Unknown line type ${line.type}</strong></em>`;
        return;
    }

    div.insertAdjacentHTML("beforeend", "<br>");
    let el = document.createElement("span");
    el.innerHTML = '<strong>Line Width</strong>: ';
    let inputLineWidth = document.createElement("input");
    inputLineWidth.type = "number";
    inputLineWidth.value = line.lineWidth ?? g.opts.lineWidth;
    inputLineWidth.addEventListener("change", () => line.lineWidth = +inputLineWidth.value);
    el.appendChild(inputLineWidth);
    div.appendChild(el);

    div.insertAdjacentHTML("beforeend", "<br>");
    el = document.createElement("span");
    el.innerHTML = '<strong>Join</strong>: ';
    let inputJoin = document.createElement("input");
    inputJoin.type = "checkbox";
    inputJoin.checked = line.join === undefined || line.join;
    inputJoin.addEventListener("change", () => line.join = inputJoin.checked);
    el.appendChild(inputJoin);
    div.appendChild(el);

    div.insertAdjacentHTML("beforeend", "<br>");
    el = document.createElement("span");
    el.innerHTML = '<strong>Color</strong>: ';
    let inputColor = document.createElement("input");
    inputColor.type = "color";
    inputColor.value = line.color;
    inputColor.addEventListener("change", () => line.color = inputColor.value);
    el.appendChild(inputColor);
    div.appendChild(el);

    if (btnType !== 0) {
      div.insertAdjacentHTML("beforeend", "<br>");
      let btn = document.createElement('button');
      if (btnType === 1) btn.innerText = 'Create Line';
      else if (btnType === 2) btn.innerText = 'Update Line';
      btn.addEventListener("click", () => callback(line));
      div.appendChild(btn);
    }
  }

  return popup;
}
//#endregion

//#region DISPLAY OPTIONS
const tdOpts = document.getElementById('td-1-1');
const divOpts = document.createElement('div');
tdOpts.appendChild(divOpts);

divOpts.insertAdjacentHTML('beforeend', 'View: ');

let btnViewDefault = document.createElement('button');
btnViewDefault.innerText = 'Default';
btnViewDefault.addEventListener('click', () => {
  g.opts = {};
  g.fixOpts();
  newCache = true;
  update = true;
});
divOpts.appendChild(btnViewDefault);

let btnViewTrig = document.createElement('button');
btnViewTrig.innerText = 'Trig';
btnViewTrig.title = 'Suitable scale for trigonometric functions';
btnViewTrig.addEventListener('click', () => {
  g.opts = initTrig();
  g.fixOpts();
  newCache = true;
  update = true;
});
divOpts.appendChild(btnViewTrig);

let btnViewSound = document.createElement('button');
btnViewSound.innerText = 'Sound';
btnViewSound.title = 'Suitable scale for sound-based functions';
btnViewSound.addEventListener('click', () => {
  g.opts = {
    ystart: 3,
    ystep: 1,
    ystepGap: 130,
    xstart: 0,
    xstep: 0.001,
    xstepGap: 50,
  };
  g.fixOpts();
  newCache = true;
  update = true;
});
divOpts.appendChild(btnViewSound);

let btnViewND = document.createElement('button');
btnViewND.innerText = 'Norm Dist';
btnViewND.title = 'Suitable scale for viewing normal distribution curve. Defines σ and μ constants.';
btnViewND.addEventListener('click', () => {
  try { K.σ } catch (e) { addConstant('σ', false, 'Standard Distribution', 1); }
  try { K.μ } catch (e) { addConstant('μ', false, 'Mean Value', 0); }
  g.opts = initBellCurve();
  g.fixOpts();
  newCache = true;
  update = true;
});
divOpts.appendChild(btnViewND);
divOpts.insertAdjacentHTML('beforeend', ' | ');

let btnConfig = document.createElement('button');
btnConfig.innerText = 'Config';
btnConfig.addEventListener('click', () => {
  const popup = generateConfigPopup();
  popup.setCloseCallback(() => {
    newCache = true;
    update = true;
  });
  popup.show();
});
divOpts.appendChild(btnConfig);

let btnForceUpdate = document.createElement('button');
btnForceUpdate.innerText = 'Update';
btnForceUpdate.title = 'Force sketch update';
btnForceUpdate.addEventListener('click', () => {
  newCache = true;
  update = true;
});
divOpts.appendChild(btnForceUpdate);

let btnSavedCurves = document.createElement('button');
btnSavedCurves.innerText = 'Curves';
btnSavedCurves.title = 'Show popup with collection of curve equations';
btnSavedCurves.addEventListener('click', () => {
  const popup = generateSavedCurvesPopup();
  popup.show();
});
divOpts.appendChild(btnSavedCurves);

let btnFuncs = document.createElement('button');
btnFuncs.innerText = 'Funcs';
btnFuncs.title = 'Show popup with all defined functions';
btnFuncs.addEventListener('click', () => {
  const popup = generateFunctionPopup();
  popup.show();
});
divOpts.appendChild(btnFuncs);

let btnPlayAllSounds = document.createElement('button');
btnPlayAllSounds.innerHTML = '&#128266;';
btnPlayAllSounds.title = 'Play all sounds (check all sound boxes)';
btnPlayAllSounds.addEventListener('click', playAllSounds);
divOpts.appendChild(btnPlayAllSounds);

const elFPSWrap = document.createElement('span');
divOpts.appendChild(elFPSWrap);
elFPSWrap.innerText = 'FPS: ';
const elFPS = document.createElement('code');
elFPSWrap.appendChild(elFPS);
//#endregion

//#region LINE TABLE HEADER
const table = document.createElement('table');
document.getElementById('td-2-1').appendChild(table);
table.insertAdjacentHTML('beforeend', '<tr><th>Line</th><th>Type</th><th>Color</th><th>Config</th><th>Options</th><th>Draw</th></tr>');
const tbody = table.createTBody();
//#endregion

//#region UPDATE LOOP
let update = false, newCache = true, doCache = true, cache, doTableUpdate = false, coords, graphCoords; // Update the canvas?
let updateOnMouseMove = true;
let fps = 0, lastCallTime = performance.now();
const fnDrawData = new Map(); // Map line IDs to the corresponding sketch info
window.fnDrawData = fnDrawData;
(function loop() {
  let now = performance.now();
  fps = 1000 / (now - lastCallTime);
  lastCallTime = now;
  elFPS.innerText = fps.toFixed(1);
  if (update) {
    if (doTableUpdate) { updateTable(); doTableUpdate = false; }
    g.clear();
    // Load cache
    if (!doCache || newCache) {
      g.sketch(); // Sketch lines
      g.getLines().forEach(id => { // Error messages?
        const line = g.getLine(id), el = lineErrorEls.get(id);
        if (line.error) {
          el.hidden = false;
          el.title = line.emsg;
        } else {
          el.hidden = true;
          el.removeAttribute('title');
        }
      });
      // Sketch things in fnDrawData
      fnDrawData.forEach((data, id) => {
        const line = g.getLine(id);
        if (line.draw) {
          const R = 4;
          if (data.yInt) {
            data.yInt_cache.forEach(([x, y]) => circle(g.ctx, ...g.getCoordinates(x, y), R, line.color));
          }
          if (data.roots) {
            data.roots_cache.forEach(([x, y]) => circle(g.ctx, ...g.getCoordinates(x, y), R, line.color));
          }
          if (data.turning) {
            data.turning_cache.forEach(([x, y]) => circle(g.ctx, ...g.getCoordinates(x, y), R, line.color));
          }
          if (data.int !== undefined) {
            data.int_cache.forEach(([x, y]) => circle(g.ctx, ...g.getCoordinates(x, y), R, line.color));
          }
          if (data.xCoords !== undefined) {
            data.xCoords_cache.forEach(([x, y]) => circle(g.ctx, ...g.getCoordinates(x, y), R, line.color));
          }
          if (data.yCoords !== undefined) {
            data.yCoords_cache.forEach(([x, y]) => circle(g.ctx, ...g.getCoordinates(x, y), R, line.color));
          }
          if (data.asys !== undefined) {
            g.ctx.setLineDash([5, 3]);
            g.ctx.lineWidth = 1;
            data.asys_cache.x.forEach(x => {
              const coords = g.getCoordinates(x, 0);
              g.ctx.beginPath();
              g.ctx.moveTo(coords[0], 0);
              g.ctx.lineTo(coords[0], g.canvas.height);
              g.ctx.stroke();
              g.ctx.fillText(g.opts.xstepLabel ? g.opts.xstepLabel(x) : x.toPrecision(g.opts.labelPrecision), coords[0] + 5, coords[1] - 5);
            });
            data.asys_cache.y.forEach(y => {
              const coords = g.getCoordinates(0, y);
              g.ctx.beginPath();
              g.ctx.moveTo(0, coords[1]);
              g.ctx.lineTo(g.canvas.width, coords[1]);
              g.ctx.stroke();
              g.ctx.fillText(g.opts.xstepLabel ? g.opts.xstepLabel(y) : y.toPrecision(g.opts.labelPrecision), coords[0] + 5, coords[1] - 5);
            });
            g.ctx.setLineDash([]);
          }
        }
      });

      cache = g.ctx.getImageData(0, 0, g.width, g.height); // Save canvas
      newCache = false;
    } else {
      g.ctx.putImageData(cache, 0, 0);
    }
    // Show current coordinates and trace
    if (coords && graphCoords) {
      if (SHOW_COORDS) {
        circle(g.ctx, ...coords, 2, 'black');
        g.ctx.font = '11px Arial';
        g.ctx.fillText(`(${round(graphCoords[0], 2)}, ${round(graphCoords[1], 2)})`, coords[0] + 5, coords[1] - 5);
      }
      const originCoords = g.getCoordinates(0, 0);

      fnDrawData.forEach((data, id) => {
        if (data.traceX || data.traceY) {
          const line = g.getLine(id);
          const TEXT_OFF = 5;
          if (line.draw) {
            if (data.traceX) {
              const xstep = Math.abs(line.coords[1][0] - line.coords[0][0]) * 2;
              const online = getCorrepondingCoordinateIndex(graphCoords[0], 'x', line.coords, true, DP_ACCURACY);
              g.ctx.lineWidth = 1;
              online.forEach((i) => {
                g.ctx.save();
                const [x, y] = line.coords[i];
                if (Math.abs(x - graphCoords[0]) > xstep) return;
                const lineCoords = g.getCoordinates(x, y);
                g.ctx.beginPath();
                g.ctx.moveTo(originCoords[0], coords[1]);
                g.ctx.lineTo(...coords);
                g.ctx.lineTo(...lineCoords);
                g.ctx.stroke();
                circle(g.ctx, originCoords[0], coords[1], 4);
                circle(g.ctx, ...lineCoords, 4, line.color);
                g.ctx.fillStyle = line.color;
                g.ctx.fillText(y.toFixed(3), lineCoords[0] + TEXT_OFF, lineCoords[1] - TEXT_OFF);

                if (data.tangent) {
                  let [nx, ny] = line.coords[i + 1] ?? line.coords[i - 1];
                  let m = (ny - y) / (nx - x);
                  let x1 = x - g.opts.xstep / 2, x2 = nx + g.opts.xstep / 2;
                  let y1 = m * (x1 - x) + y, y2 = m * (x2 - nx) + ny;
                  g.ctx.beginPath();
                  g.ctx.strokeStyle = 'red';
                  g.ctx.moveTo(...g.getCoordinates(x1, y1));
                  g.ctx.lineTo(...g.getCoordinates(x2, y2));
                  g.ctx.stroke();
                  g.ctx.fillStyle = 'red';
                  g.ctx.fillText('m=' + m.toFixed(2), lineCoords[0] + TEXT_OFF, lineCoords[1] + TEXT_OFF);
                }
                g.ctx.restore();
              });
            }
            if (data.traceY) {
              const ystep = Math.abs(line.coords[1][1] - line.coords[0][1]) * 5;
              const online = getCorrepondingCoordinateIndex(graphCoords[1], 'y', line.coords, true, DP_ACCURACY);
              g.ctx.lineWidth = 1;
              online.forEach(i => {
                g.ctx.save();
                const [x, y] = line.coords[i];
                if (Math.abs(y - graphCoords[1]) > ystep) return;
                const lineCoords = g.getCoordinates(x, y);
                g.ctx.beginPath();
                g.ctx.moveTo(coords[0], originCoords[1]);
                g.ctx.lineTo(...coords);
                g.ctx.lineTo(...lineCoords);
                g.ctx.stroke();
                circle(g.ctx, coords[0], originCoords[1], 4);
                circle(g.ctx, ...lineCoords, 4, line.color);
                g.ctx.fillStyle = line.color;
                g.ctx.fillText(x.toFixed(3), lineCoords[0] + 5, lineCoords[1] - 5);

                if (data.tangent) {
                  let [nx, ny] = line.coords[i + 1] ?? line.coords[i - 1];
                  let m = (ny - y) / (nx - x);
                  // let x1 = x - g.opts.xstep, x2 = nx + g.opts.xstep ;
                  // let y1 = m * (x1 - x) + y, y2 = m * (x2 - nx) + ny;
                  let y1 = y - g.opts.ystep / 2, y2 = ny + g.opts.ystep / 2;
                  let x1 = (y1 - y + m * x) / m, x2 = (y2 - ny + m * nx) / m;
                  g.ctx.beginPath();
                  g.ctx.strokeStyle = 'red';
                  g.ctx.moveTo(...g.getCoordinates(x1, y1));
                  g.ctx.lineTo(...g.getCoordinates(x2, y2));
                  g.ctx.stroke();
                  g.ctx.fillStyle = 'red';
                  g.ctx.fillText('m=' + m.toFixed(2), lineCoords[0] + TEXT_OFF, lineCoords[1] + TEXT_OFF);
                }
                g.ctx.restore();
              });
            }
          }
        }
      });
    }
    update = false;
  }
  requestAnimationFrame(loop);
})();
//#endregion

//#region CONSTANT TABLE
const constants = new Map(); // constant: string => { value: number, range: boolean, min: number, max: number, step: number }
globalThis.K = new Proxy({}, {
  get(t, p) {
    if (p === 'rand') return Math.random();
    if (constants.has(p)) return constants.get(p).value;
    throw new Error(`Unknown constant ${p}`);
  },
  set(t, p, v) {
    if (constants.has(p)) {
      constants.get(p).value = +v;
      return +v;
    } else {
      constants.set(p, { value: +v, range: false });
      return +v;
    }
  }
});
globalThis.F = new Proxy({}, {
  get(t, p) {
    let line = g.getLine(+p);
    if (!line) throw new Error(`Unknown function ${p}`);
    return x => line.fn(x);
  },
  set(t, p, v) {
    throw new Error(`Cannot set coordinates ${v} of ${p}`);
  }
});
globalThis.Fx = new Proxy({}, {
  get(t, p) {
    let line = g.getLine(+p);
    if (!line) throw new Error(`Unknown function ${p}`);
    if (!line.coords || line.coords.length === 0) throw new Error(`Function ${p} has not been sketched`);
    return x => getCorrespondingCoordinate(x, 'x', line.coords, false, undefined);
  },
  set(t, p, v) {
    throw new Error(`Cannot set coordinates ${v} of ${p}`);
  }
});
globalThis.Fy = new Proxy({}, {
  get(t, p) {
    let line = g.getLine(+p);
    if (!line) throw new Error(`Unknown function ${p}`);
    if (!line.coords || line.coords.length === 0) throw new Error(`Function ${p} has not been sketched`);
    return y => getCorrespondingCoordinate(y, 'y', line.coords, false, undefined);
  },
  set(t, p, v) {
    throw new Error(`Cannot set coordinates ${v} of ${p}`);
  }
});
const klist = document.createElement("ul");
document.getElementById('td-1-2').appendChild(klist);
updateKList();
function updateKList() {
  klist.innerHTML = '';
  let h3 = document.createElement("h3");
  h3.innerText = 'Constants ';
  klist.appendChild(h3);
  let btn = document.createElement("button");
  h3.appendChild(btn);
  btn.innerHTML = '&plus; Define New';
  btn.addEventListener('click', () => addConstant());
  constants.forEach((obj, constant) => {
    let li = document.createElement("li");
    klist.appendChild(li);
    li.insertAdjacentHTML('beforeend', `<strong><var>${constant}</var></strong>: `);
    let input = document.createElement("input");
    if (obj.range) {
      input.type = 'range';
      input.min = obj.min;
      input.max = obj.max;
      input.step = obj.step;
      input.addEventListener('input', () => {
        obj.value = +input.value;
        newCache = true;
        update = true;
      });
    } else {
      input.type = 'number';
      input.addEventListener('change', () => {
        obj.value = +input.value;
        newCache = true;
        update = true;
      });
    }
    input.value = +obj.value;
    li.appendChild(input);
    if (obj.range) {
      let vspan = document.createElement('span');
      vspan.innerText = input.value;
      li.appendChild(vspan);
      input.addEventListener('input', () => vspan.innerText = input.value);
    }
    li.insertAdjacentHTML('beforeend', `&nbsp; &nbsp; <em><abbr title='To retrieve value, type K.${constant}'>[?]</abbr></em> &nbsp;`);
    let del = document.createElement('button');
    del.innerHTML = 'Del';
    del.addEventListener('click', () => {
      constants.delete(constant);
      updateKList();
      newCache = true;
      update = true;
    });
    li.appendChild(del);
  });
}
function addConstant(name = undefined, isRange = undefined, info = undefined, value = undefined) {
  name = name ?? prompt("Constant Name");
  if (name) {
    let obj = { value: value ?? 0 };
    if (constants.has(name)) return alert("Constant " + name + " already exists");
    isRange = isRange === undefined ? confirm("Should the input method be a range slider?") : !!isRange;
    if (isRange) {
      obj.range = true;
      if (info === undefined) {
        info = prompt(`Please enter the min, max and step values for the slider\nFormat: <min>, <max>, <step>`, '-10, 10, 1');
        info = info.split(',').map(n => eval(n));
      }
      obj.min = +info[0];
      obj.max = +info[1];
      obj.step = +(info[2] ?? 1);
    } else {
      obj.range = false;
    }
    constants.set(name, obj);
    updateKList();
  }
}
//#endregion

//#region EVENTS
let dragging = false, dragData; // dragData -> record actual position, and canvas position
g.addEvents({
  mousemove(e, onupdate) {
    coords = extractCoords(e);
    graphCoords = g.fromCoordinates(...coords);
    if (updateOnMouseMove) onupdate();

    if (dragging) {
      g.opts.xstart -= graphCoords[0] - dragData.apos[0];
      g.opts.ystart -= graphCoords[1] - dragData.apos[1];
      newCache = true;
      onupdate();
    }
  },
  mousedown(e, onupdate) {
    dragging = true;
    dragData = { pos: extractCoords(e) };
    dragData.apos = g.fromCoordinates(...dragData.pos);
  },
  mouseup(e, onupdate) {
    dragging = false;
    dragData = undefined;
    newCache = true;
    onupdate();
  },
  wheel(e, onupdate) {
    let k = e.deltaY < 0 ? 1.1 : 0.9;
    e.preventDefault();
    g.opts.ystepGap *= k;
    g.opts.xstepGap *= k;
    newCache = true;
    onupdate();
  }
}, () => (update = true));
//#endregion

//#region LINE TABLE
const lineErrorEls = new Map(), soundInputs = [];
function playAllSounds() {
  soundInputs.forEach(inp => inp.click());
}
function updateTable() {
  soundInputs.length = 0;
  tbody.innerHTML = '';
  lineErrorEls.clear();
  g.getLines().forEach(id => {
    const line = g.getLine(id), sketchData = fnDrawData.get(id), tr = document.createElement('tr');
    tbody.appendChild(tr);

    // LINE ID
    let td = document.createElement('td');
    tr.appendChild(td);
    let errEl = document.createElement('span');
    errEl.classList.add('err-sym');
    errEl.innerHTML = '&#9888;';
    errEl.hidden = true;
    lineErrorEls.set(id, errEl);
    td.appendChild(errEl);
    td.insertAdjacentHTML('beforeend', ` <strong>${id}</strong>`);

    // LINE TYPE
    tr.insertAdjacentHTML('beforeend', `<td><abbr title='${LINE_DESCRIPTIONS[line.type]}'>${line.type}</abbr></td>`);

    // LINE COLOR
    tr.insertAdjacentHTML('beforeend', `<td style='background-color:${line.color ?? 'black'}'></td>`);

    // LINE CONFIG
    td = document.createElement('td');
    let btnPopup = document.createElement('button');
    btnPopup.innerHTML = '&#9998;';
    btnPopup.title = 'Edit';
    btnPopup.addEventListener('click', () => {
      const popup = generateNewLinePopup(() => {
        popup.hide();
        update = true;
        newCache = true;
        doTableUpdate = true;
      }, line);
      popup.show();
    });
    td.appendChild(btnPopup);

    if (line.type === 'i') {
      td.insertAdjacentHTML('beforeend', `&int;(${line.id}), <abbr title='Integration constant'>&Cscr;</abbr> = `);
      let input = document.createElement('input');
      input.type = 'number';
      input.value = line.C;
      input.addEventListener('change', () => {
        line.C = +input.value;
        newCache = true;
        update = true;
      });
      td.appendChild(input);
    } else if (line.type === 'd') {
      td.insertAdjacentHTML('beforeend', `d/dx(${line.id})`);
    } else if (line.type === 't') {
      td.insertAdjacentHTML('beforeend', ` &theta; = `);
      const rotValue = document.createElement('span');
      const displayRadians = theta => rotValue.innerHTML = `<abbr title='${theta} rad'>${round(theta / Math.PI, 3)}&pi;</abbr>`;
      td.appendChild(rotValue);

      let rotSlider = document.createElement('input');
      rotSlider.type = 'range';
      rotSlider.value = line.C[4];
      rotSlider.title = 'Rotate function <x> radians (-2pi to 2pi)';
      rotSlider.step = 0.001 * Math.PI;
      rotSlider.min = -2 * Math.PI;
      rotSlider.max = 2 * Math.PI;
      rotSlider.addEventListener('input', e => {
        const theta = +e.target.value;
        displayRadians(theta);
        line.C[4] = theta;
        newCache = true;
        update = true;
      });
      td.appendChild(rotSlider);
      displayRadians(line.C[4]);
    }
    tr.appendChild(td);

    td = document.createElement('td');
    tr.appendChild(td);

    let btn = document.createElement('button');
    btn.innerText = 'd/dx';
    btn.title = 'Sketch gradient curve of this fuction';
    btn.addEventListener('click', () => {
      addLine({ type: 'd', id });
      newCache = true;
      update = true;
      doTableUpdate = true;
    });
    td.appendChild(btn);

    btn = document.createElement('button');
    btn.innerHTML = '&int;dx';
    btn.title = 'Sketch integrand curve of this fuction (assumc C=0)';
    btn.addEventListener('click', () => {
      addLine({ type: 'i', id });
      newCache = true;
      update = true;
      doTableUpdate = true;
    });
    td.appendChild(btn);

    btn = document.createElement('button');
    btn.innerHTML = '&#8469;';
    btn.title = 'View plotted points in a table';
    btn.addEventListener('click', () => {
      const win = window.open('about:blank');
      win.document.title = `Coordinates for ${id}`;
      win.document.body.insertAdjacentHTML('beforeend', `<h1>Table of Coordinates</h1>`);
      win.document.body.insertAdjacentHTML('beforeend', `<p>Line <code>${id}</code></p>`);
      const btnCSV = win.document.createElement('button');
      btnCSV.innerText = 'As CSV';
      btnCSV.addEventListener("click", () => {
        let csv = line.coords.map(([x, y]) => x + ',' + y).join('\n');
        downloadTextFile(csv, `fn-${line.type}-${id}.csv`);
      });
      win.document.body.appendChild(btnCSV);

      const table = win.document.createElement('table');
      table.insertAdjacentHTML("beforeend", "<thead><tr><th>&Xscr;</th><th>&Yscr;</th></tr></thead>");
      const tbody = table.createTBody();
      win.document.body.appendChild(table);
      line.coords.forEach(([x, y]) => tbody.insertAdjacentHTML('beforeend', `<tr><td>${x}</td><td>${y}</td></tr>`));
    });
    td.appendChild(btn);

    btn = document.createElement('button');
    btn.innerHTML = '&Yscr;-Int';
    btn.title = 'Calculate approx. Y-intercepts';
    btn.addEventListener('click', () => {
      const yIntercepts = g.getAxisIntercept(id, 'y');
      const win = window.open('about:blank');
      win.document.title = `Y-Intercepts for ${id}`;
      win.document.body.insertAdjacentHTML('beforeend', `<h1>Approximate Y-Intercepts</h1>`);
      win.document.body.insertAdjacentHTML('beforeend', `<p>Line <code>${id}</code></p>`);
      const ul = win.document.createElement('ul');
      win.document.body.appendChild(ul);
      yIntercepts.forEach(([x, y]) => ul.insertAdjacentHTML('beforeend', `<li><kbd>(${x}, <b>${y}</b>)</kbd></li>`));
    });
    td.appendChild(btn);
    let input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = sketchData.yInt;
    input.title = 'Sketch Y-Intercepts';
    input.addEventListener('change', e => {
      const data = fnDrawData.get(id);
      if (e.target.checked) {
        data.yInt = true;
        data.yInt_cache = g.getAxisIntercept(id, 'y');
      } else {
        delete data.yInt;
        delete data.yInt_cache;
      }
      newCache = true;
      update = true;
    });
    td.appendChild(input);

    btn = document.createElement('button');
    btn.innerHTML = 'Int';
    btn.title = 'Calculate approx. intercepts with another line';
    btn.addEventListener('click', () => {
      let oid = prompt(`ID of line to intercept with`);
      if (!oid) return;
      let otherLine = g.getLine(+oid);
      if (!otherLine) return alert(`Line ID ${oid} does not exist`);
      const intercepts = g.getIntercepts(line.coords, otherLine.coords, 3);
      const win = window.open('about:blank');
      win.document.title = `Intercepts for ${id} and ${oid}`;
      win.document.body.insertAdjacentHTML('beforeend', `<h1>Approximate Y-Intercepts</h1>`);
      win.document.body.insertAdjacentHTML('beforeend', `<p>Line <code>${id}</code> and <code>${oid}</code></p>`);
      const ul = win.document.createElement('ul');
      win.document.body.appendChild(ul);
      intercepts.forEach(([x, y]) => ul.insertAdjacentHTML('beforeend', `<li><kbd>(${x}, ${y})</kbd></li>`));
    });
    td.appendChild(btn);
    input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = sketchData.int !== undefined;
    input.title = 'Sketch intercepts with another line';
    input.addEventListener('change', e => {
      const data = fnDrawData.get(id);
      if (e.target.checked) {
        const oid = prompt(`ID of line to intercept with`);
        if (!oid) return;
        const oline = g.getLine(+oid);
        if (!oline) return alert(`Line ID ${oid} does not exist`);

        data.int = oid;
        data.int_cache = g.getIntercepts(line.coords, oline.coords, 3);
      } else {
        delete data.int;
        delete data.int_cache;
      }
      newCache = true;
      update = true;
    });
    td.appendChild(input);

    btn = document.createElement('button');
    btn.innerHTML = 'Roots';
    btn.title = 'Calculate approx. roots';
    btn.addEventListener('click', () => {
      const roots = g.getAxisIntercept(id, 'x');
      const win = window.open('about:blank');
      win.document.title = `Roots for ${id}`;
      win.document.body.insertAdjacentHTML('beforeend', `<h1>Approximate Roots</h1>`);
      win.document.body.insertAdjacentHTML('beforeend', `<p>Line <code>${id}</code></p>`);
      const ul = win.document.createElement('ul');
      win.document.body.appendChild(ul);
      roots.forEach(([x, y]) => ul.insertAdjacentHTML('beforeend', `<li><kbd>(<b>${x}</b>, ${y})</kbd></li>`));
    });
    td.appendChild(btn);
    input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = sketchData.roots;
    input.title = 'Sketch roots';
    input.addEventListener('change', e => {
      const data = fnDrawData.get(id);
      if (e.target.checked) {
        data.roots = true;
        data.roots_cache = g.getAxisIntercept(id, 'x');
      } else {
        delete data.roots;
        delete data.roots_cache;
      }
      newCache = true;
      update = true;
    });
    td.appendChild(input);

    btn = document.createElement('button');
    btn.innerHTML = 'Turning';
    btn.title = 'Calculate approx. turning points';
    btn.addEventListener('click', () => {
      const tpts = g.getTurningPoints(id);
      const win = window.open('about:blank');
      win.document.title = `Turning Points for ${id}`;
      win.document.body.insertAdjacentHTML('beforeend', `<h1>Approximate Turning Points</h1>`);
      win.document.body.insertAdjacentHTML('beforeend', `<p>Line <code>${id}</code></p>`);
      const ul = win.document.createElement('ul');
      win.document.body.appendChild(ul);
      tpts.forEach(([x, y]) => ul.insertAdjacentHTML('beforeend', `<li><kbd>(${x}, ${y})</kbd></li>`));
    });
    td.appendChild(btn);
    input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = sketchData.turning;
    input.title = 'Sketch turning points';
    input.addEventListener('change', e => {
      const data = fnDrawData.get(id);
      if (e.target.checked) {
        data.turning = true;
        data.turning_cache = g.getTurningPoints(id);
      } else {
        delete data.turning;
        delete data.turning_cache;
      }
      newCache = true;
      update = true;
    });
    td.appendChild(input);

    btn = document.createElement('button');
    btn.innerHTML = 'Asy';
    btn.title = 'Calculate approx. asymptotes';
    btn.addEventListener('click', () => {
      const asys = g.getAsymptotes(id);
      const win = window.open('about:blank');
      win.document.title = `Asymptotes for ${id}`;
      win.document.body.insertAdjacentHTML('beforeend', `<h1>Approximate Asymptotes</h1>`);
      win.document.body.insertAdjacentHTML('beforeend', `<p>Line <code>${id}</code></p>`);
      win.document.body.insertAdjacentHTML('beforeend', `<h2>&Xscr;-Asymptotes</h2>`);
      let ul = win.document.createElement('ul');
      win.document.body.appendChild(ul);
      asys.x.forEach(x => ul.insertAdjacentHTML('beforeend', `<li><kbd>${x}</kbd></li>`));
      win.document.body.insertAdjacentHTML('beforeend', `<h2>&Yscr;-Asymptotes</h2>`);
      ul = win.document.createElement('ul');
      win.document.body.appendChild(ul);
      asys.y.forEach(y => ul.insertAdjacentHTML('beforeend', `<li><kbd>${y}</kbd></li>`));
    });
    td.appendChild(btn);
    input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = sketchData.turning;
    input.title = 'Display asymptotes';
    input.addEventListener('change', e => {
      const data = fnDrawData.get(id);
      if (e.target.checked) {
        data.asys = true;
        data.asys_cache = g.getAsymptotes(id);
      } else {
        delete data.asys;
        delete data.asys_cache;
      }
      newCache = true;
      update = true;
    });
    td.appendChild(input);

    btn = document.createElement('button');
    btn.innerHTML = '&int;<span class="sub-sup"><sup>b</sup><sub>a</sub></span>&nbsp;&nbsp;&nbsp;dx';
    btn.title = 'Integrate between limits (find area under curve)';
    btn.addEventListener('click', () => {
      let bounds = prompt(`Find area under curve between bounds\nFormat: <a>, <b>`, '0, 1');
      if (bounds) {
        let [a, b] = bounds.split(',').map(n => eval(n));
        if (b < a) return alert(`Invalid bound relationship`);
        let area = g.getArea(line.coords, a, b);
        if (area === undefined) alert(`Area ${a}-${b} is undefined`);
        if (isNaN(area)) alert(`Unable to calculate area ${a}-${b}`);
        else alert(area);
      }
    });
    td.appendChild(btn);

    // btn = document.createElement('button');
    // btn.innerHTML = `&mu;`;
    // btn.title = 'Mean coordinate of curve';
    // btn.addEventListener('click', () => {
    //   let mx = 0, my = 0;
    //   let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    //   for (const coord of line.coords) {
    //     mx += coord[0];
    //     if (coord[0] < minx) minx = coord[0];
    //     else if (coord[0] > maxx) maxx = coord[0];
    //     my += coord[1];
    //     if (coord[1] < miny) miny = coord[1];
    //     else if (coord[1] > maxy) maxy = coord[1];
    //   }
    //   const data = fnDrawData.get(id);
    //   data.yInt = 1;
    //   data.yInt_cache = [[mx / (maxx - minx), my / (maxy - miny)]];
    // });
    // td.appendChild(btn);

    btn = document.createElement('button');
    btn.innerHTML = '&Xscr;';
    btn.title = 'Calculate coords with the given X-coordinate';
    btn.addEventListener('click', () => {
      let x = prompt(`X-Coordinate`);
      if (!x) return;
      x = eval(x);
      const coords = getCorrespondingCoordinate(x, 'x', line.coords, true);
      const win = window.open('about:blank');
      win.document.title = `Coordinates for ${id}`;
      win.document.body.insertAdjacentHTML('beforeend', `<h1>&Xscr;-Coordinates of line ${id}</h1>`);
      win.document.body.insertAdjacentHTML('beforeend', `<p>&Xscr; = ${x}</p>`);
      const ul = win.document.createElement('ul');
      win.document.body.appendChild(ul);
      coords.forEach(([x, y]) => ul.insertAdjacentHTML('beforeend', `<li><kbd>(${x}, <strong>${y}</strong>)</kbd></li>`));
    });
    td.appendChild(btn);
    input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', e => {
      const data = fnDrawData.get(id);
      if (e.target.checked) {
        let x = prompt(`X-Coordinate`);
        if (!x) return;
        x = eval(x);

        data.xCoords = true;
        data.xCoords_cache = getCorrespondingCoordinate(x, 'x', line.coords, true);
      } else {
        delete data.xCoords;
        delete data.xCoords_cache;
      }
      newCache = true;
      update = true;
    });
    td.appendChild(input);

    btn = document.createElement('button');
    btn.innerHTML = '&Yscr;';
    btn.title = 'Calculate coords with the given Y-coordinate';
    btn.addEventListener('click', () => {
      let y = prompt(`Y-Coordinate`);
      if (!y) return;
      y = eval(y);
      const coords = getCorrespondingCoordinate(y, 'y', line.coords, true, DP_ACCURACY);
      const win = window.open('about:blank');
      win.document.title = `Coordinates for ${id}`;
      win.document.body.insertAdjacentHTML('beforeend', `<h1>&Yscr;-Coordinates of line ${id}</h1>`);
      win.document.body.insertAdjacentHTML('beforeend', `<p>&Yscr; = ${y}</p>`);
      const ul = win.document.createElement('ul');
      win.document.body.appendChild(ul);
      coords.forEach(([x, y]) => ul.insertAdjacentHTML('beforeend', `<li><kbd>(<strong>${x}</strong>, ${y})</kbd></li>`));
    });
    td.appendChild(btn);
    input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', e => {
      const data = fnDrawData.get(id);
      if (e.target.checked) {
        let y = prompt(`Y-Coordinate`);
        if (!y) return;
        y = eval(y);

        data.yCoords = true;
        data.yCoords_cache = getCorrespondingCoordinate(y, 'y', line.coords, true, DP_ACCURACY);
      } else {
        delete data.yCoords;
        delete data.yCoords_cache;
      }
      newCache = true;
      update = true;
    });
    td.appendChild(input);

    td.insertAdjacentHTML('beforeend', 'TrX ');
    let inputTrX = document.createElement('input');
    inputTrX.type = 'checkbox';
    inputTrX.checked = sketchData.traceX;
    inputTrX.title = 'Show current x-coordinate intercept with function';
    inputTrX.addEventListener('change', e => {
      const data = fnDrawData.get(id);
      if (e.target.checked) {
        data.traceX = true;
      } else {
        delete data.traceX;
      }
      newCache = true;
      update = true;
    });
    td.appendChild(inputTrX);
    td.insertAdjacentHTML('beforeend', 'TrY ');
    let inputTrY = document.createElement('input');
    inputTrY.type = 'checkbox';
    inputTrY.checked = sketchData.traceY;
    inputTrY.title = 'Show current y-coordinate intercept with function';
    inputTrY.addEventListener('change', e => {
      const data = fnDrawData.get(id);
      if (e.target.checked) {
        data.traceY = true;
      } else {
        delete data.traceY;
      }
      newCache = true;
      update = true;
    });
    td.appendChild(inputTrY);

    td.insertAdjacentHTML('beforeend', 'Tgt ');
    let inputTangent = document.createElement('input');
    inputTangent.type = 'checkbox';
    inputTangent.checked = sketchData.tangent;
    inputTangent.title = 'Draw tangent to curve at current x';
    inputTangent.addEventListener('change', e => {
      const data = fnDrawData.get(id);
      if (e.target.checked) {
        data.tangent = true;
      } else {
        delete data.tangent;
      }
      newCache = true;
      update = true;
    });
    td.appendChild(inputTangent);

    td.insertAdjacentHTML("beforeend", "<abbr title='Play function as sound'>&#x1f50a;</abbr> ");
    input = document.createElement('input');
    input.type = 'checkbox';
    let audioContext, source;
    soundInputs.push(input);
    input.addEventListener('change', e => {
      if (e.target.checked) {
        const o = getAudioFromCoords(line.coords, soundDurMult, soundMultiplier);
        audioContext = o.audioContext;
        source = o.source;
        source.loop = soundLoop;
        source.start();
        source.onended = () => {
          e.target.checked = false;
          source = undefined;
          audioContext = undefined;
        };
      } else {
        // source.loop = false;
        source.stop();
      }
    });
    td.appendChild(input);

    btn = document.createElement('button');
    btn.innerText = 'Copy';
    btn.addEventListener('click', () => {
      addLine({ ...line });
      update = true;
      newCache = true;
      doTableUpdate = true;
    });
    td.appendChild(btn);

    btn = document.createElement('button');
    btn.innerText = 'Del';
    btn.addEventListener('click', () => {
      removeLine(id);
      update = true;
      newCache = true;
      doTableUpdate = true;
    });
    td.appendChild(btn);

    td = document.createElement('td');
    tr.appendChild(td);
    input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = line.draw === undefined || line.draw;
    input.addEventListener('change', e => {
      line.draw = e.target.checked;
      newCache = true;
      update = true;
    });
    td.appendChild(input);
  });

  let tr = document.createElement('tr');
  tbody.appendChild(tr);
  let td = document.createElement('td');
  tr.appendChild(td);
  td.colSpan = 100;
  let btn = document.createElement('button');
  btn.innerHTML = '&plus; New Line';
  btn.addEventListener('click', () => {
    const popup = generateNewLinePopup(data => {
      popup.hide();
      addLine(data);
      newCache = true;
      update = true;
      doTableUpdate = true;
    });
    popup.show();
  });
  td.appendChild(btn);
}
//#endregion

//#region FUNCTIONS
// Create line object
function createLine(type = undefined, value = undefined, arg = undefined, properties = {}) {
  type = type ?? prompt('Line type', 'x');
  if (type == null) return false;
  const data = { type };
  if (type === 'd' || type === 'i') {
    let id = value ?? prompt(`Enter ID of line`);
    if (id === null) return;
    data.id = +id;
  } else if (type === 'sc' || type === 'sh') {
    let id = value ?? prompt(`Enter ID of line`);
    if (id === null) return;
    data.id = +id;
    if (arg) {
      data.C = arg;
    } else {
      arg = prompt(`Enter constant`, '1');
      if (arg === null) arg = 1;
      else arg = eval(arg);
      data.C = arg;
    }
  } else if (type === 'e') {
    data.lhsRaw = value[0];
    data.lhs = Function('x', 'y', 'return ' + data.lhsRaw);
    data.rhsRaw = value[1];
    data.rhs = Function('x', 'y', 'return ' + data.rhsRaw);
  } else if (type === 'a' || type === 's' || type === 'm') {
    if (value) {
      data.ids = value;
    } else {
      let ids = value ?? prompt(`Enter comma-seperated list of line IDs`);
      if (ids === null) return;
      ids = ids.split(',').map(id => +id);
      data.ids = ids;
    }
  } else if (type === 't') {
    data.id = value ?? parseInt(prompt(`Enter line ID`));
    if (arg) {
      data.C = arg;
    } else {
      let str = prompt(`Enter values: scale_x, shift_x, scale_y, shift_y, rotation [radians]`, '1, 0, 1, 0, Math.PI');
      str = str.split(',').map(n => +eval(n));
      data.C = str;
    }
  } else if (type === 'p') {
    if (!value) {
      value = [
        prompt(`Enter function for x-coordinate\nf(${type}) = ...`, type) ?? type,
        prompt(`Enter function for y-coordinate\nf(${type}) = ...`, type) ?? type,
      ];
    }
    data.fnxRaw = value[0];
    data.fnx = Function(type, 'return ' + data.fnxRaw);
    data.fnyRaw = value[1];
    data.fny = Function(type, 'return ' + data.fnyRaw);

    if (!arg) {
      arg = prompt(`Enter min / max value for parameter p\nFormat: <min>, <max>`, '0, 1');
      if (arg === 'x' || arg === 'y' || arg === 'a') data.range = arg;
      else data.range = arg.split(',').map(n => eval(n));
    } else {
      data.range = arg;
    }
  } else if (type === 'c') {
    data.coords = value;
  } else {
    let fnRaw = value ?? prompt(`Enter function of line\nf(${type}) = ...`);
    if (!fnRaw) return;
    data.fnRaw = fnRaw;
    data.fn = Function(type, 'return ' + fnRaw);
  }
  for (let prop in properties) data[prop] = properties[prop];
  return data;
}

// Add line object to graph
function addLine(data) {
  const id = g.addLine(data);
  fnDrawData.set(id, {});
  return id;
}

// Remove line object from graph
function removeLine(id) {
  let ok = g.removeLine(id);
  if (ok) fnDrawData.delete(id);
  return ok;
}

function initTrig() {
  return {
    ystart: 2,
    ystep: 0.5,
    xstart: -2 * Math.PI - 0.5,
    xstep: Math.PI / 2,
    xstepLabel: n => round(n / Math.PI, 1) + 'π',
  };
}

function initBellCurve() {
  return {
    xstart: K.μ - 4.5 * K.σ,
    xstep: K.σ,
    xstepLabel: n => {
      let v = round((n - K.μ) / K.σ, 1);
      let sgn = Math.sign(v) === -1 ? '-' : '+';
      if (v === 0) return K.μ === 0 ? '0' : 'μ';
      v = Math.abs(v);
      v = (sgn === '+' && K.μ === 0 ? '' : sgn) + (v === 1 ? '' : v);
      return (K.μ === 0 ? '' : 'μ') + v + 'σ';
    },
    ystart: 1.1,
    ystep: 0.2,
    subGridDivs: 5,
  };
}
//#endregion

//#region SETUP VARS AND FUNCS
globalThis.e = Math.E;
globalThis.pi = Math.PI;

addInternalFunc('pow', Math.pow);
addInternalFunc('abs', Math.abs);
addInternalFunc('round', round);
addInternalFunc('floor', Math.floor);
addInternalFunc('ceil', Math.ceil);
addInternalFunc('sgn', Math.sign);
addInternalFunc('sqrt', Math.sqrt);
addInternalFunc('exp', Math.exp);
addInternalFunc('sin', Math.sin);
addInternalFunc('arcsin', Math.asin);
addInternalFunc('sinh', Math.sinh);
addInternalFunc('arcsinh', Math.asinh);
addInternalFunc('csc', n => 1 / Math.sin(n));
addInternalFunc('cos', Math.cos);
addInternalFunc('arccos', Math.acos);
addInternalFunc('cosh', Math.cosh);
addInternalFunc('arccosh', Math.acosh);
addInternalFunc('sec', n => 1 / Math.cos(n));
addInternalFunc('tan', Math.tan);
addInternalFunc('arctan', Math.atan);
addInternalFunc('tanh', Math.tanh);
addInternalFunc('arctanh', Math.atanh);
addInternalFunc('cot', n => 1 / Math.tan(n));
addInternalFunc('log', log);
addInternalFunc('clamp', clamp);
addInternalFunc('lerp', lerp);
addInternalFunc('rand', random);
addInternalFunc('factorial', factorial);

addFunc('frac', ['x'], 'x - floor(x)');
addFunc('sawtooth', ['x', 'T', 'A=1', 'P=0'], 'A * frac(x / T + P)');
addFunc('sinc', ['x'], 'x == 0 ? 1 : sin(pi*x)/(pi*x)');
addFunc('ndist', ['x', 'μ=0', 'σ=1'], '(1/(σ * sqrt(2 * pi))) * e ** (-0.5 * ((x - μ) / σ) ** 2)');
//#endregion

//#region USER CODE
soundDurMult = 10;
g.opts.ncoords = 10_000;
update = true;
newCache = true;
doTableUpdate = true;
//#endregion