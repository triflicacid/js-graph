import { Graph } from "./Graph.js";
import { Point } from "./Point.js";
import Popup from "./Popup.js";
import { extractCoords, round, clamp, hideEl, showEl, createButton, getCorrespondingCoordinate, getCorrepondingCoordinateIndex, getAudioFromCoords, log, random, factorial } from "./utils.js";

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
  'θ': 'Polar: θ is an angle in radians with the polar point [fn(θ), θ] being plotted.',
  '~': 'Approximate function around a point using the Taylor series',
};
const PARAMETRIC_VARIABLE = 'p';
const CONSTANT_SYM_REGEX = /^[a-z][a-z0-9_]*$/gmi;

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
        const popup = generateConfigPopup(graphData.graph, graphData.settings, () => {
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
      const popup = generateLinePopup(graphData.graph, lineData => {
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
      if (graphData.constants.has(sym)) return alert(`Constant with symbol '${sym}' already exists`);
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
          if (graphData.graph.getLine(lineID).draw !== false) {
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

    const graphData = setupGraph(canvasContainer);
    graphData.addEvents();
    graphData.render();

    // Common functions
    setRawFunction(graphData, 'pow', Math.pow);
    setRawFunction(graphData, 'abs', Math.abs);
    setRawFunction(graphData, 'round', round);
    setRawFunction(graphData, 'floor', Math.floor);
    setRawFunction(graphData, 'ceil', Math.ceil);
    setRawFunction(graphData, 'sgn', Math.sign);
    setRawFunction(graphData, 'sqrt', Math.sqrt);
    setRawFunction(graphData, 'exp', Math.exp);
    setRawFunction(graphData, 'sin', Math.sin);
    setRawFunction(graphData, 'arcsin', Math.asin);
    setRawFunction(graphData, 'sinh', Math.sinh);
    setRawFunction(graphData, 'arcsinh', Math.asinh);
    setRawFunction(graphData, 'csc', n => 1 / Math.sin(n));
    setRawFunction(graphData, 'cos', Math.cos);
    setRawFunction(graphData, 'arccos', Math.acos);
    setRawFunction(graphData, 'cosh', Math.cosh);
    setRawFunction(graphData, 'arccosh', Math.acosh);
    setRawFunction(graphData, 'sec', n => 1 / Math.cos(n));
    setRawFunction(graphData, 'tan', Math.tan);
    setRawFunction(graphData, 'arctan', Math.atan);
    setRawFunction(graphData, 'tanh', Math.tanh);
    setRawFunction(graphData, 'arctanh', Math.atanh);
    setRawFunction(graphData, 'cot', n => 1 / Math.tan(n));
    setRawFunction(graphData, 'log', log);
    setRawFunction(graphData, 'clamp', clamp);
    setRawFunction(graphData, 'rand', random);
    setRawFunction(graphData, 'factorial', factorial);
    setFunction(graphData, 'frac', ['x'], 'x - floor(x)', true);
    setFunction(graphData, 'sawtooth', ['x', 'T', 'A=1', 'P=0'], 'A * frac(x / T + P)', true);
    setFunction(graphData, 'sinc', ['x'], 'x == 0 ? 1 : sin(pi*x)/(pi*x)', true);
    setFunction(graphData, 'ndist', ['x', 'μ=0', 'σ=1'], '(1/(σ * sqrt(2 * pi))) * e ** (-0.5 * ((x - μ) / σ) ** 2)', true);

    // === USER CODE ===
    let id = addLine(createLine("x", "x**3 - 3*x", undefined, { color: "#FF00F9" }), graphData);
    populateLineAnalysisDiv(analysisOptionsDiv, graphData, id, itemListContainer);
    window.graph = graphData.graph;
    // =================

    populateItemList(itemListContainer, graphData, analysisOptionsDiv);
}

/** Sets up graph and attached it to a given parent element */
function setupGraph(parent) {
    const returnObj = { parent };

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
    };
    returnObj.settings = settings;

    // Line map - [id => { audio }]
    const lines = new Map();
    returnObj.lines = lines;
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
    renderParams.caches.points = { // Caches points of interest (Point[])
        data: undefined,
        update: true,
        create() {
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
            if (renderParams.showCoords) {
                ctx.beginPath();
                ctx.fillStyle = "black";
                ctx.arc(...renderParams.coords, 2, 0, 2*Math.PI);
                ctx.fill();
                ctx.font = '11px Arial';
                ctx.fillText(`(${round(renderParams.graphCoords[0], 2)}, ${round(renderParams.graphCoords[1], 2)})`, coords[0] + 5, coords[1] - 5);
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
                    graph.ctx.arc(originCoords[0], renderParams.coords[1], 4, 0, 2*Math.PI);
                    graph.ctx.arc(...lineCoords, 4, 0, 2*Math.PI);
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
                    graph.ctx.arc(renderParams.coords[0], originCoords[1], 4, 0, 2*Math.PI);
                    graph.ctx.arc(...lineCoords, 4, 0, 2*Math.PI);
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
    globalThis.e = Math.e;

    // Function map
    const funcs = new Map(); // funcname: string => { fn: Function, args: string[], source: string, visible: boolean }
    returnObj.funcs = funcs;

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

/** Create and return line data object from minimal arguments */
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
    graphData.constants.set(name).value = value;
  } else {
    graphData.constants.set(name, { value });
  }
  globalThis[name] = value;
}

/** Remove a constant */
function removeConstant(graphData, name) {
  if (graphData.constants.has(name)) {
    graphData.constants.delete(name);
    delete globalThis[name];
  }
}

/** Create/update a function */
function setFunction(graphData, name, args = undefined, source = undefined, visible = undefined) {
  if (graphData.funcs.has(name)) {
    const data = graphData.funcs.get(name);
    if (args !== undefined) data.args = args;
    if (source !== undefined) data.source = source;
    if (visible !== undefined) data.visible = !!visible;
    data.fn = Function(args, 'return ' + source);
  } else {
    graphData.funcs.set(name, { args, source, fn: Function(args, 'return ' + source), visible: !!visible });
  }
  const data = graphData.funcs.get(name);
  globalThis[name] = data.fn;
}

function setRawFunction(graphData, name, fn) {
  if (graphData.funcs.has(name)) {
    graphData.funcs.get(name).fn = fn;
  } else {
    graphData.funcs.set(name, { fn, visible: false });
  }
  const data = graphData.funcs.get(name);
  globalThis[name] = data.fn;

}

/** Remove a function */
function removeFunction(graphData, name) {
  if (graphData.funcs.has(name)) {
    graphData.funcs.delete(name);
    delete globalThis[name];
  }
}

/** Populate Item List */
function populateItemList(listEl, graphData, analysisOptionsDiv) {
  listEl.innerHTML = ""; // Clear element

  graphData.lines.forEach((obj, id) => {
    const card = generateLineCard(id, graphData, analysisOptionsDiv, listEl, () => {
      card.remove();
      if (+analysisOptionsDiv.dataset.lineID === id) analysisOptionsDiv.innerHTML = ''; // Remove from analysis section
    }, () => populateItemList(listEl, graphData, analysisOptionsDiv));
    listEl.appendChild(card);
  });

  graphData.constants.forEach((_, name) => {
    const card = generateConstantCard(name, graphData, n => {
      graphData.renderParams.caches.line.update = true;
      graphData.renderParams.update = true;
    },() => {
      card.remove();
      graphData.renderParams.caches.line.update = true;
      graphData.renderParams.update = true;
    });
    listEl.appendChild(card);
  });
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
    card.style.backgroundColor = lineData.draw === false ? '' : 'rgba(' + (lineData.color || '#000000').substr(1).match(/..?/g).map(hex => parseInt(hex, 16)).join(",") + ',0.5)';
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
    editDiv = generateLineConfigDiv(graphData.graph, lineData, () => {
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
    /** TODO: DEEP COPY **/
    addLine({ ...lineData }, graphData); // Copy line data
    reRender(); // Re-render entire list of item cards
  });
  divButtons.appendChild(btnCopy);

  // button: draw line?
  lineData.draw = lineData.draw === undefined || lineData.draw;
  const updateBtnDraw = () => {
    btnDraw.innerHTML = lineData.draw ? '<span class="cross-out">&#x1f441;</span>' : '<span>&#x1f441;</span>';
    btnDraw.title = lineData.draw ? 'Hide line' : 'Show line';
  };
  const btnDraw = document.createElement('button');
  updateBtnDraw();
  btnDraw.addEventListener('click', () => {
    lineData.draw = !lineData.draw;
    updateBtnDraw();
    updateLineData();
  });
  divButtons.appendChild(btnDraw);

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

/** Generate DIV which contains an overview of line data (used in .line-card) */
function generateLineCardOverview(lineID, lineData, graphData, onChange) {
  const div = document.createElement("div");
  div.classList.add("line-overview");
  const span = document.createElement("span");
  div.appendChild(span);

  switch (lineData.type) {
    case 'x': case 'y': {
      span.innerHTML += `&#402;(&${lineData.type}scr;) = `;
      span.appendChild(generateLineFunctionInput(lineData.type, lineData.fnRaw, (fn, fnRaw) => {
        lineData.fnRaw = fnRaw;
        lineData.fn = fn;
        onChange();
      }));
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
      p.appendChild(generateLineFunctionInput(PARAMETRIC_VARIABLE, lineData.fnxRaw, (fn, fnRaw) => {
        lineData.fnx = fn;
        lineData.fnxRaw = fnRaw;
        onChange();
      }));
      div.appendChild(p);

      p = document.createElement("p");
      p.innerHTML = `&#402;<sub>&yscr;</sub>(${PARAMETRIC_VARIABLE}) = `;
      p.appendChild(generateLineFunctionInput(PARAMETRIC_VARIABLE, lineData.fnyRaw, (fn, fnRaw) => {
        lineData.fny = fn;
        lineData.fnyRaw = fnRaw;
        onChange();
      }));
      div.appendChild(p);

      break;
    }
    case 'θ': {
      span.innerHTML += `&#402;(θ) = `;
      span.appendChild(generateLineFunctionInput("θ", lineData.fnRaw, (fn, fnRaw) => {
        lineData.fn = fn;
        lineData.fnRaw = fnRaw;
        onChange();
      }));
      break;
    }
    default:
      span.innerText = LINE_TYPES[lineData.type];
  }
  return div;
}

/** Generate global configutation popup */
function generateConfigPopup(graph, settings, onChange) {
  const popup = new Popup('Configuration');
  popup.setCloseCallback(() => onChange());
  const zoomDiv = document.createElement("div");
  popup.insertAdjacentElement("beforeend", zoomDiv);
  zoomDiv.insertAdjacentHTML("beforeend", "<span>Zoom:</span> ");
  // Zoom: default
  const btnZoomDefault = document.createElement('button');
  btnZoomDefault.innerText = 'Default';
  btnZoomDefault.addEventListener('click', () => {
    graph.opts = {};
    graph.fixOpts();
    onChange();
    popup.hide();
  });
  zoomDiv.appendChild(btnZoomDefault);
  // Zoom: trig
  const btnZoomTrig = document.createElement('button');
  btnZoomTrig.innerText = 'Trig';
  btnZoomTrig.addEventListener('click', () => {
    graph.opts = {
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

  const pcTable = document.createElement("table");
  popup.insertAdjacentElement("beforeend", pcTable);
  const pcTbody = pcTable.createTBody();
  [
    { field: 'Start X', title: 'Left-most X value', type: 'number', get: () => graph.opts.xstart, set: v => graph.opts.xstart = +v },
    { field: 'X Step', title: 'Width of gap between x-axis markers', type: 'number', get: () => graph.opts.xstep, set: v => graph.opts.xstep = +v },
    { field: 'X Step Gap', title: 'Gap (in pixels) between each x-axis marker', type: 'number', get: () => graph.opts.xstepGap, set: v => graph.opts.xstepGap = +v },
    { field: 'Mark X', title: 'Mark x-axis', type: 'boolean', get: () => graph.opts.markXAxis, set: v => graph.opts.markXAxis = v },

    { field: 'Start Y', title: 'Top-most Y value', type: 'number', get: () => graph.opts.ystart, set: v => graph.opts.ystart = +v },
    { field: 'Y Step', title: 'Height of gap between y-axis markers', type: 'number', get: () => graph.opts.ystep, set: v => graph.opts.ystep = +v },
    { field: 'Y Step Gap', title: 'Gap (in pixels) between each y-axis marker', type: 'number', get: () => graph.opts.ystepGap, set: v => graph.opts.ystepGap = +v },
    { field: 'Mark Y', title: 'Mark y-axis', type: 'boolean', get: () => graph.opts.markYAxis, set: v => graph.opts.markYAxis = v },

    { field: '&Nscr;-Coords', title: 'Number of coordinat points to plot for each line function (directly impacts performance)', type: 'number', get: () => graph.opts.ncoords, set: v => graph.opts.ncoords = +v },
    { field: 'Approx. Acc.', title: 'Accuracy (decimal places) of approximations i.e. finding roots', type: 'number', get: () => settings.dpAccuracy, set: v => settings.dpAccuracy = v },
    { field: 'Line Width', title: 'Line width of each line function', type: 'number', min: 0, get: () => graph.opts.lineWidth, set: v => graph.opts.lineWidth = +v },
    { field: 'Axis Thickness', title: 'Line thickness of the y/x-axis', type: 'number', get: () => graph.opts.axisThickness, set: v => graph.opts.axisThickness = v },
    { field: 'Grid', title: 'Show grid', type: 'boolean', get: () => graph.opts.grid, set: v => graph.opts.grid = v },
    { field: 'Grid Thickness', title: 'Line thickness of the grid', type: 'number', get: () => graph.opts.gridThickness, set: v => graph.opts.gridThickness = v },
    { field: 'Sub-Grid Divs', title: 'Divisions inside each x/y-axis step', type: 'number', get: () => graph.opts.subGridDivs, set: v => graph.opts.subGridDivs = v },
    { field: 'Show Coords', title: 'Show approx. coordinates next to cursor', type: 'boolean', get: () => settings.showCoords, set: v => settings.showCoords = v },

    { field: 'Sound Loop', title: 'Loop sound audio', type: 'boolean', get: () => settings.soundLoop, set: v => settings.soundLoop = v },
    { field: 'Sound K', title: 'Multiply sound data by this constant', type: 'number', get: () => settings.soundMultiplier, set: v => settings.soundMultiplier = v },
    { field: 'Sound Dur. K', title: 'Multiply sound duration by this constant', type: 'number', get: () => settings.soundDurMult, set: v => settings.soundDurMult = v },

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

/** Create and return <input /> which allows editing of a function. onChange(fn: Function, fnRaw: string) */
function generateLineFunctionInput(argString, functionString, onChange) {
  const input = document.createElement('input');
  input.type = "text";
  input.value = functionString;
  input.addEventListener("change", () => {
    let fn, fnRaw = input.value;
    try {
      fn = Function(argString, 'return ' + fnRaw);
      functionString = fnRaw;
      onChange(fn, fnRaw);
    } catch (e) {
      alert(`Error defining function: ${e.message}`);
      input.value = functionString;
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
function generateLinePopup(graph, callback, lineData = undefined) {
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
    divContainer.appendChild(generateLineConfigDiv(graph, lineData, callback, btnType));
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
function generateLineConfigDiv(graph, lineData, callback, btnType = 0) {
  const div = document.createElement('div');
  div.classList.add("line-config");
  div.innerHTML = `<em>${LINE_DESCRIPTIONS[lineData.type]}</em><br>`;
  switch (lineData.type) {
    case 'x':
    case 'y': {
      // Define function if not defined
      if (!lineData.fnRaw) {
        lineData.fnRaw = lineData.type;
        lineData.fn = Function(lineData.type, 'return ' + lineData.type);
      }

      let el = document.createElement("p");
      div.appendChild(el);
      el.innerHTML = `&#402;(&${lineData.type}scr;) = `;
      let inputEquation = generateLineFunctionInput(lineData.type, lineData.fnRaw, (fn, fnRaw) => {
        lineData.fnRaw = fnRaw;
        lineData.fn = fn;
      });
      el.appendChild(inputEquation);

      el = document.createElement("p");
      div.appendChild(el);
      el.innerHTML = `&Iscr;&fscr; `;
      let inputCond = generateLineConditionInput(lineData.type === 'x' ? '𝓍' : '𝓎', lineData, () => { });
      el.appendChild(inputCond);
      break;
    }
    case '~': {
      div.insertAdjacentHTML("beforeend", "<p>&#402;(&xscr;) &#8776; &#402;(&ascr;) + &#402;'(&ascr;)(&xscr;-&ascr;) + (&#402;''(&ascr;)/2!)(&xscr;-&ascr;)<sup>2</sup> + ... + (&#402;<sup>(&nscr;)</sup>(&ascr;)/&nscr;!)(&xscr;-&ascr;)<sup>&nscr;</sup></p>");
      div.insertAdjacentHTML("beforeend", `<p>Current Approx: <input type='text' value="${lineData.fnRaw ?? ''}" /></p>`);
      let el = document.createElement("p");
      el.innerHTML = `ID of line to approximate: `;
      let selectID = document.createElement("select");
      selectID.insertAdjacentHTML("beforeend", "<option selected disabled>ID</option>");
      graph.getLines().forEach(id => selectID.insertAdjacentHTML('beforeend', `<option ${id}>${id}</option>`));
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
      let el = document.createElement("p");
      div.appendChild(el);
      let inputLHS = document.createElement("input");
      if (!lineData.lhsRaw) {
        lineData.lhsRaw = 'x';
        lineData.lhs = Function('x', 'y', 'return ' + lineData.lhsRaw);
      }
      inputLHS.type = "text";
      inputLHS.value = lineData.lhsRaw;
      inputLHS.addEventListener('change', () => {
        let fn, fnRaw = inputLHS.value;
        try {
          fn = Function('x', 'y', 'return ' + fnRaw);
        } catch (e) {
          alert(`Error defining function: ${e.message}`);
          inputLHS.value = lineData.lhsRaw;
          return;
        }
        lineData.lhsRaw = fnRaw;
        lineData.lhs = fn;
      });
      el.appendChild(inputLHS);
      el.insertAdjacentHTML("beforeend", " = ");
      let inputRHS = document.createElement("input");
      if (!lineData.lhsRaw) {
        lineData.rhsRaw = 'x';
        lineData.rhs = Function('x', 'y', 'return ' + lineData.rhsRaw);
      }
      inputRHS.type = "text";
      inputRHS.value = lineData.rhsRaw;
      inputRHS.addEventListener('change', () => {
        let fn, fnRaw = inputRHS.value;
        try {
          fn = Function('x', 'y', 'return ' + fnRaw);
        } catch (e) {
          alert(`Error defining function: ${e.message}`);
          inputRHS.value = lineData.rhsRaw;
          return;
        }
        lineData.rhsRaw = fnRaw;
        lineData.rhs = fn;
      });
      el.appendChild(inputRHS);
      break;
    }
    case 'θ': {
      lineData.range ??= [0, 2 * Math.PI];
      if (!lineData.fnRaw) {
        lineData.fnRaw = lineData.type;
        lineData.fn = Function(lineData.type, 'return ' + lineData.type);
      }

      let el = document.createElement("p");
      div.appendChild(el);
      el.innerHTML = `&#402;(θ) = `;
      let inputEquation = generateLineFunctionInput("θ", lineData.fnRaw, (fn, fnRaw) => {
        lineData.fn = fn;
        lineData.fnRaw = fnRaw;
      });
      el.appendChild(inputEquation);

      el = document.createElement("p");
      let inputRangeMin = document.createElement("input");
      inputRangeMin.type = 'text';
      inputRangeMin.value = lineData.range[0];
      inputRangeMin.addEventListener("change", () => updateRange());
      el.appendChild(inputRangeMin);
      el.insertAdjacentHTML("beforeend", ` &leq; θ &leq; `);
      let inputRangeMax = document.createElement("input");
      inputRangeMax.type = 'text';
      inputRangeMax.value = lineData.range[1];
      inputRangeMax.addEventListener("change", () => updateRange());
      el.appendChild(inputRangeMax);
      div.appendChild(el);

      el = document.createElement("p");
      el.innerHTML = '<strong>θ Step</strong>: ';
      let inputStep = document.createElement("input");
      inputStep.type = 'text';
      inputStep.title = 'Step of θ. Leave blank for default.';
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
      if (!lineData.fnxRaw) {
        lineData.fnxRaw = PARAMETRIC_VARIABLE;
        lineData.fnx = Function(PARAMETRIC_VARIABLE, 'return ' + lineData.fnxRaw);
      }
      if (!lineData.fnyRaw) {
        lineData.fnyRaw = PARAMETRIC_VARIABLE;
        lineData.fny = Function(PARAMETRIC_VARIABLE, 'return ' + lineData.fnyRaw);
      }

      let el = document.createElement("p");
      el.innerHTML = `&#402;<sub>&xscr;</sub>(${PARAMETRIC_VARIABLE}) = `;
      let inputEquationX = generateLineFunctionInput(PARAMETRIC_VARIABLE, lineData.fnxRaw, (fn, fnRaw) => {
        lineData.fnx = fn;
        lineData.fnxRaw = fnRaw;
      });
      el.appendChild(inputEquationX);
      div.appendChild(el);

      el = document.createElement("p");
      el.innerHTML = `&#402;<sub>&yscr;</sub>(${PARAMETRIC_VARIABLE}) = `;
      let inputEquationY = generateLineFunctionInput(PARAMETRIC_VARIABLE, lineData.fnyRaw, (fn, fnRaw) => {
        lineData.fny = fn;
        lineData.fnyRaw = fnRaw;
      });
      el.appendChild(inputEquationY);
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
      graph.getLines().forEach(id => selectID.insertAdjacentHTML('beforeend', `<option ${id}>${id}</option>`));
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
      graph.getLines().forEach(id => selectID.insertAdjacentHTML('beforeend', `<option ${id}>${id}</option>`));
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
      transInputX.step = graph.opts.xstep;
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
      transInputY.step = graph.opts.ystep;
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
      return;
  }

  div.insertAdjacentHTML("beforeend", "<br>");
  let el = document.createElement("span");
  el.innerHTML = '<strong>Line Width</strong>: ';
  let inputLineWidth = document.createElement("input");
  inputLineWidth.type = "number";
  inputLineWidth.value = lineData.lineWidth ?? graph.opts.lineWidth;
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
    let bounds = prompt(`Find area under curve between bounds\nFormat: <a>, <b>`, '0, 1');
    if (bounds) {
      let [a, b] = bounds.split(',').map(n => eval(n));
      if (b < a) return alert(`Invalid bound relationship`);
      let area = graphData.graph.getArea(lineData.coords, a, b);
      if (area === undefined) alert(`Area ${a}-${b} is undefined`);
      else if (isNaN(area)) alert(`Unable to calculate area ${a}-${b}`);
      else alert(area);
    }
  }));
  // Approximate
  divCalculus.appendChild(createButton("~", "Approximate function using Taylor series", () => {
    addLine({ type: '~', id: lineID, degree: 3, C: 0 }, graphData); // Taylor approximation of 3rd degree
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
    const tr = document.createElement("tr"), info = graphData.funcs.get(name);
    tr.insertAdjacentHTML("beforeend", `<th>${name}</th>`);
    let td = document.createElement("td");
    let inpArguments = document.createElement("input");
    inpArguments.value = info.args.join(', ');
    inpArguments.title = 'Function arguments seperated by commas';
    inpArguments.addEventListener('change', () => {
      info.args = inpArguments.value.split(',').map(x => x.trim());
      inpArguments.value = info.args.join(', ');
      addFunc(name, info.args, info.source);
      setFunction(graphData, name, info.args, info.source);
      onChange();
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
      setFunction(graphData, name, info.args, info.source);
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

  graphData.funcs.forEach((obj, name) => {
    if (obj.visible) tbody.appendChild(createRow(name));
  });
  let tfoot = table.createTFoot(), tr = document.createElement("tr"), td = document.createElement("td"), newBtn = document.createElement("button");
  table.appendChild(tfoot);
  newBtn.innerHTML = '&plus; Define Function';
  newBtn.addEventListener('click', () => {
    let name = prompt('Enter function name');
    if (name) {
      if (!CONSTANT_SYM_REGEX.test(name)) return alert(`Invalid function name - must match ${CONSTANT_SYM_REGEX}`);
      if (graphData.funcs.has(name)) return alert(`Function called ${name} already exists`);
      setFunction(graphData, name, ['x'], 'x', true);
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