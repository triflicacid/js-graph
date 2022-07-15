import { Graph } from "./Graph.js";
import { Point } from "./Point.js";
import Popup from "./Popup.js";
import { HEX_ALPHA, extractCoords, round, clamp, createButton, random, factorial, plotPath } from "./utils.js";
import { getCorrespondingCoordinate, getCorrepondingCoordinateIndex, getAudioFromCoords } from "./graph-utils.js";
import { Expression, OPERATORS_DEFAULT, OPERATORS_IMAG } from "./libs/Expression.js";
import { Complex } from "./libs/Complex.js";
import { lambertw_scalar } from "./libs/lambertw.js";

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
  'z': 'complex',
  'z2': 'complex map',
  'θ': 'polar',
  '~': 'approximation'
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
  'z': 'x-coordinates are controlled and passed to a function which return a complex number z=a+bi. Seperatly plot [x, Re(z)] and [x, Im(z)]',
  'z2': 'For every point on the complex plane, z=a+bi, produce f(z). At point [a,b], color according to the arg(f(z)).',
  'θ': 'Polar: a is an angle in radians with the polar point [fn(a), a] being plotted.',
  '~': 'Approximate function around a point using the Taylor series',
};
const PARAMETRIC_VARIABLE = 'p';
const CONSTANT_SYM_REGEX = /^[a-z][a-z0-9_]*$/gmi;
const SHADE_ENUM = {
  "": "=",
  "lt": "<",
  "le": "≤",
  "gt": ">",
  "ge": "≥",
};
const SHADE_DESC = {
  "": "Equal To",
  "lt": "Less Than",
  "le": "Less Than or Equal To",
  "gt": "Greater Than",
  "ge": "Greater Than or Equal To"
};

/** Program entry point */
function main() {
  const wrapper = document.createElement("div");
  wrapper.classList.add("wrapper");
  document.body.appendChild(wrapper);

  const sidebarContainer = document.createElement("div");
  sidebarContainer.classList.add("sidebar-container");
  wrapper.appendChild(sidebarContainer);

  const sidebarButtonContainer = document.createElement("div");
  sidebarButtonContainer.classList.add("sidebar-button-container");
  sidebarContainer.appendChild(sidebarButtonContainer);

  const btnOpenConfigPopup = document.createElement("button");
  btnOpenConfigPopup.innerText = "Settings";
  btnOpenConfigPopup.addEventListener("click", () => {
    const popup = generateConfigPopup(graphData, () => {
      populateItemList(itemListContainer, graphData, analysisOptionsDiv);
    }, () => {
      graphData.renderParams.caches.line.update = true;
      graphData.renderParams.update = true;
    });
    popup.show();
  });
  sidebarButtonContainer.appendChild(btnOpenConfigPopup);


  const btnOpenFuncPopup = document.createElement("button");
  btnOpenFuncPopup.innerText = "Functions";
  btnOpenFuncPopup.addEventListener("click", () => {
    const popup = generateFunctionPopup(graphData, () => {
      graphData.renderParams.caches.line.update = true;
      graphData.renderParams.update = true;
    });
    popup.show();
  });
  sidebarButtonContainer.appendChild(btnOpenFuncPopup);

  const itemListContainer = document.createElement('div');
  itemListContainer.classList.add("item-list-container");
  sidebarContainer.appendChild(itemListContainer);

  const btnAddNewLine = document.createElement('button');
  btnAddNewLine.innerText = "+ Add Line";
  btnAddNewLine.addEventListener('click', () => {
    const popup = generateLinePopup(graphData, lineData => {
      popup.hide();
      addLine(lineData, graphData); // Add line to graph
      populateItemList(itemListContainer, graphData, analysisOptionsDiv);
    });
    popup.show();
  });
  sidebarContainer.appendChild(btnAddNewLine);

  const btnAddNewConstant = document.createElement('button');
  btnAddNewConstant.innerText = "+ Add Constant";
  btnAddNewConstant.addEventListener('click', () => {
    let sym = prompt(`Enter constant symbol`);
    if (!sym) return;
    if (!CONSTANT_SYM_REGEX.test(sym)) return alert(`Invalid symbol name - must match ${CONSTANT_SYM_REGEX}`);
    if (graphData.baseExpr.hasSymbol(sym)) return alert(`Symbol '${sym}' is already in use`);
    setConstant(graphData, sym, 1);
    populateItemList(itemListContainer, graphData, analysisOptionsDiv); // Update item list
    graphData.renderParams.caches.line.update = true;
    graphData.renderParams.update = true;
  });
  sidebarContainer.appendChild(btnAddNewConstant);

  const btnPlayAll = document.createElement('button');
  let playingAll = false;
  const updateBtnPlayAll = () => {
    btnPlayAll.innerHTML = playingAll ? "&#x1F568;" : "&#x1F56A;";
    btnPlayAll.title = playingAll ? 'Stop sound' : 'Play all curves';
  };
  updateBtnPlayAll();
  btnPlayAll.addEventListener('click', async () => {
    playingAll = !playingAll;
    updateBtnPlayAll();
    // Stop all audio sources
    graphData.lines.forEach((obj, lineID) => {
      if (obj.audio) {
        obj.audio.source.stop();
        delete obj.audio;
      }
    });
    if (playingAll) { // Start playing sound of all sources
      const promises = [];
      graphData.graph.getLines().forEach((lineID) => {
        const data = graphData.graph.getLine(lineID);
        if (data.draw !== false && data.type !== 'z2') {
          const promise = playAudioForLine(graphData, lineID);
          promises.push(promise);
        }
      });
      await Promise.all(promises);
      playingAll = false;
      updateBtnPlayAll();
    }
  });
  sidebarContainer.appendChild(btnPlayAll);

  const canvasContainer = document.createElement("div");
  canvasContainer.classList.add("canvas-container");
  wrapper.appendChild(canvasContainer);

  const analysisOptionsDiv = document.createElement("div");
  analysisOptionsDiv.dataset.lineID = null;
  analysisOptionsDiv.classList.add("analyse-line-container");
  wrapper.appendChild(analysisOptionsDiv);

  const graphData = setupGraph(canvasContainer, itemListContainer, analysisOptionsDiv);
  graphData.addEvents();
  graphData.render();
  window.graphData = graphData;

  // Common functions
  graphData.baseExpr.numberOpts.imag = "i";
  graphData.baseExpr.constSymbols.set("pi", Math.PI);
  graphData.baseExpr.constSymbols.set("e", Math.E);
  graphData.baseExpr.constSymbols.set(graphData.baseExpr.numberOpts.imag, Complex.I);
  graphData.baseExpr.constSymbols.set('pow', (a, b) => graphData.isImag ? Complex.pow(a, b) : Math.pow(a, b));
  graphData.baseExpr.constSymbols.set('abs', a => graphData.isImag ? Complex.abs(a) : Math.abs(a));
  graphData.baseExpr.constSymbols.set('round', a => graphData.isImag ? Complex.round(a) : round(a));
  graphData.baseExpr.constSymbols.set('floor', a => graphData.isImag ? Complex.floor(a) : Math.floor(a));
  graphData.baseExpr.constSymbols.set('ceil', a => graphData.isImag ? Complex.ceil(a) : Math.ceil(a));
  graphData.baseExpr.constSymbols.set('sgn', a => graphData.isImag ? Complex.sign(a) : Math.sign(a));
  graphData.baseExpr.constSymbols.set('sqrt', a => graphData.isImag ? Complex.sqrt(a) : Math.sqrt(a));
  graphData.baseExpr.constSymbols.set('exp', a => graphData.isImag ? Complex.exp(a) : Math.exp(a));
  graphData.baseExpr.constSymbols.set('sin', a => graphData.isImag ? Complex.sin(a) : Math.sin(a));
  graphData.baseExpr.constSymbols.set('arcsin', a => graphData.isImag ? Complex.arcsin(a) : Math.asin(a));
  graphData.baseExpr.constSymbols.set('sinh', a => graphData.isImag ? Complex.sinh(a) : Math.sinh(a));
  graphData.baseExpr.constSymbols.set('arcsinh', a => graphData.isImag ? Complex.arcsinh(a) : Math.asinh(a));
  graphData.baseExpr.constSymbols.set('csc', n => graphData.isImag ? Complex.div(1, Complex.sin(n)) : 1 / Math.sin(n));
  graphData.baseExpr.constSymbols.set('cos', a => graphData.isImag ? Complex.cos(a) : Math.cos(a));
  graphData.baseExpr.constSymbols.set('arccos', a => graphData.isImag ? Complex.arccos(a) : Math.acos(a));
  graphData.baseExpr.constSymbols.set('cosh', a => graphData.isImag ? Complex.cosh(a) : Math.cosh(a));
  graphData.baseExpr.constSymbols.set('arccosh', a => graphData.isImag ? Complex.arccosh(a) : Math.acosh(a));
  graphData.baseExpr.constSymbols.set('sec', n => graphData.isImag ? Complex.div(1, Complex.cos(n)) : 1 / Math.cos(n));
  graphData.baseExpr.constSymbols.set('tan', a => graphData.isImag ? Complex.tan(a) : Math.tan(a));
  graphData.baseExpr.constSymbols.set('arctan', a => graphData.isImag ? Complex.arctan(a) : Math.atan(a));
  graphData.baseExpr.constSymbols.set('tanh', a => graphData.isImag ? Complex.tanh(a) : Math.tanh(a));
  graphData.baseExpr.constSymbols.set('arctanh', a => graphData.isImag ? Complex.arctanh(a) : Math.atanh(a));
  graphData.baseExpr.constSymbols.set('cot', n => graphData.isImag ? Complex.div(1, Complex.tan(n)) : 1 / Math.tan(n));
  graphData.baseExpr.constSymbols.set('log', a => graphData.isImag ? Complex.log(a) : Math.log(a));
  // graphData.baseExpr.constSymbols.set('clamp', clamp);
  graphData.baseExpr.constSymbols.set('rand', (a, b) => graphData.isImag ? new Complex(random(a.a, b.a)) : random(a, b));
  graphData.baseExpr.constSymbols.set('factorial', a => graphData.isImag ? new Complex(factorial(a.a)) : factorial(a));
  graphData.baseExpr.constSymbols.set('lambertw', (x) => lambertw_scalar(graphData.isImag ? x : new Complex(x), 0, 1e-8));
  graphData.baseExpr.constSymbols.set('Re', z => z.a);
  graphData.baseExpr.constSymbols.set('Im', z => z.b);

  graphData.isImag = true;
  graphData.baseExpr.operators = OPERATORS_IMAG;

  createFunction(graphData, 'frac', ['x'], 'x - floor(x)');
  createFunction(graphData, 'sawtooth', ['x', 'T', 'A', 'P'], 'A * frac(x / T + P)', true);
  createFunction(graphData, 'sinc', ['x'], 'sin(pi*x)/(pi*x)');
  createFunction(graphData, 'ndist', ['x', 'm', 's'], '(1/(s * sqrt(2 * pi))) * e ** (-0.5 * ((x - m) / s) ** 2)', true);

  // #region USER CODE
  addLine({
    type: "z2",
    expr: createNewExpression(graphData, "sin(z)").parse(),
  }, graphData);
  // graphData.itemListItems.push({ type: "defint", lineID: 0, a: -0.5, b: 0.5 });
  populateLineAnalysisDiv(analysisOptionsDiv, graphData, 0, itemListContainer);
  // #endregion

  populateItemList(itemListContainer, graphData, analysisOptionsDiv);
}

/** Sets up graph and attached it to a given parent element */
function setupGraph(parent, itemListContainer, analysisOptionsDiv) {
  const returnObj = {
    parent,
    baseExpr: new Expression(),
    isImag: false,
  };

  const canvas = document.createElement('canvas');
  parent.appendChild(canvas);
  canvas.width = parent.offsetWidth;
  canvas.height = parent.offsetHeight;
  returnObj.canvas = canvas;

  const graph = new Graph(canvas, canvas);
  returnObj.graph = graph;

  // Graph settings object
  const settings = {
    soundLoop: true, // Loop sound?
    soundDurMult: 1, // Duration of each note
    soundMultipler: 1, // What to multiple sound by
    dpAccuracy: 5, // How many decimal points should measurements etc... adhere to?
    showCoords: true, // Show mouse coordinates next to cursor?
    displayDp: 2, // How may DP should coordinates be round to when displayed?
    integrateLimitsN: 10000,
  };
  returnObj.settings = settings;

  // Line map - [id => { audio }]
  const lines = new Map();
  returnObj.lines = lines;
  // Item map for item list - { type, ... }[]
  // -> { type: 'defint', lineID, a, b, val?, coords? } FOR DEFINITE INTEGRAL
  const itemListItems = [];
  returnObj.itemListItems = itemListItems;
  // Rendering variables
  const renderParams = {
    loop: true, // Queue up call to "render" in "render" function?
    update: true, // Update the canvas next render cycle?
    caching: true, // Use caches to optimise rendering?
    caches: {},
    coords: [0, 0], // Actual mouse coordinates
    graphCoords: [0, 0], // Coordinates on graph
    dragging: false, // Is the user currently dragging the canvas?
    dragData: { pos: undefined, apos: undefined }, // Record actual position and canvas position
  };
  returnObj.renderParams = renderParams;
  // Populate caches data
  renderParams.caches.line = { // Caches graph background along with all functions drawn
    data: undefined,
    update: true,
    create() {
      graph.sketch(); // Sketch all functions
      graph.getLines().forEach(id => { // Error messages?
        const line = graph.getLine(id), errEl = lines.get(id).errorEl;
        if (errEl) {
          if (line.error) {
            errEl.hidden = false;
            errEl.title = line.emsg;
          } else {
            errEl.hidden = true;
          }
        } else if (line.error) {
          console.warn(`Line ${id} :: ${line.emsg}`);
        }
      });
      this.data = graph.ctx.getImageData(0, 0, graph.width, graph.height); // Cache data
    },
  };
  renderParams.caches.shadeArea = {
    data: undefined,
    update: true,
    create() {
      lines.forEach((data, lineID) => {
        if (data.shadeArea) {
          const ldata = graph.getLine(lineID);
          graph.ctx.beginPath();
          graph.ctx.fillStyle = (ldata.color ?? "#000000") + "35";
          plotPath(graph.ctx, data.shadeArea);
          graph.ctx.fill();
        }
      });
      let repopulate = false;
      itemListItems.forEach(data => {
        if (data.type === "defint") {
          const ldata = graph.getLine(data.lineID);
          try {
            const pbr = { path: [] }; // For pass-by-reference return values
            data.val = data.b < data.a
              ? -graphData.graph.getArea(data.lineID, data.b, data.a, graphData.settings.integrateLimitsN, pbr) // Flip limits and negate
              : graphData.graph.getArea(data.lineID, data.a, data.b, graphData.settings.integrateLimitsN, pbr);
            data.coords = pbr.path;
          } catch (e) {
            console.error(e);
            data.val = undefined;
            data.coords = [];
            alert(`Unable to integrate line ID ${data.lineID} between ${data.a} and ${data.b}`);
          }
          repopulate = true; // Re-populate item list
          // Draw area region
          if (ldata.draw === undefined || ldata.draw) { // Don't both if line is not visible
            graph.ctx.beginPath();
            graph.ctx.fillStyle = (ldata?.color ?? "#000000") + "35";
            if (Array.isArray(data.coords[0][0])) data.coords.forEach(coords => plotPath(graph.ctx, coords));
            else plotPath(graph.ctx, data.coords);
            graph.ctx.fill();
          }
        }
      });
      if (repopulate) populateItemList(itemListContainer, graphData, analysisOptionsDiv); // Update any changes
      this.data = graph.ctx.getImageData(0, 0, graph.width, graph.height); // Cache data
    }
  };
  renderParams.caches.points = { // Caches points of interest (Point[])
    data: undefined,
    update: true,
    create() {
      Point.roundDp = settings.displayDp;
      graph.sketchPoints(); // Sketch all points
      this.data = graph.ctx.getImageData(0, 0, graph.width, graph.height); // Cache data
    },
  };

  // Render loop function
  function render() {
    if (renderParams.update) { // Update the canvas
      const ctx = graph.ctx;
      graph.clear(); // Clear canvas
      let doneUpdate = false; // Keep track of previous updates -> if a previous cache was updated, update all caches after it
      for (let name in renderParams.caches) {
        const data = renderParams.caches[name];
        if (!renderParams.caching || data.update || doneUpdate) { // Update cache
          data.create(); // Create new cache
          doneUpdate = true;
          data.update = false;
        } else {
          ctx.putImageData(data.data, 0, 0); // Render image cache to canvas
        }
      }

      // Render coordinates near mouse
      if (settings.showCoords) {
        ctx.beginPath();
        ctx.fillStyle = "black";
        ctx.arc(...renderParams.coords, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.font = '11px Arial';
        ctx.fillText(`(${round(renderParams.graphCoords[0], settings.displayDp)}, ${round(renderParams.graphCoords[1], settings.displayDp)})`, renderParams.coords[0] + 5, renderParams.coords[1] - 5);
      }

      // Render traces if necessary
      const originCoords = graph.getCoordinates(0, 0);
      lines.forEach((data, id) => {
        const line = graph.getLine(id);
        if (line.draw && (data.traceX || data.traceY)) {
          const TEXT_OFF = 5;
          if (data.traceX) {
            const xstep = Math.abs(line.coords[1][0] - line.coords[0][0]) * 2;
            const online = getCorrepondingCoordinateIndex(renderParams.graphCoords[0], 'x', line.coords, true, settings.dpAccuracy) || [];
            graph.ctx.lineWidth = 1;
            online.forEach((i) => {
              graph.ctx.save();
              const [x, y] = line.coords[i];
              if (Math.abs(x - renderParams.graphCoords[0]) > xstep) return;
              const lineCoords = graph.getCoordinates(x, y);
              graph.ctx.beginPath();
              graph.ctx.moveTo(originCoords[0], renderParams.coords[1]);
              graph.ctx.lineTo(...renderParams.coords);
              graph.ctx.lineTo(...lineCoords);
              graph.ctx.stroke();
              graph.ctx.fillStyle = line.color;
              graph.ctx.beginPath();
              graph.ctx.arc(originCoords[0], renderParams.coords[1], 4, 0, 2 * Math.PI);
              graph.ctx.arc(...lineCoords, 4, 0, 2 * Math.PI);
              graph.ctx.fill();
              graph.ctx.fillText(y.toFixed(3), lineCoords[0] + TEXT_OFF, lineCoords[1] - TEXT_OFF);

              if (data.tangent) {
                let [nx, ny] = line.coords[i + 1] ?? line.coords[i - 1];
                let m = (ny - y) / (nx - x);
                let x1 = x - graph.opts.xstep / 2, x2 = nx + graph.opts.xstep / 2;
                let y1 = m * (x1 - x) + y, y2 = m * (x2 - nx) + ny;
                graph.ctx.beginPath();
                graph.ctx.strokeStyle = 'red';
                graph.ctx.moveTo(...graph.getCoordinates(x1, y1));
                graph.ctx.lineTo(...graph.getCoordinates(x2, y2));
                graph.ctx.stroke();
                graph.ctx.fillStyle = 'red';
                graph.ctx.fillText('m=' + m.toFixed(2), lineCoords[0] + TEXT_OFF, lineCoords[1] + TEXT_OFF);
              }
              graph.ctx.restore();
            });
          }
          if (data.traceY) {
            const ystep = Math.abs(line.coords[1][1] - line.coords[0][1]) * 5;
            const online = getCorrepondingCoordinateIndex(renderParams.graphCoords[1], 'y', line.coords, true, settings.dpAccuracy) || [];
            graph.ctx.lineWidth = 1;
            online.forEach(i => {
              graph.ctx.save();
              const [x, y] = line.coords[i];
              if (Math.abs(y - renderParams.graphCoords[1]) > ystep) return;
              const lineCoords = graph.getCoordinates(x, y);
              graph.ctx.beginPath();
              graph.ctx.moveTo(renderParams.coords[0], originCoords[1]);
              graph.ctx.lineTo(...renderParams.coords);
              graph.ctx.lineTo(...lineCoords);
              graph.ctx.stroke();
              graph.ctx.fillStyle = line.color;
              graph.ctx.beginPath();
              graph.ctx.arc(renderParams.coords[0], originCoords[1], 4, 0, 2 * Math.PI);
              graph.ctx.arc(...lineCoords, 4, 0, 2 * Math.PI);
              graph.ctx.fill();
              graph.ctx.fillText(x.toFixed(3), lineCoords[0] + 5, lineCoords[1] - 5);

              if (data.tangent) {
                let [nx, ny] = line.coords[i + 1] ?? line.coords[i - 1];
                let m = (ny - y) / (nx - x);
                let y1 = y - graph.opts.ystep / 2, y2 = ny + graph.opts.ystep / 2;
                let x1 = (y1 - y + m * x) / m, x2 = (y2 - ny + m * nx) / m;
                graph.ctx.beginPath();
                graph.ctx.strokeStyle = 'red';
                graph.ctx.moveTo(...graph.getCoordinates(x1, y1));
                graph.ctx.lineTo(...graph.getCoordinates(x2, y2));
                graph.ctx.stroke();
                graph.ctx.fillStyle = 'red';
                graph.ctx.fillText('m=' + m.toFixed(2), lineCoords[0] + TEXT_OFF, lineCoords[1] + TEXT_OFF);
              }
              graph.ctx.restore();
            });
          }
        }
      });

      renderParams.update = false;
    }
    if (renderParams.loop) requestAnimationFrame(render);
  }
  returnObj.render = render;

  // Function to add events
  function addEvents() {
    graph.addEvents({
      mousemove(e) {
        renderParams.coords = extractCoords(e); // Get coordinates of mouse relative to the canvas
        renderParams.graphCoords = graph.fromCoordinates(...renderParams.coords); // Get graph coordinates

        let shadeAreaUpdate = false;
        lines.forEach((data, id) => {
          if (data.shadeArea) {
            shadeAreaUpdate = true;
            delete data.shadeArea;
          }
        });
        if (shadeAreaUpdate) {
          renderParams.caches.shadeArea.update = true;
          renderParams.update = true;
        }

        if (settings.showCoords) renderParams.update = true; // Issue update to update mouse coords
        if (renderParams.dragging) { // The canvas is being dragged...
          // Translate canvas
          graph.opts.xstart -= renderParams.graphCoords[0] - renderParams.dragData.apos[0];
          graph.opts.ystart -= renderParams.graphCoords[1] - renderParams.dragData.apos[1];
          renderParams.caches.line.update = true; // Update line cache as graph has changed
          renderParams.update = true;
        }

        // Hover over any points?
        let flagChange = false;
        const pr = graph.fromCoordinates(Point.radius + 1, 0)[0] - graph.fromCoordinates(0, 0)[0];
        graph._points.forEach(p => {
          if (p.flag) {
            p.flag = false;
            flagChange = true;
          }
          if (renderParams.graphCoords[0] > p.x - pr && renderParams.graphCoords[0] <= p.x + pr && renderParams.graphCoords[1] > p.y - pr && renderParams.graphCoords[1] <= p.y + pr) {
            p.flag = true;
            flagChange = true;
          }
        });
        if (flagChange) {
          renderParams.caches.points.update = true; // Update points cache as state of point(s) has changed
          renderParams.update = true;
        }
      },

      mousedown(e) {
        renderParams.dragging = true; // We are now panning the canvas
        renderParams.dragData.pos = extractCoords(e); // Get current coordinates
        renderParams.dragData.apos = graph.fromCoordinates(...renderParams.dragData.pos); // Get graph coordinates
      },

      mouseup(e) {
        renderParams.dragging = false; // No longer panning the canvas
      },

      wheel(e) {
        const k = e.deltaY < 0 ? 1.1 : 0.9; // Scroll factor
        e.preventDefault(); // Prevent page from scrolling
        graph.opts.ystepGap *= k;
        graph.opts.xstepGap *= k;
        if (graph.opts.xstepGap < graph.width / 14) {
          graph.opts.xstepGap *= 2;
          graph.opts.xstep *= 2;
        } else if (graph.opts.xstepGap > graph.width / 7) {
          graph.opts.xstepGap /= 2;
          graph.opts.xstep /= 2;
        }
        if (graph.opts.ystepGap < graph.height / 14) {
          graph.opts.ystepGap *= 2;
          graph.opts.ystep *= 2;
        } else if (graph.opts.ystepGap > graph.height / 7) {
          graph.opts.ystepGap /= 2;
          graph.opts.ystep /= 2;
        }
        renderParams.caches.line.update = true;
        renderParams.update = true;
      }
    });
  }
  returnObj.addEvents = addEvents;

  // Constant map
  const constants = new Map(); // constant: string => { value: number, step: number }
  returnObj.constants = constants;
  // Common constants
  globalThis.pi = Math.PI;
  globalThis.e = Math.E;

  // Contains set of all user-defined functions
  returnObj.funcs = new Set();

  return returnObj;
}

/** Add a line to the graph. Return line ID. */
function addLine(lineData, graphData) {
  const id = graphData.graph.addLine(lineData); // Add line to graph
  graphData.lines.set(id, {}); // Create object for line
  // Update canvas
  graphData.renderParams.caches.line.update = true;
  graphData.renderParams.update = true;
  return id;
}

/** Create and return Expression object for type 'z' */
function createNewExpression(graphData, expr = undefined) {
  let E = new Expression(expr);
  E.constSymbols = graphData.baseExpr.constSymbols;
  E.operators = graphData.baseExpr.operators;
  E.numberOpts = graphData.baseExpr.numberOpts;
  return E;
}

/** Remove line from graph. */
function removeLine(lineID, graphData) {
  const ok = graphData.graph.removeLine(lineID); // Remove line from graph
  if (ok) {
    const data = graphData.lines.get(lineID); // Get line info object
    if (data.audio) data.audio.source.stop(); // If playing audio, stop
    graphData.graph.removePoints({ lineID }); // Remove all points from graph which belong to said line
    graphData.lines.delete(lineID); // Remove from line map
    // Update canvas
    graphData.renderParams.caches.line.update = true;
    graphData.renderParams.update = true;
    return true;
  } else {
    return false;
  }
}

/** Create/set a constant */
function setConstant(graphData, name, value) {
  if (graphData.constants.has(name)) {
    graphData.constants.get(name).value = value;
  } else {
    graphData.constants.set(name, { value });
  }
  graphData.baseExpr.constSymbols.set(name, value);
}

/** Remove a constant */
function removeConstant(graphData, name) {
  if (graphData.constants.has(name)) {
    graphData.constants.delete(name);
    graphData.baseExpr.constSymbols.delete(name);
  }
}

/** Create a user-defined function in baseExpr */
function createFunction(graphData, name, args, source) {
  let func = {
    type: 'fn',
    args,
    body: source,
  };
  graphData.funcs.add(name);
  graphData.baseExpr.constSymbols.set(name, func);
  graphData.baseExpr.parseSymbol(name);
}

/** Remove a function */
function removeFunction(graphData, name) {
  if (graphData.funcs.has(name)) {
    graphData.funcs.delete(name);
    graphData.baseExpr.delSymbol(name);
  }
}

/** Populate Item List */
function populateItemList(listEl, graphData, analysisOptionsDiv) {
  listEl.innerHTML = ""; // Clear element

  // LINES
  graphData.lines.forEach((obj, id) => {
    const card = generateLineCard(id, graphData, analysisOptionsDiv, listEl, () => {
      card.remove();
      if (+analysisOptionsDiv.dataset.lineID === id) analysisOptionsDiv.innerHTML = ''; // Remove from analysis section
    }, () => populateItemList(listEl, graphData, analysisOptionsDiv));
    listEl.appendChild(card);
  });

  // CONSTANTS
  graphData.constants.forEach((_, name) => {
    const card = generateConstantCard(name, graphData, n => {
      graphData.renderParams.caches.line.update = true;
      graphData.renderParams.update = true;
    }, () => {
      card.remove();
      graphData.renderParams.caches.line.update = true;
      graphData.renderParams.update = true;
    });
    listEl.appendChild(card);
  });

  // OTHER
  graphData.itemListItems.forEach((data, id) => {
    let card;
    if (data.type === "defint") card = generateDefiniteIntegralCard(data, graphData, () => {
      data.update = true;
      graphData.renderParams.caches.shadeArea.update = true;
      graphData.renderParams.update = true;
    }, () => {
      card.remove();
      graphData.renderParams.caches.shadeArea.update = true;
      graphData.renderParams.update = true;
    });
    if (card) listEl.appendChild(card);
  });
}

/** Given line type, return definite integral info */
const getDefiniteIntegralData = lineType => {
  switch (lineType) {
    case 'x':
      return { symbol: 'x', html: '&xscr;', desc: 'Find area under curve between x=a, x=b and the x-axis' };
    case 'y':
      return { symbol: 'y', html: '&yscr;', desc: 'Find area under curve between y=a, y=b and the y-axis' };
    case 'p':
      return { symbol: 'p', html: '&rho;', desc: 'Find area under curve between p=a, p=b and the x-axis' };
    case 'θ':
      return { symbol: 'θ', html: '&theta;', desc: 'Find area bounded by the curve and the half-lines θ=a and θ=b in radians' };
    default:
      return { symbol: 'x', html: '&xscr;', desc: 'Find area under curve between x=a and x=b' };
  }
};

function generateDefiniteIntegralCard(data, graphData, onUpdate, onRemove) {
  const card = document.createElement("div");
  card.classList.add("card", "definite-integral-card");
  const span = document.createElement("span");
  card.appendChild(span);
  span.insertAdjacentHTML("beforeend", `&int;(line `);
  let DIDATA, spanSymbols = [];

  const updateDIData = () => {
    DIDATA = getDefiniteIntegralData(graphData.graph.getLine(data.lineID)?.type);
    spanSymbols.forEach((el) => (el.innerHTML = DIDATA.html));
    span.title = DIDATA.desc;
  };
  const updateInputStep = () => {
    inputLimitA.step = data.step;
    inputLimitB.step = data.step;
  };

  // Enter line ID to integrate
  let inputLineID = document.createElement("input");
  inputLineID.type = "text";
  inputLineID.value = data.lineID;
  inputLineID.style.width = "10px";
  inputLineID.addEventListener('change', () => {
    const id = +inputLineID.value;
    data.lineID = id;
    updateDIData();
    onUpdate();
  });
  span.appendChild(inputLineID);
  span.insertAdjacentHTML("beforeend", `)d`);
  span.appendChild(spanSymbols[0] = document.createElement("span"));
  span.insertAdjacentHTML("beforeend", ` between `);

  // Limit A
  span.appendChild(spanSymbols[1] = document.createElement("span"));
  span.insertAdjacentHTML("beforeend", ` = `);
  let inputLimitA = document.createElement("input");
  inputLimitA.type = "number";
  inputLimitA.value = data.a;
  inputLimitA.addEventListener('change', () => {
    data.a = +inputLimitA.value;
    onUpdate();
  });
  span.appendChild(inputLimitA);
  span.insertAdjacentHTML("beforeend", `, `);

  // Limit B
  span.appendChild(spanSymbols[2] = document.createElement("span"));
  span.insertAdjacentHTML("beforeend", ` = `);
  let inputLimitB = document.createElement("input");
  inputLimitB.type = "number";
  inputLimitB.value = data.b;
  inputLimitB.addEventListener('change', () => {
    data.b = +inputLimitB.value;
    onUpdate();
  });
  span.appendChild(inputLimitB);

  // Answer
  span.insertAdjacentHTML("beforeend", ` = `);
  span.insertAdjacentHTML("beforeend", `<var>${data.val != undefined && !(graphData.isImag ? Complex.isNaN(data.val) : isNaN(data.val)) ? data.val.toString() : "?"}</var>`);

  const divButtons = document.createElement("div");
  divButtons.classList.add("buttons-container");
  card.appendChild(divButtons);

  // Btn to edit in detail
  const btnEdit = document.createElement('button');
  btnEdit.innerHTML = '&#9998;';
  btnEdit.title = 'Edit';
  btnEdit.classList.add("btn-edit");
  btnEdit.addEventListener('click', () => {
    const popup = new Popup("Definite Integral");
    popup.insertAdjacentHTML("beforeend", `<p>${DIDATA.desc}<br><em>Entering numerical expressions is permitted</em></p>`);

    // Limit A
    let p = document.createElement("p");
    popup.insertAdjacentElement("beforeend", p);
    p.insertAdjacentHTML("beforeend", `${DIDATA.html} = &ascr; = `);
    let p_inputLimitA = document.createElement("input");
    p_inputLimitA.type = "text";
    p_inputLimitA.value = data.a;
    p_inputLimitA.addEventListener('change', () => {
      try {
        data.a = +eval(p_inputLimitA.value);
      } catch (e) {
        alert(e.message);
      }
      p_inputLimitA.value = data.a;
    });
    p.appendChild(p_inputLimitA);

    // Limit B
    p = document.createElement("p");
    popup.insertAdjacentElement("beforeend", p);
    p.insertAdjacentHTML("beforeend", `${DIDATA.html} = &bscr; = `);
    let p_inputLimitB = document.createElement("input");
    p_inputLimitB.type = "text";
    p_inputLimitB.value = data.b;
    p_inputLimitB.addEventListener('change', () => {
      try {
        data.b = +eval(p_inputLimitB.value);
      } catch (e) {
        alert(e.message);
      }
      p_inputLimitB.value = data.b;
    });
    p.appendChild(p_inputLimitB);

    // Input step
    p = document.createElement("p");
    popup.insertAdjacentElement("beforeend", p);
    p.insertAdjacentHTML("beforeend", `Number input's step = `);
    let p_inputStep = document.createElement("input");
    p_inputStep.type = "text";
    p_inputStep.value = data.step;
    p_inputStep.addEventListener('change', () => {
      try {
        data.step = +eval(p_inputStep.value);
        updateInputStep();
      } catch (e) {
        alert(e.message);
      }
      p_inputStep.value = data.step;
    });
    p.appendChild(p_inputStep);

    popup.setCloseCallback(onUpdate);
    popup.show();
  });
  divButtons.appendChild(btnEdit);

  // Button to remove
  const btnRemove = document.createElement("button");
  btnRemove.innerHTML = '&times;';
  btnRemove.classList.add("btn-remove");
  btnRemove.addEventListener("click", () => {
    const i = graphData.itemListItems.indexOf(data);
    if (i !== -1) graphData.itemListItems.splice(i, 1);
    onRemove();
  });
  divButtons.appendChild(btnRemove);

  updateDIData();
  updateInputStep();
  return card;
}

/** Given name of a constant, generate a Card */
function generateConstantCard(name, graphData, onChange, onRemove) {
  const data = graphData.constants.get(name);
  data.value ??= 1;
  data.step ??= 1;
  const card = document.createElement("div");
  card.classList.add("card", "constant-card");

  card.insertAdjacentHTML("beforeend", `<span class='constant-name'><var>${name}</var></span>`);
  card.insertAdjacentHTML("beforeend", ` = `);
  let span = document.createElement("span");
  span.classList.add("constant-value");
  let inputValue = document.createElement("input");
  inputValue.type = "number";
  inputValue.value = data.value;
  inputValue.step = data.step;
  inputValue.addEventListener("change", () => {
    setConstant(graphData, name, +inputValue.value);
    onChange(data.value);
  });
  span.appendChild(inputValue);
  card.appendChild(span);

  const divButtons = document.createElement("div");
  divButtons.classList.add("buttons-container");
  card.appendChild(divButtons);

  // Btn to edit the input's step
  const btnEdit = document.createElement('button');
  btnEdit.innerHTML = '&#9998;';
  btnEdit.title = 'Edit Step';
  btnEdit.classList.add("btn-edit");
  btnEdit.addEventListener('click', () => {
    let step = eval(prompt(`Enter step for the number input`, inputValue.step));
    if (typeof step === "number") inputValue.step = step;
  });
  divButtons.appendChild(btnEdit);

  // Button to set value
  const btnSet = document.createElement("button");
  btnSet.innerHTML = "&#128425;";
  btnSet.title = "Set value to an arithmetic expression";
  btnSet.addEventListener('click', () => {
    let expr = prompt(`Enter arithmetic expression to evaluate`, data.value);
    if (!expr) return;
    try {
      let val = +eval(expr);
      inputValue.value = val;
      setConstant(graphData, name, val);
      onChange();
    } catch (e) {
      alert(`Error evaluating expression :: ${e.message}`);
    }
  });
  divButtons.appendChild(btnSet);

  // Button to remove constant
  const btnRemove = document.createElement("button");
  btnRemove.innerHTML = '&times;';
  btnRemove.title = 'Remove Constant';
  btnRemove.classList.add("btn-remove");
  btnRemove.addEventListener("click", () => {
    removeConstant(graphData, name);
    onRemove();
  });
  divButtons.appendChild(btnRemove);

  return card;
}

/** Given line id and information, generate a Card */
function generateLineCard(lineID, graphData, analysisOptionsDiv, itemListContainer, onLineRemove, reRender) {
  const lineObj = graphData.lines.get(lineID), lineData = graphData.graph.getLine(lineID);
  const card = document.createElement("div");
  card.dataset.id = lineID;
  card.classList.add("card", "line-card");
  if (lineObj === undefined || lineData === undefined) {
    card.innerHTML = `<em>Error fetching data for line ${lineID}</em>`;
    return card;
  }

  // Set background color of card
  function setBackground() {
    card.style.backgroundColor = lineData.draw === false ? '' : (lineData.color || '#000000') + HEX_ALPHA;
  }
  setBackground();

  // Function to update line data
  function updateLineData() {
    graphData.renderParams.caches.line.update = true;
    graphData.renderParams.update = true;
    setBackground();
    if (divOverview) divOverview.remove();
    divOverview = generateLineCardOverview(lineID, lineData, graphData, updateLineData);
    errEl.insertAdjacentElement("afterend", divOverview);
  }

  // Line type
  const spanType = document.createElement("span");
  spanType.classList.add("line-type");
  spanType.title = LINE_DESCRIPTIONS[lineData.type];
  spanType.innerText = `${lineID}: ${lineData.type}`;
  card.appendChild(spanType);

  // Line error
  const errEl = document.createElement('span');
  errEl.classList.add('err-sym');
  errEl.innerHTML = '&#9888;';
  errEl.hidden = true;
  card.appendChild(errEl);
  lineObj.errorEl = errEl;

  // Line overview e.g. function body
  let divOverview = generateLineCardOverview(lineID, lineData, graphData, updateLineData);
  card.appendChild(divOverview);

  const divButtons = document.createElement("div");
  divButtons.classList.add("buttons-container");
  card.appendChild(divButtons);

  // Button to open configuration
  let editDiv;
  const btnEdit = document.createElement('button');
  btnEdit.innerHTML = '&#9998;';
  btnEdit.title = 'Edit Line';
  btnEdit.classList.add("btn-edit");
  btnEdit.addEventListener('click', () => {
    editDiv = generateLineConfigDiv(graphData, lineData, () => {
      editDiv.remove();
      btnEdit.disabled = false;
      editDiv = undefined;
      updateLineData();
    }, 2);
    editDiv.insertAdjacentHTML("afterbegin", `<p><strong><u>Edit Line ${lineID}</strong></u></p>`);
    const btnCancel = document.createElement('button'); // Cancel line editing
    btnCancel.innerText = 'Cancel';
    btnCancel.addEventListener("click", () => {
      editDiv.remove();
      btnEdit.disabled = false;
      editDiv = undefined;
    });
    editDiv.insertAdjacentElement("beforeend", btnCancel);
    card.insertAdjacentElement("afterend", editDiv); // Insert after this card
    btnEdit.disabled = true;
  });
  divButtons.appendChild(btnEdit);

  // Button to open analysis options
  const btnAnalyse = document.createElement("button");
  btnAnalyse.innerHTML = "&#x1f50d;";
  btnAnalyse.classList.add("btn-analyse");
  btnAnalyse.title = "Open analysis tools";
  btnAnalyse.addEventListener("click", () => {
    populateLineAnalysisDiv(analysisOptionsDiv, graphData, lineID, itemListContainer);
  });
  divButtons.appendChild(btnAnalyse);

  // Button to copy line
  const btnCopy = document.createElement("button");
  btnCopy.innerHTML = '&#x2398';
  btnCopy.title = 'Clone Line';
  btnCopy.classList.add("btn-copy");
  btnCopy.addEventListener("click", () => {
    /** TODO: DEEPER COPY **/
    let newData = {};
    for (let prop in lineData) {
      if (lineData.hasOwnProperty(prop)) {
        if (lineData[prop] instanceof Expression) {
          let E = new Expression(lineData[prop]._raw);
          E._symbols = lineData[prop]._symbols;
          E._tokens = [...lineData[prop]._tokens];
          E.numberOpts = lineData[prop].numberOpts;
          newData[prop] = E;
        } else {
          newData[prop] = lineData[prop];
        }
      }
    }
    addLine(newData, graphData); // Copy line data
    reRender(); // Re-render entire list of item cards
  });
  divButtons.appendChild(btnCopy);

  // button: draw line?
  lineData.draw = lineData.draw === undefined || lineData.draw;
  divButtons.appendChild(generateToggleVisibleButton(lineData.draw, () => {
    lineData.draw = !lineData.draw;
    updateLineData();
    return lineData.draw;
  }));

  // Button to remove line
  const btnRemove = document.createElement("button");
  btnRemove.innerHTML = '&times;';
  btnRemove.title = 'Remove Line';
  btnRemove.classList.add("btn-remove");
  btnRemove.addEventListener("click", () => {
    const removed = removeLine(lineID, graphData);
    if (removed) {
      if (editDiv) editDiv.remove(); // Remove edit div
      onLineRemove(lineID);
    }
  });
  divButtons.appendChild(btnRemove);

  return card;
}

/** Toggle button which toggles a value - visibility (shows eye) */
function generateToggleVisibleButton(initial, onClick) {
  const update = value => {
    btn.innerHTML = value ? '<span class="cross-out">&#x1f441;</span>' : '<span>&#x1f441;</span>';
    btn.title = value ? 'Hide line' : 'Show line';
  };
  const btn = document.createElement('button');
  update(initial);
  btn.addEventListener('click', () => update(onClick()));
  return btn;
}

/** Generate DIV which contains an overview of line data (used in .line-card) */
function generateLineCardOverview(lineID, lineData, graphData, onChange) {
  const div = document.createElement("div");
  div.classList.add("line-overview");
  const span = document.createElement("span");
  div.appendChild(span);

  switch (lineData.type) {
    case 'x': case 'y': {
      span.innerHTML += `&#402;(&${lineData.type}scr;) = `;
      let input = generateExpressionInput(lineData.expr, onChange);
      span.appendChild(input);
      break;
    }
    case 'z': {
      span.innerHTML += `&#402;(&xscr;) = `;
      let input = generateExpressionInput(lineData.expr, onChange, OPERATORS_IMAG);
      span.appendChild(input);
      break;
    }
    case 'z2': {
      span.innerHTML += `&#402;(&zscr;) = `;
      let input = generateExpressionInput(lineData.expr, onChange, OPERATORS_IMAG);
      span.appendChild(input);
      break;
    }
    case '~': {
      span.innerHTML += `Approx. around &xscr; = `;
      let input = document.createElement("input");
      input.type = "number";
      input.value = lineData.C;
      input.addEventListener("change", () => {
        lineData.C = +input.value;
        onChange();
      });
      span.appendChild(input);
      break;
    }
    case 'd': case 'i': {
      const text = lineData.type === 'i' ? [`&int;( line `, ` )d&xscr;`] : [`d/dx(line `, ` )`];
      span.insertAdjacentHTML("beforeend", text[0]);
      const select = document.createElement("select");
      select.insertAdjacentHTML("beforeend", "<option selected disabled>ID</option>");
      graphData.graph.getLines().forEach(id => select.insertAdjacentHTML('beforeend', `<option ${id}>${id}</option>`));
      if (lineData.id === undefined) lineData.id = NaN; else select.value = lineData.id;
      select.addEventListener("change", () => {
        lineData.id = +select.value;
        onChange();
      });
      span.appendChild(select);
      span.insertAdjacentHTML("beforeend", text[1]);
      break;
    }
    case 'p': {
      span.remove();

      let p = document.createElement("p");
      p.innerHTML = `&#402;<sub>&xscr;</sub>(${PARAMETRIC_VARIABLE}) = `;
      p.appendChild(generateExpressionInput(lineData.exprx, onChange));
      div.appendChild(p);

      p = document.createElement("p");
      p.innerHTML = `&#402;<sub>&yscr;</sub>(${PARAMETRIC_VARIABLE}) = `;
      p.appendChild(generateExpressionInput(lineData.expry, onChange));
      div.appendChild(p);

      break;
    }
    case 'θ': {
      span.innerHTML += `&#402;(a) = `;
      span.appendChild(generateExpressionInput(lineData.expr, onChange));
      break;
    }
    default:
      span.innerText = LINE_TYPES[lineData.type];
  }
  return div;
}

/** Generate global configutation popup */
function generateConfigPopup(graphData, onUpdateItemList, onChange) {
  const popup = new Popup('Configuration');
  popup.setCloseCallback(() => onChange());
  const zoomDiv = document.createElement("div");
  popup.insertAdjacentElement("beforeend", zoomDiv);
  zoomDiv.insertAdjacentHTML("beforeend", "<span>Zoom:</span> ");
  // Zoom: default
  const btnZoomDefault = document.createElement('button');
  btnZoomDefault.innerText = 'Default';
  btnZoomDefault.addEventListener('click', () => {
    graphData.graph.opts = {};
    graphData.graph.fixOpts();
    onChange();
    popup.hide();
  });
  zoomDiv.appendChild(btnZoomDefault);
  // Zoom: trig
  const btnZoomTrig = document.createElement('button');
  btnZoomTrig.innerText = 'Trig';
  btnZoomTrig.addEventListener('click', () => {
    graphData.graph.opts = {
      ystart: 2,
      ystep: 0.5,
      xstart: -2 * Math.PI - 0.5,
      xstep: Math.PI / 2,
      xstepLabel: n => round(n / Math.PI, 1) + 'π',
    };
    onChange();
    popup.hide();
  });
  zoomDiv.appendChild(btnZoomTrig);
  // Zoom: normal distribution
  const btnZoomND = document.createElement('button');
  btnZoomND.innerText = 'ND';
  btnZoomND.title = "Normal Distribution";
  btnZoomND.addEventListener('click', () => {
    let addedVar = false;
    if (!graphData.constants.has('s')) {
      setConstant(graphData, 's', 1);
      addedVar = true;
    }
    if (!graphData.constants.has('m')) {
      setConstant(graphData, 'm', 0);
      addedVar = true;
    }
    if (addedVar) onUpdateItemList();
    const mean = graphData.constants.get("m").value;
    const stddev = graphData.constants.get("s").value;
    graphData.graph.opts = {
      xstart: mean - 4.5 * stddev,
      xstep: stddev,
      xstepLabel: n => {
        let v = round((n - mean) / stddev, 1);
        let sgn = Math.sign(v) === -1 ? '-' : '+';
        if (v === 0) return mean === 0 ? '0' : 'μ';
        v = Math.abs(v);
        v = (sgn === '+' && mean === 0 ? '' : sgn) + (v === 1 ? '' : v);
        return (mean === 0 ? '' : 'μ') + v + 'σ';
      },
      ystart: 1.1,
      ystep: 0.2,
      subGridDivs: 5,
    };
    onChange();
    popup.hide();
  });
  zoomDiv.appendChild(btnZoomND);

  const pcTable = document.createElement("table");
  popup.insertAdjacentElement("beforeend", pcTable);
  const pcThead = pcTable.createTHead(), pcTbody = pcTable.createTBody();
  const pcTheadRow = document.createElement("tr");
  pcThead.appendChild(pcTheadRow);
  const cols = [];
  const optsArray = [
    { field: 'Complex Maths', col: 1, title: 'Allow arithmatic with complex numbers (must still return a real number)', type: 'boolean', get: () => graphData.isImag, set: v => { graphData.baseExpr.operators = (v ? OPERATORS_IMAG : OPERATORS_DEFAULT); graphData.isImag = v; graphData.baseExpr.parseAllSymbols(); } },
    { field: 'Start X', col: 1, title: 'Left-most X value', type: 'number', get: () => graphData.graph.opts.xstart, set: v => graphData.graph.opts.xstart = +v },
    { field: 'X Step', col: 1, title: 'Width of gap between x-axis markers', type: 'number', get: () => graphData.graph.opts.xstep, set: v => graphData.graph.opts.xstep = +v },
    { field: 'X Step Gap', col: 1, title: 'Gap (in pixels) between each x-axis marker', type: 'number', get: () => graphData.graph.opts.xstepGap, set: v => graphData.graph.opts.xstepGap = +v },
    { field: 'Mark X', col: 1, title: 'Mark x-axis', type: 'boolean', get: () => graphData.graph.opts.markXAxis, set: v => graphData.graph.opts.markXAxis = v },

    { field: 'Start Y', col: 1, title: 'Top-most Y value', type: 'number', get: () => graphData.graph.opts.ystart, set: v => graphData.graph.opts.ystart = +v },
    { field: 'Y Step', col: 1, title: 'Height of gap between y-axis markers', type: 'number', get: () => graphData.graph.opts.ystep, set: v => graphData.graph.opts.ystep = +v },
    { field: 'Y Step Gap', col: 1, title: 'Gap (in pixels) between each y-axis marker', type: 'number', get: () => graphData.graph.opts.ystepGap, set: v => graphData.graph.opts.ystepGap = +v },
    { field: 'Mark Y', col: 1, title: 'Mark y-axis', type: 'boolean', get: () => graphData.graph.opts.markYAxis, set: v => graphData.graph.opts.markYAxis = v },

    { field: 'Axis Thickness', col: 2, title: 'Line thickness of the y/x-axis', type: 'number', get: () => graphData.graph.opts.axisThickness, set: v => graphData.graph.opts.axisThickness = v },
    { field: 'Grid', col: 2, title: 'Show grid', type: 'boolean', get: () => graphData.graph.opts.grid, set: v => graphData.graph.opts.grid = v },
    { field: 'Grid Thickness', col: 2, title: 'Line thickness of the grid', type: 'number', get: () => graphData.graph.opts.gridThickness, set: v => graphData.graph.opts.gridThickness = v },
    { field: 'Sub-Grid Divs', col: 2, title: 'Divisions inside each x/y-axis step', type: 'number', get: () => graphData.graph.opts.subGridDivs, set: v => graphData.graph.opts.subGridDivs = v },
    { field: 'Line Width', col: 2, title: 'Line width of each line function', type: 'number', min: 0, get: () => graphData.graph.opts.lineWidth, set: v => graphData.graph.opts.lineWidth = +v },
    { field: 'Show Coords', col: 2, title: 'Show approx. coordinates next to cursor', type: 'boolean', get: () => graphData.settings.showCoords, set: v => graphData.settings.showCoords = v },

    { field: '&Nscr;-Coords', col: 3, title: 'Number of coordinat points to plot for each line function (directly impacts performance)', type: 'number', get: () => graphData.graph.opts.ncoords, set: v => graphData.graph.opts.ncoords = +v },
    { field: 'Approx. Acc.', col: 3, title: 'Accuracy (decimal places) of approximations i.e. finding roots', type: 'number', get: () => graphData.settings.dpAccuracy, set: v => graphData.settings.dpAccuracy = v },
    { field: 'Display Acc.', col: 3, title: 'Accuracy (decimal places) to round coordinates to when displayed', type: 'number', get: () => graphData.settings.displayDp, set: v => graphData.settings.displayDp = v },
    { field: '&int; Acc.', col: 3, title: 'Number of trapeziums/triangles... used when approximating integral between limits', type: 'number', get: () => graphData.settings.integrateLimitsN, set: v => graphData.settings.integrateLimitsN = +v },

    { field: 'Loop', col: 4, title: 'Loop sound audio', type: 'boolean', get: () => graphData.settings.soundLoop, set: v => graphData.settings.soundLoop = v },
    { field: 'Mult', col: 4, title: 'Multiply sound data by this constant', type: 'number', get: () => graphData.settings.soundMultiplier, set: v => graphData.settings.soundMultiplier = v },
    { field: 'Dur. Mult', col: 4, title: 'Multiply sound duration by this constant', type: 'number', get: () => graphData.settings.soundDurMult, set: v => graphData.settings.soundDurMult = v },
  ];
  const colHeaders = ["X/Y", "Display", "Accuracy", "Sound"];
  optsArray.forEach(opts => {
    if (!cols[opts.col - 1]) cols[opts.col - 1] = [];
    cols[opts.col - 1].push(opts);
  });
  let rowEls = [], maxCol = -1;
  cols.forEach(col => {
    if (col.length > maxCol) maxCol = col.length;
    while (rowEls.length < col.length) {
      const row = document.createElement('tr');
      rowEls.push(row);
      pcTbody.appendChild(row);
    }
  });

  for (let c = 0; c < cols.length; c++) {
    pcTheadRow.insertAdjacentHTML("beforeend", `<th colspan="2">${colHeaders[c]}</th>`);
    let r;
    for (r = 0; r < cols[c].length; r++) {
      const tr = rowEls[r], opts = cols[c][r];
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
    }
    while (r < maxCol) {
      rowEls[r].insertAdjacentHTML("beforeend", "<td class='no-border' colspan='2' />");
      r++;
    }
  };
  return popup;
}

/** Creates and returns new <input /> which allows the editing of an Expression. NB, Expression is directly modified (if no error) */
function generateExpressionInput(expr, onChange = undefined) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = expr.source;
  input.addEventListener("change", () => {
    expr.load(input.value);
    let o = expr.parse();
    if (o.error) {
      alert(`Error defining function:\n${o.msg}`);
    } else if (onChange) {
      onChange();
    }
  });
  return input;
}

/** Create and return <input /> for line sketching conditions */
function generateLineConditionInput(variable, lineData, onChange) {
  const input = document.createElement("input");
  input.type = "text";
  if (lineData.cond) input.value = lineData.condRaw;
  input.placeholder = variable + ' ∈ ℝ';
  input.title = 'Only plot coordinate if TRUE';
  input.addEventListener('change', () => {
    let fn, fnRaw = input.value;
    if (fnRaw === '') {
      delete lineData.condRaw;
      delete lineData.cond;
    } else {
      try {
        fn = Function(lineData.type, 'return ' + fnRaw);
      } catch (e) {
        alert(`Error defining function: ${e.message}`);
        input.value = lineData.condRaw ?? '';
        return;
      }
      lineData.condRaw = fnRaw;
      lineData.cond = fn;
    }
    onChange();
  });
  return input;
}

/** Show popup for a line. If lineData is undefined, allow creation of any line. */
function generateLinePopup(graphData, callback, lineData = undefined) {
  const popup = new Popup("Create Line"), container = document.createElement("div");
  popup.setContent(container);
  let el = document.createElement("p");

  const inputType = document.createElement("select"), defaultType = 'x';
  inputType.insertAdjacentHTML("beforeend", "<option selected disabled>TYPES</option>");
  el.innerHTML = '<strong>Line Type</strong>: ';
  el.appendChild(inputType);
  Object.entries(LINE_TYPES).forEach(([type, desc]) => inputType.insertAdjacentHTML("beforeend", `<option value='${type}' title='${desc}'${type === defaultType ? ' selected' : ''}>${type} - ${LINE_TYPES[type]}</option>`));
  inputType.addEventListener('change', () => populate({ type: inputType.value }, 1));
  container.appendChild(el);

  const divContainer = document.createElement('div');
  container.appendChild(divContainer);
  /** Populate divContainer */
  function populate(lineData, btnType) {
    divContainer.innerHTML = '';
    divContainer.appendChild(generateLineConfigDiv(graphData, lineData, callback, btnType));
  }

  if (lineData) {
    inputType.value = lineData.type;
    inputType.disabled = true;
    populate(lineData, 2);
  } else {
    populate({ type: defaultType }, 1);
  }

  return popup;
}

/** Return <div /> containing line configuration information. btnType: 0 => none, 1 => create line, 2 => update line */
function generateLineConfigDiv(graphData, lineData, callback, btnType = 0) {
  const div = document.createElement('div');
  div.classList.add("line-config");
  div.innerHTML = `<em>${LINE_DESCRIPTIONS[lineData.type]}</em><br>`;
  switch (lineData.type) {
    case 'x':
    case 'y': {
      // Define function if not defined
      if (!lineData.expr) {
        lineData.expr = createNewExpression(graphData, lineData.type);
        lineData.expr.parse();
      }

      let el = document.createElement("p");
      div.appendChild(el);
      el.innerHTML = `&#402;(&${lineData.type}scr;) = `;
      let input = generateExpressionInput(lineData.expr);
      el.appendChild(input);

      el = document.createElement("p");
      div.appendChild(el);
      el.innerHTML = `&Iscr;&fscr; `;
      let inputCond = generateLineConditionInput(graphData, lineData.type === 'x' ? '𝓍' : '𝓎', lineData, () => { });
      el.appendChild(inputCond);
      break;
    }
    case 'z': {
      // Define function if not defined
      if (!lineData.expr) {
        lineData.expr = createNewExpression(graphData, 'x');
        lineData.expr.parse(OPERATORS_IMAG);
      }

      let el = document.createElement("p");
      div.appendChild(el);
      el.innerHTML = `&#402;(&xscr;) = `;
      let inputEquation = generateExpressionInput(lineData.expr, undefined, OPERATORS_IMAG)
      el.appendChild(inputEquation);

      // el = document.createElement("p");
      // div.appendChild(el);
      // el.innerHTML = `&Iscr;&fscr; `;
      // let inputCond = generateLineConditionInput(lineData.type === 'x' ? '𝓍' : '𝓎', lineData, () => { });
      // el.appendChild(inputCond);
      break;
    }
    case 'z2': {
      if (!lineData.expr) {
        lineData.expr = createNewExpression(graphData, 'z');
        lineData.expr.parse();
      }
      lineData.C ??= 0;

      let el = document.createElement("p");
      div.appendChild(el);
      el.innerHTML = `&#402;(&zscr;) = `;
      let inputEquation = generateExpressionInput(lineData.expr, undefined, OPERATORS_IMAG)
      el.appendChild(inputEquation);

      el = document.createElement("p");
      let check = document.createElement("input");
      check.type = "checkbox";
      check.checked = lineData.C;
      check.addEventListener("change", () => lineData.C = +check.checked);
      el.appendChild(check);
      el.insertAdjacentHTML("beforeend", ` Vary brightness according to distance from origin?`);
      div.appendChild(el);
      break;
    }
    case '~': {
      console.log(lineData)
      if (!lineData.expr) {
        lineData.expr = createNewExpression(graphData, "0").parse();
      }
      div.insertAdjacentHTML("beforeend", "<p>&#402;(&xscr;) &#8776; &#402;(&ascr;) + &#402;'(&ascr;)(&xscr;-&ascr;) + (&#402;''(&ascr;)/2!)(&xscr;-&ascr;)<sup>2</sup> + ... + (&#402;<sup>(&nscr;)</sup>(&ascr;)/&nscr;!)(&xscr;-&ascr;)<sup>&nscr;</sup></p>");
      let el = document.createElement("p");
      el.innerText = "Current Approx: ";
      let approxInput = document.createElement("input");
      approxInput.type = "text";
      approxInput.value = lineData.expr.source;
      approxInput.addEventListener("change", () => {
        lineData.expr.load(approxInput.value);
        let o = lineData.expr.parse();
        if (o.error) {
          alert(`Error in expression:\n${o.msg}`);
        }
      })
      div.appendChild(el);
      el.appendChild(approxInput);
      el = document.createElement("p");
      el.innerHTML = `ID of line to approximate: `;
      let selectID = document.createElement("select");
      selectID.insertAdjacentHTML("beforeend", "<option selected disabled>ID</option>");
      graphData.graph.getLines().forEach(id => selectID.insertAdjacentHTML('beforeend', `<option ${id}>${id}</option>`));
      if (lineData.id === undefined) lineData.id = NaN; else selectID.value = lineData.id;
      selectID.addEventListener("change", () => lineData.id = +selectID.value);
      el.appendChild(selectID);
      div.appendChild(el);
      el = document.createElement("p");
      el.insertAdjacentHTML("beforeend", "<abbr title='Value of highest x term'>Approx. Degree</abbr> &nscr; = ");
      let inputN = document.createElement("input");
      inputN.type = "number";
      inputN.min = "0";
      inputN.max = "100";
      lineData.degree ??= 3;
      inputN.value = lineData.degree;
      inputN.addEventListener("change", () => {
        let n = +inputN.value;
        if (n < 0 || isNaN(n)) n = 1;
        lineData.degree = n;
      });
      el.appendChild(inputN);
      div.appendChild(el);
      el = document.createElement("p");
      el.insertAdjacentHTML("beforeend", "<abbr title='Value to approximate function at'>&ascr;</abbr> = ");
      let inputA = document.createElement("input");
      inputA.type = "number";
      lineData.C ??= 0;
      inputA.value = lineData.C;
      inputA.addEventListener("change", () => {
        let a = +inputA.value;
        lineData.C = a;
      });
      el.appendChild(inputA);
      div.appendChild(el);
      break;
    }
    case 'e': {
      if (!lineData.lhs) {
        lineData.lhs = createNewExpression(graphData, "x");
        lineData.lhs.parse();
      }
      if (!lineData.rhs) {
        lineData.rhs = createNewExpression(graphData, "y");
        lineData.rhs.parse();
      }
      lineData.C ??= 0.02;

      let el = document.createElement("p");
      div.appendChild(el);
      el.appendChild(generateExpressionInput(lineData.lhs));
      el.insertAdjacentHTML("beforeend", " = ");
      el.appendChild(generateExpressionInput(lineData.rhs));

      el = document.createElement("p");
      div.appendChild(el);
      el.insertAdjacentHTML("beforeend", "<abbr title='Largest difference between rhs and lhs to plot a point'>&Delta;</abbr> = ");
      let delta = document.createElement("input");
      delta.type = "number";
      delta.value = lineData.C;
      delta.addEventListener("change", () => lineData.C = +delta.value);
      el.appendChild(delta);
      break;
    }
    case 'θ': {
      lineData.range ??= [0, 2 * Math.PI];
      if (!lineData.expr) {
        lineData.expr = createNewExpression(graphData, lineData.type);
        lineData.expr.parse();
      }

      let el = document.createElement("p");
      div.appendChild(el);
      el.innerHTML = `&#402;(a) = `;
      el.appendChild(generateExpressionInput(lineData.expr));

      el = document.createElement("p");
      let inputRangeMin = document.createElement("input");
      inputRangeMin.type = 'text';
      inputRangeMin.value = lineData.range[0];
      inputRangeMin.addEventListener("change", () => updateRange());
      el.appendChild(inputRangeMin);
      el.insertAdjacentHTML("beforeend", ` &leq; a &leq; `);
      let inputRangeMax = document.createElement("input");
      inputRangeMax.type = 'text';
      inputRangeMax.value = lineData.range[1];
      inputRangeMax.addEventListener("change", () => updateRange());
      el.appendChild(inputRangeMax);
      div.appendChild(el);

      el = document.createElement("p");
      el.innerHTML = '<strong>a Step</strong>: ';
      let inputStep = document.createElement("input");
      inputStep.type = 'text';
      inputStep.title = 'Step of a. Leave blank for default.';
      inputStep.placeholder = 'Default';
      if (lineData.range[2] !== undefined) inputStep.value = lineData.range[2];
      inputStep.addEventListener("change", () => {
        if (inputStep.value.length === 0) {
          lineData.range.splice(2, 1);
        } else {
          let step;
          try {
            step = +eval(inputStep.value.trim());
          } catch (e) {
            return alert(`Error: ${e.message}`);
          }
          if (step <= 0 || isNaN(step) || !isFinite(step)) return alert(`Invalid step: must be finite number >0`);
          lineData.range[2] = step;
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
          lineData.range[0] = min;
          lineData.range[1] = max;
          inputRangeMin.value = min;
          inputRangeMax.value = max;
        } catch (e) {
          alert(`Error updating range: ${e.message}`);
        }
      }

      break;
    }
    case 'p': {
      lineData.range ??= [-2, 2];
      if (!lineData.exprx) {
        lineData.exprx = createNewExpression(graphData, PARAMETRIC_VARIABLE);
        lineData.exprx.parse();
      }
      if (!lineData.expry) {
        lineData.expry = createNewExpression(graphData, PARAMETRIC_VARIABLE);
        lineData.expry.parse();
      }

      let el = document.createElement("p");
      el.innerHTML = `&#402;<sub>&xscr;</sub>(${PARAMETRIC_VARIABLE}) = `;
      el.appendChild(generateExpressionInput(lineData.exprx, undefined));
      div.appendChild(el);

      el = document.createElement("p");
      el.innerHTML = `&#402;<sub>&yscr;</sub>(${PARAMETRIC_VARIABLE}) = `;
      el.appendChild(generateExpressionInput(lineData.expry, undefined));
      div.appendChild(el);

      el = document.createElement("p");
      let inputRangeMin = document.createElement("input");
      inputRangeMin.type = 'text';
      inputRangeMin.value = lineData.range[0];
      inputRangeMin.addEventListener("change", () => updateRange());
      el.appendChild(inputRangeMin);
      el.insertAdjacentHTML("beforeend", ` &leq; ${PARAMETRIC_VARIABLE} &leq; `);
      let inputRangeMax = document.createElement("input");
      inputRangeMax.type = 'text';
      inputRangeMax.value = lineData.range[1];
      inputRangeMax.addEventListener("change", () => updateRange());
      el.appendChild(inputRangeMax);
      div.appendChild(el);

      el = document.createElement("p");
      el.innerHTML = `<strong>${PARAMETRIC_VARIABLE} Step</strong>: `;
      let inputStep = document.createElement("input");
      inputStep.type = 'text';
      inputStep.title = `Step of ${PARAMETRIC_VARIABLE}. Leave blank for default.`;
      inputStep.placeholder = 'Default';
      if (lineData.range[2] !== undefined) inputStep.value = lineData.range[2];
      inputStep.addEventListener("change", () => {
        if (inputStep.value.length === 0) {
          lineData.range.splice(2, 1);
        } else {
          let step;
          try {
            step = +eval(inputStep.value.trim());
          } catch (e) {
            return alert(`Error: ${e.message}`);
          }
          if (step <= 0 || isNaN(step) || !isFinite(step)) return alert(`Invalid step: must be finite number >0`);
          lineData.range[2] = step;
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
          lineData.range = [min, max];
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
      const method = lineData.type === 'd' ? 'differentiate' : 'integrate';
      let el = document.createElement("p");
      el.innerHTML = `ID of line to ${method}: `;
      let selectID = document.createElement("select");
      selectID.insertAdjacentHTML("beforeend", "<option selected disabled>ID</option>");
      graphData.graph.getLines().forEach(id => selectID.insertAdjacentHTML('beforeend', `<option ${id}>${id}</option>`));
      if (lineData.id === undefined) lineData.id = NaN; else selectID.value = lineData.id;
      selectID.addEventListener("change", () => lineData.id = +selectID.value);
      el.appendChild(selectID);
      div.appendChild(el);

      if (lineData.type === 'i') {
        lineData.C ??= 0;
        el = document.createElement("p");
        el.innerHTML = '<abbr title="Integration Constant">&Cscr;</abbr> = ';
        let inputC = document.createElement("input");
        inputC.type = 'text';
        inputC.value = lineData.C;
        inputC.addEventListener("change", () => {
          let C;
          try {
            C = +eval(inputC.value);
          } catch (e) {
            return alert(`Error whilst updating C: ${e.message}`);
          }
          lineData.C = C;
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
      lineData.ids ??= [];
      let symbol;
      if (lineData.type === 's') symbol = '-';
      else if (lineData.type === 'm') symbol = '*';
      else symbol = '+';
      let el = document.createElement("p");
      el.innerHTML = `Enter line IDs seperated by ${symbol}:<br>`;
      let input = document.createElement("input");
      input.type = "text";
      input.placeholder = `0 ${symbol} 1`;
      input.value = lineData.ids.join(' ' + symbol + ' ');
      input.addEventListener('change', () => {
        try {
          let ids = input.value.split(symbol).map(x => parseInt(x.trim()));
          lineData.ids = ids;
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
      lineData.C ??= [1, 0, 1, 0, 0];

      let el = document.createElement('p');
      div.appendChild(el);
      el.innerHTML = `ID of line to translate: `;
      let selectID = document.createElement("select");
      selectID.insertAdjacentHTML("beforeend", "<option selected disabled>ID</option>");
      graphData.graph.getLines().forEach(id => selectID.insertAdjacentHTML('beforeend', `<option ${id}>${id}</option>`));
      lineData.id ??= NaN;
      if (!isNaN(lineData.id)) selectID.value = lineData.id;
      selectID.addEventListener("change", () => lineData.id = +selectID.value);
      el.appendChild(selectID);

      // TRANSLATE (SHIFT)
      el = document.createElement('p');
      el.insertAdjacentHTML('beforeend', `<strong>Translate</strong>: (`);
      let transInputX = document.createElement('input');
      transInputX.type = 'number';
      transInputX.value = lineData.C[1];
      transInputX.title = 'X Coordinate';
      transInputX.step = graphData.graph.opts.xstep;
      transInputX.classList.add('small');
      transInputX.addEventListener('change', e => {
        lineData.C[1] = +e.target.value;
      });
      el.appendChild(transInputX);
      el.insertAdjacentHTML('beforeend', `, `);
      let transInputY = document.createElement('input');
      transInputY.type = 'number';
      transInputY.classList.add('small');
      transInputY.value = lineData.C[3];
      transInputY.title = 'Y Coordinate';
      transInputY.step = graphData.graph.opts.ystep;
      transInputY.addEventListener('change', e => {
        lineData.C[3] = +e.target.value;
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
      scaleInputX.value = lineData.C[0];
      scaleInputX.title = 'X Coordinate multiplier';
      scaleInputX.classList.add('small');
      scaleInputX.addEventListener('change', e => {
        lineData.C[0] = +e.target.value;
      });
      el.appendChild(scaleInputX);
      el.insertAdjacentHTML('beforeend', `&Xscr;, `);
      let scaleInputY = document.createElement('input');
      scaleInputY.type = 'number';
      scaleInputY.value = lineData.C[2];
      scaleInputY.title = 'Y Coordinate multiplier';
      scaleInputY.classList.add('small');
      scaleInputY.addEventListener('change', e => {
        lineData.C[2] = +e.target.value;
      });
      el.appendChild(scaleInputY);
      el.insertAdjacentHTML('beforeend', '&Yscr;');

      // TRANSLATE (ROTATION)
      el = document.createElement("p");
      div.appendChild(el);
      el.insertAdjacentHTML('beforeend', `<strong><abbr title='Rotate function by <angle> radians'>Angle</abbr></strong>: `);
      let rotInput = document.createElement('input');
      rotInput.type = 'text';
      rotInput.value = lineData.C[4];
      rotInput.addEventListener('change', e => {
        try {
          const theta = (+eval(e.target.value)) % (2 * Math.PI);
          rotInput.value = theta;
          lineData.C[4] = theta;
          displayRadians(theta);
        } catch (e) {
          rotInput.value = lineData.C[4];
          alert(`Error setting angle: ${e.message}`);
        }
      });
      el.appendChild(rotInput);
      el.insertAdjacentHTML('beforeend', ' &#8776; ');
      const rotValue = document.createElement('span');
      const displayRadians = theta => rotValue.innerHTML = `<abbr title='${theta} rad'>${round(theta / Math.PI, 3)}&pi;</abbr>`;
      displayRadians(lineData.C[4]);
      el.appendChild(rotValue);
      el.insertAdjacentHTML('beforeend', ' rad');
      break;
    }
    case 'c': {
      let table = document.createElement('table'), tbody = table.createTBody();
      table.insertAdjacentHTML("afterbegin", "<thead><tr><th>&Xscr;</th><th>&Yscr;</th></tr></thead>");
      div.appendChild(table);
      lineData.coords ??= [];
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
            lineData.coords[i][0] = x;
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
            lineData.coords[i][1] = y;
          } catch (e) {
            alert(`Error: ${e.message}`);
          }
        });
        td.appendChild(inputY);

        let btnDel = document.createElement('button');
        btnDel.innerHTML = '&times';
        btnDel.title = 'Remove coordinate pair';
        btnDel.addEventListener('click', () => {
          lineData.coords.splice(i, 1);
          tr.remove();
        });

        td = document.createElement('td');
        td.appendChild(btnDel);
        tr.appendChild(td);
        return tr;
      }
      lineData.coords.forEach(([x, y], i) => tbody.appendChild(generateRow(x, y, i)));
      let tfoot = table.createTFoot(), tr = document.createElement('tr'), td = document.createElement('td');
      tfoot.appendChild(tr);
      tr.appendChild(td);
      let btnNew = document.createElement('button');
      btnNew.innerHTML = '+ Add';
      btnNew.addEventListener("click", () => {
        let coords = [0, 0];
        lineData.coords.push(coords);
        tbody.appendChild(generateRow(...coords, lineData.coords.length - 1));
      });
      td.appendChild(btnNew);
      break;
    }
    default:
      div.innerHTML = `<em><strong>Unknown line type ${lineData.type}</strong></em>`;
      return div;
  }

  let el = document.createElement("span");
  el.innerHTML = '<strong>Shade</strong>: ';
  let selectShade = document.createElement("select");
  for (let name in SHADE_ENUM) selectShade.insertAdjacentHTML("beforeend", `<option value="${name}" title="${SHADE_DESC[name]}"${lineData.shade === name ? " selected" : ""}>${SHADE_ENUM[name]}</option>`);
  selectShade.addEventListener("change", () => lineData.shade = selectShade.value);
  el.appendChild(selectShade);
  div.appendChild(el);

  div.insertAdjacentHTML("beforeend", "<br>");
  el = document.createElement("span");
  el.innerHTML = '<strong>Line Width</strong>: ';
  let inputLineWidth = document.createElement("input");
  inputLineWidth.type = "number";
  inputLineWidth.value = lineData.lineWidth ?? graphData.graph.opts.lineWidth;
  inputLineWidth.addEventListener("change", () => lineData.lineWidth = +inputLineWidth.value);
  el.appendChild(inputLineWidth);
  div.appendChild(el);

  div.insertAdjacentHTML("beforeend", "<br>");
  el = document.createElement("span");
  el.innerHTML = '<strong>Join</strong>: ';
  let inputJoin = document.createElement("input");
  inputJoin.type = "checkbox";
  inputJoin.checked = lineData.join === undefined || lineData.join;
  inputJoin.addEventListener("change", () => lineData.join = inputJoin.checked);
  el.appendChild(inputJoin);
  div.appendChild(el);

  div.insertAdjacentHTML("beforeend", "<br>");
  el = document.createElement("span");
  el.innerHTML = '<strong>Color</strong>: ';
  let inputColor = document.createElement("input");
  inputColor.type = "color";
  inputColor.value = lineData.color;
  inputColor.addEventListener("change", () => lineData.color = inputColor.value);
  el.appendChild(inputColor);
  div.appendChild(el);

  if (btnType !== 0) {
    div.insertAdjacentHTML("beforeend", "<br>");
    let btn = document.createElement('button');
    if (btnType === 1) btn.innerText = 'Create Line';
    else if (btnType === 2) btn.innerText = 'Update Line';
    btn.addEventListener("click", () => callback(lineData));
    div.appendChild(btn);
  }

  return div;
}

/** Generate Button and Input to plot points for a given line */
function generateButtonCheckboxPoints(graphData, lineID, typeID, btnText, btnTitle, lineMapProp, pageTitle, getCoordsFn) {
  let btn = createButton(btnText, btnTitle, () => {
    const coords = getCoordsFn();
    const win = window.open('about:blank');
    win.document.head.insertAdjacentHTML("beforeend", `<meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="src/style.css">
  <link rel="shortcut icon" href="src/favicon.ico" type="image/x-icon">`);
    win.document.title = `Coords: ${btnText} for ${lineID}`;
    win.document.body.insertAdjacentHTML('beforeend', `<h1>${pageTitle}</h1>`);
    win.document.body.insertAdjacentHTML('beforeend', `<p>Line <code>${lineID}</code></p>`);
    const btnCSV = win.document.createElement('button');
    btnCSV.innerText = 'As CSV';
    btnCSV.addEventListener("click", () => {
      let csv = coords.map(([x, y]) => x + ',' + y).join('\n');
      downloadTextFile(csv, `coords-${lineID}.csv`);
    });
    win.document.body.appendChild(btnCSV);
    const ul = win.document.createElement('ul');
    win.document.body.appendChild(ul);
    coords.forEach(([x, y]) => ul.insertAdjacentHTML('beforeend', `<li><kbd>(${x}, ${y})</kbd></li>`));
  });

  let input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!graphData.lines.get(lineID)[lineMapProp];
  input.title = `Sketch ${btnTitle}`;
  input.addEventListener('change', e => {
    const data = graphData.lines.get(lineID);
    if (e.target.checked) {
      data[lineMapProp] = true;
      const coords = getCoordsFn();
      if (!coords) return;
      graphData.graph.addPoints(coords.map(([x, y]) => ({ lineID, typeID, x, y })));
    } else {
      delete data[lineMapProp];
      graphData.graph.removePoints({ lineID, typeID });
    }
    // Update canvas
    graphData.renderParams.caches.line.update = true;
    graphData.renderParams.caches.points.update = true;
    graphData.renderParams.update = true;
  });

  return { btn, input };
}

/** Generate <input type="checkbox" /> which toggles a given lineMap property */
function generateCheckboxForLine(graphData, lineID, prop, title) {
  const data = graphData.lines.get(lineID);
  const input = document.createElement('input');
  input.type = "checkbox";
  input.checked = !!data[prop];
  input.title = title;
  input.addEventListener("change", () => {
    if (input.checked) {
      data[prop] = true;
    } else {
      delete data[prop];
    }
    graphData.renderParams.caches.line.update = true;
    graphData.renderParams.update = true;
  });
  return input;
}

/** Populate "analyse line" div */
function populateLineAnalysisDiv(parent, graphData, lineID, itemListContainer) {
  parent.dataset.lineID = lineID; // Update attribute
  parent.innerHTML = `<span class='line-id'>ID ${lineID}</span>`;
  const lineData = graphData.graph.getLine(lineID);
  let input, btn;

  if (lineData.type === 'z2') { // Special
    const divGen = document.createElement('div');
    divGen.appendChild(createButton("Roots", "Find roots of complex map", () => {
      // TODO: RETURNS FALSE POSITIVES
      let roots = [], lastB, w = graphData.graph.width;
      lastB = lineData.coords[0][0].b;

      for (let i = w; i < lineData.coords.length - w; ++i) {
        const [zIn, zOut] = lineData.coords[i];
        if (Math.abs(zIn.b - lastB) <= Number.EPSILON) {
          let zUp = lineData.coords[i - w][1];
          let zDown = lineData.coords[i + w][1];
          let zLeft = lineData.coords[i - 1][1];
          let zRight = lineData.coords[i + 1][1];
          let zOutMag = zOut.getMag();
          if (Math.sign(zLeft.getMag() - zOutMag) === -Math.sign(zOutMag - zRight.getMag()) && Math.sign(zUp.getMag() - zOutMag) === -Math.sign(zOutMag - zDown.getMag())) {
            roots.push(i);
          }
        }
        lastB = zIn.b;
      }

      graphData.graph.addPoints(roots.map(i => {
        const z = lineData.coords[i][0];
        return { lineID, typeID: 6, x: z.a, y: z.b };
      }));
      // Update canvas
      // graphData.renderParams.caches.line.update = true;
      graphData.renderParams.caches.points.update = true;
      graphData.renderParams.update = true;
    }));
    parent.appendChild(divGen);
    return;
  }

  // Calculus
  const divCalculus = document.createElement("div");
  parent.appendChild(divCalculus);
  divCalculus.innerHTML = "<span>Calculus</span> ";

  // Differentiate
  divCalculus.appendChild(createButton("&dscr;&xscr;", "Sketch the derivative of this function (gradient curve)", () => {
    addLine({ type: 'd', id: lineID }, graphData); // Differentiate this line
    populateItemList(itemListContainer, graphData, parent);
    graphData.renderParams.caches.line.update = true;
    graphData.renderParams.update = true;
  }));
  // Integrate
  divCalculus.appendChild(createButton("&int;", "Sketch the antiderivative of this function", () => {
    addLine({ type: 'i', id: lineID }, graphData); // Integrate this line
    populateItemList(itemListContainer, graphData, parent);
    graphData.renderParams.caches.line.update = true;
    graphData.renderParams.update = true;
  }));
  // Integrate between limits
  divCalculus.appendChild(createButton("&int;<span class=\"sub-sup\"><sup>b</sup><sub>a</sub></span>&nbsp;&nbsp;&nbsp;", "Integrate between limits - find area under curve", () => {
    graphData.itemListItems.push({ type: "defint", lineID, a: 0, b: 1, step: 0.5 });
    populateItemList(itemListContainer, graphData, parent);
    graphData.renderParams.caches.shadeArea.update = true;
    graphData.renderParams.update = true;
  }));
  // Approximate
  divCalculus.appendChild(createButton("~", "Approximate function using Taylor series", () => {
    addLine({ type: '~', id: lineID, degree: 3, C: 0, expr: createNewExpression(graphData) }, graphData); // Taylor approximation of 3rd degree
    populateItemList(itemListContainer, graphData, parent);
    graphData.renderParams.caches.line.update = true;
    graphData.renderParams.update = true;
  }));

  // Coordinate Analysis
  const divCoords = document.createElement("div");
  parent.appendChild(divCoords);
  divCoords.innerHTML = "<span>Points</span> ";
  // View all coords
  ({ btn } = generateButtonCheckboxPoints(graphData, lineID, null, '&forall;', 'View all points in a table', null, 'Table of Coordinates', () => graphData.graph.getLine(lineID).coords));
  divCoords.appendChild(btn);
  // Y-intercepts
  ({ btn, input } = generateButtonCheckboxPoints(graphData, lineID, 0, '&Yscr;-Int', 'Calculate approx. y-intercepts', 'yInt', 'Approximate Y-Intercepts', () => graphData.graph.getAxisIntercept(lineID, 'y')));
  divCoords.appendChild(btn);
  divCoords.appendChild(input);
  // Roots
  ({ btn, input } = generateButtonCheckboxPoints(graphData, lineID, 1, 'Roots', 'calculate approx. roots', 'roots', 'Approximate Roots', () => graphData.graph.getAxisIntercept(lineID, 'x')));
  divCoords.appendChild(btn);
  divCoords.appendChild(input);
  // Intercept with another line
  ({ btn, input } = generateButtonCheckboxPoints(graphData, lineID, 5, 'Int', 'calculate approx. intercepts with another line', 'int', 'Approximate Intercepts', () => {
    const oid = prompt(`ID of line to intercept with`);
    if (!oid) return;
    const oline = graphData.graph.getLine(+oid);
    if (!oline) return alert(`Line ID ${oid} does not exist`);
    return graphData.graph.getIntercepts(lineData.coords, oline.coords, 3);
  }));
  divCoords.appendChild(btn);
  divCoords.appendChild(input);
  // Maximum points
  ({ btn, input } = generateButtonCheckboxPoints(graphData, lineID, 3, 'Max', 'calculate approx. local maximum points', 'max', 'Approximate Maximum Points', () => graphData.graph.getMaxPoints(lineID)));
  divCoords.appendChild(btn);
  divCoords.appendChild(input);
  // Minimum points
  ({ btn, input } = generateButtonCheckboxPoints(graphData, lineID, 2, 'Min', 'calculate approx. local minimum points', 'min', 'Approximate Minimum Points', () => graphData.graph.getMinPoints(lineID)));
  divCoords.appendChild(btn);
  divCoords.appendChild(input);
  // Turning points
  ({ btn, input } = generateButtonCheckboxPoints(graphData, lineID, 4, 'Turning', 'calculate approx. turning points', 'turning', 'Approximate Turning Points', () => graphData.graph.getTurningPoints(lineID)));
  divCoords.appendChild(btn);
  divCoords.appendChild(input);
  // Highlight coords with given X
  ({ btn, input } = generateButtonCheckboxPoints(graphData, lineID, -1, '&Xscr;', 'return coordinates with given x-coordinate', 'xCoord', 'Coordinates with given X', () => {
    let x = eval(prompt(`X-Coordinate`));
    if (!x) return;
    return getCorrespondingCoordinate(x, 'x', lineData.coords, true);
  }));
  divCoords.appendChild(btn);
  divCoords.appendChild(input);
  // Highlight coords with given Y
  ({ btn, input } = generateButtonCheckboxPoints(graphData, lineID, -1, '&Yscr;', 'return coordinates with given y-coordinate', 'yCoord', 'Coordinates with given Y', () => {
    let y = eval(prompt(`Y-Coordinate`));
    if (!y) return;
    return getCorrespondingCoordinate(y, 'y', lineData.coords, true);
  }));
  divCoords.appendChild(btn);
  divCoords.appendChild(input);

  // Trace
  const divTrace = document.createElement('div');
  parent.appendChild(divTrace);
  divTrace.innerHTML = "<span>Trace</span> ";

  // Trace X coordinates
  divTrace.insertAdjacentHTML("beforeend", "<span>&Xscr;</span>");
  input = generateCheckboxForLine(graphData, lineID, 'traceX', 'Show current x-coordinate intercept with function');
  divTrace.appendChild(input);
  // Trace Y coordinates
  divTrace.insertAdjacentHTML("beforeend", "<span>&Yscr;</span>");
  input = generateCheckboxForLine(graphData, lineID, 'traceY', 'Show current y-coordinate intercept with function');
  divTrace.appendChild(input);

  // Tangent
  const divTangent = document.createElement('div');
  parent.appendChild(divTangent);
  divTangent.innerHTML = "<span>Tangent</span> ";
  input = generateCheckboxForLine(graphData, lineID, 'tangent', 'Draw tangent at X intercepts if tracing X and Y intercepts if tracing Y');
  divTangent.appendChild(input);

  // Sound
  const divSound = document.createElement('div');
  parent.appendChild(divSound);
  divSound.insertAdjacentHTML("beforeend", "<abbr title='Play function as sound'>&#x1f50a;</abbr> ");
  input = document.createElement('input');
  input.checked = graphData.lines.get(lineID).audio !== undefined;
  input.type = 'checkbox';
  input.addEventListener('change', async e => {
    const data = graphData.lines.get(lineID);
    if (e.target.checked) await playAudioForLine(graphData, lineID); // Play curve
    if (data.audio) { // If exists, stop sound
      data.audio.source.stop();
      delete data.audio;
      e.target.checked = false;
    }
  });
  divSound.appendChild(input);
}

/** Generate popup for functions */
function generateFunctionPopup(graphData, onChange) {
  const popup = new Popup('Functions'), container = document.createElement('div');
  popup.setContent(container);
  const table = document.createElement('table');
  table.insertAdjacentHTML("beforeend", "<thead><tr><th>Function</th><th>Arguments</th><th>Body</th><th>Delete</th></tr></thead>");
  container.appendChild(table);
  const tbody = table.createTBody();
  function createRow(name) {
    const tr = document.createElement("tr"), info = graphData.baseExpr.constSymbols.get(name);
    tr.insertAdjacentHTML("beforeend", `<th>${name}</th>`);
    let td = document.createElement("td");
    let inpArguments = document.createElement("input");
    inpArguments.value = info.args.join(', ');
    inpArguments.title = 'Function arguments seperated by commas';
    inpArguments.addEventListener('change', () => {
      info.args = inpArguments.value.split(',').map(x => x.trim()).filter(x => x.length > 0);
      inpArguments.value = info.args.join(', ');
      graphData.baseExpr.parseSymbol(name);
      if (graphData.baseExpr.error) return alert(graphData.baseExpr.handleError());
      onChange();
    });
    td.appendChild(inpArguments);
    tr.appendChild(td);

    td = document.createElement("td");
    let inpBody = document.createElement("input");
    inpBody.value = info.body.trim();
    inpBody.title = 'Function body';
    inpBody.addEventListener('change', () => {
      info.body = inpBody.value = inpBody.value.trim();
      graphData.baseExpr.parseSymbol(name);
      if (graphData.baseExpr.error) return alert(graphData.baseExpr.handleError());
      onChange();
    });
    td.appendChild(inpBody);
    tr.appendChild(td);

    let delBtn = document.createElement("button");
    delBtn.innerHTML = '&times;';
    delBtn.addEventListener('click', () => {
      removeFunction(graphData, name);
      tr.remove();
      onChange();
    });
    td = document.createElement("td");
    td.appendChild(delBtn);
    tr.appendChild(td);
    return tr;
  }

  graphData.funcs.forEach(name => tbody.appendChild(createRow(name)));
  let tfoot = table.createTFoot(), tr = document.createElement("tr"), td = document.createElement("td"), newBtn = document.createElement("button");
  table.appendChild(tfoot);
  newBtn.innerHTML = '&plus; Define Function';
  newBtn.addEventListener('click', () => {
    let name = prompt('Enter function name');
    if (name) {
      if (!name.match(CONSTANT_SYM_REGEX)) return alert(`Invalid function name - must match ${CONSTANT_SYM_REGEX}`);
      if (graphData.baseExpr.hasSymbol(name)) return alert(`Symbol ${name} is already in use`);
      createFunction(graphData, name, ['x'], 'x', true);
      tbody.appendChild(createRow(name));
      onChange();
    }
  });
  td.appendChild(newBtn);
  td.colSpan = 4;
  tr.appendChild(td);
  tfoot.appendChild(tr);
  return popup;
}

/** Play audio for curve with id <lineID>. NB does not remove data.audio attribute */
async function playAudioForLine(graphData, lineID) {
  return new Promise(res => {
    const data = graphData.lines.get(lineID), lineData = graphData.graph.getLine(lineID);
    const o = getAudioFromCoords(lineData.coords, graphData.settings.soundDurMult, graphData.settings.soundMultiplier);
    data.audio = o; // Save to lineMap
    o.source.loop = graphData.settings.soundLoop;
    o.source.start();
    o.source.onended = () => {
      o.source.stop();
      res(data.audio);
    };
  });
}

window.addEventListener("load", main);