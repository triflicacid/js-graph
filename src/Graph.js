import { Point } from "./Point.js";
import { lerpCoords, roundMultiple, roundTowards0, roundTowardsInf } from "./utils.js";
import * as gutils from "./graph-utils.js";
import { Complex } from "./libs/Complex.js";

export class Graph {
  constructor(canvas, eventListenerEl) {
    this._canvas = canvas;
    this._eventListenerEl = eventListenerEl;
    this._ctx = canvas.getContext("2d");
    this._lid = 0;
    /** @type {Map<number, { fn: (x: number) => number, color: any }>} */
    this._lines = new Map();
    this.opts = {};
    this._events = []; // Array of [event-type, event-handler, bound-handler]
    this._points = [];
  }

  get width() { return this._canvas.width; }
  set width(w) { return (this._canvas.width = w); }

  get height() { return this._canvas.height; }
  set height(h) { return (this._canvas.height = h); }

  get canvas() { return this._canvas; }
  get ctx() { return this._ctx; }

  /** Clear canvas */
  clear() {
    this._ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Add line
   * @param data line data
   * @return {number} id of line
   * */
  addLine(data) {
    const id = this._lid++;
    this._lines.set(id, data);
    return id;
  }

  /**
   * Get line with ID
   */
  getLine(id) {
    return this._lines.get(id);
  }

  /**
   * Return array of all line IDs
   */
  getLines() {
    return Array.from(this._lines.keys());
  }

  /** Remove line with ID */
  removeLine(id) {
    return this._lines.delete(id);
  }

  /** Make sure each option in this.opts is defined */
  fixOpts() {
    this.opts.xstepGap ??= 100; // Pixel gap between x markers
    this.opts.xstep ??= 2; // What is the x-step interval
    this.opts.xstepLabel ??= undefined; // Function taking current step and returning the label
    this.opts.xstart ??= -10; // leftmost X value
    this.opts.markXAxis ??= true;

    this.opts.ystepGap ??= 100; // Pixel gap between y markers
    this.opts.ystep ??= 2; // What is the y-step interval
    this.opts.ystepLabel ??= undefined; // Function taking current step and returning the label
    this.opts.ystart ??= 8; // topmost y value
    this.opts.markYAxis ??= true;

    this.opts.grid ??= true;
    this.opts.axisThickness ??= 1;
    this.opts.labelPrecision ??= 2;
    this.opts.gridThickness ??= 0.3;
    this.opts.lineWidth ??= 2;
    this.opts.subGridDivs ??= 4;

    this.opts.ncoords ??= 5000; // Generate <ncoord> coordinates per line fn
  }

  /** Get actual coordinates of (x,y) coordinates on canvas */
  getCoordinates(x, y) {
    return [
      ((x - this.opts.xstart) / this.opts.xstep) * this.opts.xstepGap,
      ((this.opts.ystart - y) / this.opts.ystep) * this.opts.ystepGap
    ];
  }

  /** Reverse of getCoordinates - get page coordinates from canvas (x, y) */
  fromCoordinates(x, y) {
    return [
      ((this.opts.xstep * x) / this.opts.xstepGap) + this.opts.xstart,
      this.opts.ystart - ((y * this.opts.ystep) / this.opts.ystepGap)
    ];
  }

  /** Get span of x-axis */
  getXAxisSpan() {
    return (this.width / this.opts.xstepGap) * this.opts.xstep;
  }

  /** Get span of y-axis */
  getYAxisSpan() {
    return (this.height / this.opts.ystepGap) * this.opts.ystep;
  }

  /** Add points to line: ({ typeID, lineID, x, y } | Point)[] */
  addPoints(data) {
    for (let arg of data) {
      if (arg instanceof Point) {
        this._points.push(arg);
      } else {
        let P = new Point(arg.lineID, arg.typeID, +arg.x, +arg.y);
        if (arg.string) P.string = arg.string;
        this._points.push(P);
      }
    }
  }

  /** Remove all points which meet ALL of the given criteria: { lineID, typeID } */
  removePoints(obj) {
    let c = 0;
    for (let i = this._points.length - 1; i >= 0; i--) {
      if ((obj.lineID === undefined || obj.lineID === this._points[i].lineID) && (obj.typeID === undefined || obj.typeID === this._points[i].typeID)) {
        this._points.splice(i, 1);
        c++;
      }
    }
    return c;
  }

  /** Sketch graph layer */
  sketch() {
    this.fixOpts();

    const yAxisSpan = this.getYAxisSpan();
    const xAxisSpan = this.getXAxisSpan();
    const EPSILON = Number.EPSILON;

    let met = false;
    for (let [id, data] of this._lines) {
      data.draw ??= true;
      if (!data.draw) continue;
      if (data.type === 'z2') {
        if (!met) {
          data.error = false;
          met = true;
          this.plotComplexField(data);
        } else {
          data.error = true;
          data.emsg = `Can only plot one line of type 'z2'/'d2'`;
        }
      } else if (data.type === 'd2') {
        if (!met) {
          data.error = false;
          met = true;
          this.plotComplexFieldDerivative(data);
        } else {
          data.error = true;
          data.emsg = `Can only plot one line of type 'z2'/'d2'`;
        }
      } else if (data.type === 'e') {
        this.plotWhereEqual(data);
      }
    }

    // x-axis
    xAxis: {
      let y, line;
      if (this.opts.ystart < 0) { // Line at top of screen
        y = 0;
        line = false;
        this._ctx.textBaseline = 'top';
      } else if (this.opts.ystart - yAxisSpan > 0) { // Line at bottom of screen
        y = this.height;
        line = false;
        this._ctx.textBaseline = 'bottom';
      } else {
        this._ctx.textBaseline = 'middle';
        line = true;
        y = this.getCoordinates(0, 0)[1];
      }

      // Draw x-axis line?
      if (line) {
        this._ctx.beginPath();
        this._ctx.strokeStyle = 'black';
        this._ctx.lineWidth = this.opts.axisThickness;
        this._ctx.moveTo(0, y);
        this._ctx.lineTo(this.width, y);
        this._ctx.stroke();
      }

      // Draw numbers
      this._ctx.fillStyle = 'black';
      this._ctx.textAlign = 'center';

      const lll = 5, subGridInc = this.opts.xstepGap / this.opts.subGridDivs;
      for (let i = 0, n = roundMultiple(this.opts.xstart, this.opts.xstep, roundTowards0), x = this.getCoordinates(n, 0)[0]; x < this.width; i++, n += this.opts.xstep, x += this.opts.xstepGap) {
        if (Math.abs(n) >= EPSILON && this.opts.markXAxis) {
          const label = this.opts.xstepLabel ? this.opts.xstepLabel(n) : n.toPrecision(this.opts.labelPrecision);
          if (line) {
            this._ctx.beginPath();
            this._ctx.strokeStyle = 'black';
            this._ctx.lineWidth = 1;
            this._ctx.moveTo(x, y - lll);
            this._ctx.lineTo(x, y + lll);
            this._ctx.stroke();
            this._ctx.fillText(label, x, y - lll * 2);
          } else {
            this._ctx.fillText(label, x, y);
          }
        }

        if (this.opts.grid) {
          this._ctx.beginPath();
          this._ctx.strokeStyle = 'black';
          this._ctx.lineWidth = this.opts.gridThickness;
          this._ctx.moveTo(x, 0);
          this._ctx.lineTo(x, this.height);
          this._ctx.stroke();
        }
      }

      if (this.opts.grid && this.opts.subGridDivs > 0) {
        const subGridInc = this.opts.xstepGap / this.opts.subGridDivs;
        let x = this.getCoordinates(roundMultiple(this.fromCoordinates(0, 0)[0], this.opts.xstep / this.opts.subGridDivs, roundTowardsInf), 0)[0];
        for (let i = 0; x <= this.width; i++, x += subGridInc) {
          this._ctx.beginPath();
          this._ctx.strokeStyle = 'black';
          this._ctx.lineWidth = this.opts.gridThickness / 2;
          this._ctx.moveTo(x, 0);
          this._ctx.lineTo(x, this.height);
          this._ctx.stroke();
        }
      }
    }

    // y-axis
    yAxis: {
      let x, line;
      if (this.opts.xstart > 0) { // Line at left of screen
        x = 0;
        line = false;
        this._ctx.textAlign = 'left';
      } else if (this.opts.xstart + xAxisSpan < 0) { // Line at right of screen
        x = this.width;
        this._ctx.textAlign = 'right';
        line = false;
      } else {
        this._ctx.textAlign = 'left';
        line = true;
        x = this.getCoordinates(0, 0)[0];
      }

      // Draw y-axis line?
      if (line) {
        this._ctx.beginPath();
        this._ctx.strokeStyle = 'black';
        this._ctx.lineWidth = this.opts.axisThickness;
        this._ctx.moveTo(x, 0);
        this._ctx.lineTo(x, this.height);
        this._ctx.stroke();
      }

      // Draw numbers
      this._ctx.fillStyle = 'black';
      this._ctx.textBaseline = 'middle';

      const lll = 5;
      for (let i = 0, n = roundMultiple(this.opts.ystart, this.opts.ystep, roundTowards0), y = this.getCoordinates(0, n)[1]; y < this.height; i++, n -= this.opts.ystep, y += this.opts.ystepGap) {
        if (Math.abs(n) >= EPSILON && this.opts.markYAxis) {
          const label = this.opts.ystepLabel ? this.opts.ystepLabel(n) : n.toPrecision(this.opts.labelPrecision);
          if (line) {
            this._ctx.beginPath();
            this._ctx.strokeStyle = 'black';
            this._ctx.lineWidth = 1;
            this._ctx.moveTo(x - lll, y);
            this._ctx.lineTo(x + lll, y);
            this._ctx.stroke();
            this._ctx.fillText(label, x + lll * 1.5, y);
          } else {
            this._ctx.fillText(label, x, y);
          }
        }
        if (this.opts.grid) {
          this._ctx.beginPath();
          this._ctx.strokeStyle = 'black';
          this._ctx.lineWidth = this.opts.gridThickness;
          this._ctx.moveTo(0, y);
          this._ctx.lineTo(this.width, y);
          this._ctx.stroke();
        }
      }

      if (this.opts.grid && this.opts.subGridDivs > 0) {
        const subGridInc = this.opts.ystepGap / this.opts.subGridDivs;
        let y = this.getCoordinates(0, roundMultiple(this.fromCoordinates(0, 0)[1], this.opts.ystep / this.opts.subGridDivs, roundTowardsInf))[1];
        for (let i = 0; y <= this.height; i++, y += subGridInc) {
          this._ctx.beginPath();
          this._ctx.strokeStyle = 'black';
          this._ctx.lineWidth = this.opts.gridThickness / 2;
          this._ctx.moveTo(0, y);
          this._ctx.lineTo(this.width, y);
          this._ctx.stroke();
        }
      }
    }

    // lines
    lines: {
      for (let [id, data] of this._lines) {
        if (data.type === 'z2' || data.type === 'e' || data.type === 'd2') continue;
        data.draw ??= true;
        let coords = this.generateCoords(id);
        data.coords = coords;
        if (!data.draw || data.error) continue;
        if (data.type === 'z') {
          // REAL part
          const rcoords = coords.filter(([x, y]) => y !== undefined).map(([x, y]) => this.getCoordinates(x, y));
          this._plotPoints(rcoords, data);
          // IMAGINARY part
          const icoords = coords.filter(([x, _, y]) => y !== undefined).map(([x, _, y]) => this.getCoordinates(x, y));
          const col = data.color;
          data.color += '5f';
          this._plotPoints(icoords, data);
          data.color = col;
        } else {
          coords = coords.map(([x, y]) => this.getCoordinates(x, y));
          this._plotPoints(coords, data);
        }
      }
    }
  }

  /** Sketch points */
  sketchPoints() {
    const translateCoords = (x, y) => this.getCoordinates(x, y);
    this._points.forEach(p => p.display(this._ctx, translateCoords));
  }

  /** Populate data.coords for a line. Return false | array of coords. */
  generateCoords(id, opts = {}) {
    const data = this._lines.get(id);
    if (data) {
      opts.xstart ??= this.opts.xstart;
      opts.ystart ??= this.opts.ystart;
      opts.xstep ??= this.opts.xstep;
      opts.ystep ??= this.opts.ystep;

      delete data.emsg;
      data.error = false;
      data.type ??= 'x';

      const ncoords = data.ncoords ?? (opts.ncoords ?? this.opts.ncoords);
      const yAxisSpan = opts.xAxisSpan ?? this.getYAxisSpan();
      const xAxisSpan = opts.yAxisSpan ?? this.getXAxisSpan();

      let refLine; // Line reference by `id` key
      if (data.id !== undefined) {
        if (data.id === id) {
          data.emsg = `Cannot reference oneself (ID ${id})`;
        }
        refLine = this._lines.get(data.id);
        if (!refLine) {
          data.emsg = `Line ID ${data.id} does not exist`;
        } else if (!refLine.coords || refLine.coords.length === 0) {
          data.emsg = `Line ${data.id} has not been sketched yet`;
        }
      }

      if (data.prange !== undefined) {
        if (data.range === 'x') data.range = [opts.xstart, opts.xstart + xAxisSpan];
        else if (data.range === 'y') data.range = [opts.ystart, opts.ystart - yAxisSpan];
        else if (data.range === 'a') data.range = [0, 2 * Math.PI];
      }

      // Generate coordinates
      let coords = [], inc;
      if (data.emsg === undefined) {
        switch (data.type) {
          case 'l': {
            inc = xAxisSpan / ncoords;
            const a = data.a, b = data.b;
            if (a >= b) {
              data.emsg = `Limits must be in strictly increasing order: a < b`;
              break;
            }
            const psi = x => x <= 0 ? 0 : x >= 1 ? 1 : Math.exp(-1 / x), w = x => psi(x) / (psi(x) + psi(1 - x));
            const step = x => x < a ? 0 : x > b ? 1 : w((x - a) / (b - a));
            let error = false;
            for (let j = 0, x = opts.xstart; j <= ncoords; j++, x += inc) {
              data.expr1.setSymbol("x", x);
              let y1 = data.expr1.evaluate();
              if (data.expr1.error) {
                error = true;
                data.emsg = data.expr1.handleError();
                break;
              }
              if (y1.b !== undefined) y1 = y1.a;
              data.expr2.setSymbol("x", x);
              let y2 = data.expr2.evaluate();
              if (data.expr2.error) {
                error = true;
                data.emsg = data.expr2.handleError();
                break;
              }
              if (y2.b !== undefined) y2 = y2.a;
              let y = step(1 - x) * y1 + step(x) * y2;
              if (Graph.validCoordinates(x, y)) coords.push([x, y]);
            }
            if (error) break;
            break;
          }
          case 'x': { // Control the x-coordinate
            inc = xAxisSpan / ncoords;
            for (let i = 0, x = opts.xstart; i < ncoords; ++i, x += inc) {
              data.expr.setSymbol("x", x);
              let y = data.expr.evaluate();
              if (data.expr.error) break;
              if (y.b !== undefined) y = y.a;
              if (Graph.validCoordinates(x, y)) coords.push([x, y]);
            }
            if (data.expr.error) data.emsg = data.expr.handleError();
            break;
          }
          case 'y': { // Control the y-coordinate
            inc = yAxisSpan / ncoords;
            opts.ystart ??= this.opts.ystart;
            for (let i = 0, y = opts.ystart; i < ncoords; ++i, y -= inc) {
              data.expr.setSymbol("y", y);
              let x = data.expr.evaluate();
              if (data.expr.error) break;
              if (x.b !== undefined) x = x.a;
              if (Graph.validCoordinates(x, y)) coords.push([x, y]);
            }
            if (data.expr.error) data.emsg = data.expr.handleError();
            break;
          }
          case 'p': { // Control a parameter
            opts.xstart ??= this.opts.xstart;
            opts.ystart ??= this.opts.ystart;
            if (!Array.isArray(data.range)) {
              data.emsg = `Invalid 'range' property`;
              break;
            }
            inc = data.range[2] ?? (Math.abs(data.range[1] - data.range[0]) / ncoords);
            for (let i = 0, p = data.range[0], x, y; p <= data.range[1]; ++i, p += inc) {
              data.exprx.setSymbol("p", p);
              let x = data.exprx.evaluate();
              if (data.exprx.error) break;
              if (x.b !== undefined) x = x.a;
              data.expry.setSymbol("p", p);
              let y = data.expry.evaluate();
              if (data.expry.error) break;
              if (y.b !== undefined) y = y.a;
              if (Graph.validCoordinates(x, y)) coords.push([x, y]);
            }
            if (data.exprx.error) data.emsg = data.exprx.handleError();
            else if (data.expry.error) data.emsg = data.expry.handleError();
            break;
          }
          case 'd': { // Plot gradient of another function
            coords = gutils.calcGradient(refLine.coords);
            break;
          }
          case 'i': { // Plot integrand of another function
            data.C ??= 0;
            coords = gutils.calcCoordsFromGradient(refLine.coords, data.C);
            break;
          }
          case 'a':
          case 's':
          case 'm': { // Addition/Subtraction/Multiplication of lines
            let all = [], error = false;
            data.ids ??= [];
            for (let lid of data.ids) {
              if (lid === id) {
                data.emsg = `Cannot reference oneself (ID ${id})`;
                error = true;
                break;
              }
              let line = this._lines.get(lid);
              if (!line) {
                data.emsg = `Line ID ${lid} does not exist`;
                error = true;
                break;
              }
              if (!line.coords || line.coords.length === 0) {
                data.emsg = `Line ${lid} has not been sketched yet`;
                error = true;
                break;
              }
              all.push(line.coords);
            }
            if (error) break;
            if (all.length === 0) {
              data.emsg = 'Requires at least one curve';
              break;
            } else if (all.length === 1) {
              coords = all[0];
            } else {
              let lim = Math.min(...all.map(arr => arr.length)), idx = data.coord === 'x' ? 0 : 1;
              if (data.type === 'a') {
                for (let i = 0; i < lim; ++i) {
                  let coord = [...all[0][i]];
                  for (let j = 1; j < all.length; ++j) coord[idx] += all[j][i][idx];
                  if (Graph.validCoordinates(...coord)) coords.push(coord);
                }
              } else if (data.type === 's') {
                for (let i = 0; i < lim; ++i) {
                  let coord = [...all[0][i]];
                  for (let j = 1; j < all.length; ++j) coord[idx] -= all[j][i][idx];
                  if (Graph.validCoordinates(...coord)) coords.push(coord);
                }
              } else if (data.type === 'm') {
                for (let i = 0; i < lim; ++i) {
                  let coord = [...all[0][i]];
                  for (let j = 1; j < all.length; ++j) coord[idx] *= all[j][i][idx];
                  if (Graph.validCoordinates(...coord)) coords.push(coord);
                }
              }
            }
            break;
          }
          case 't': { // Translate
            data.C ??= []; // scale_x, shift_x, scale_y, shift_y, rotate
            data.C[0] ??= 1; // Scale X
            data.C[1] ??= 0; // Shift X
            data.C[2] ??= 1; // Scale Y
            data.C[3] ??= 0; // Shift Y
            // data.C[4] ??= 0; // Theta
            if (data.C.length > 5) data.C.length = 5;
            const t = data.C[4], St = Math.sin(t), Ct = Math.cos(t); // sin(theta), cos(theta)
            coords = refLine.coords.map(([x, y]) => {
              let nx = x, ny = y;
              if (t != undefined) {
                nx = x * St + y * Ct;
                ny = x * Ct - y * St;
              }
              nx = nx * data.C[0] + data.C[1];
              ny = ny * data.C[2] + data.C[3];
              return [nx, ny];
            });
            break;
          }
          case 'θ': { // Polar
            if (!data.range) data.range = [0, 2 * Math.PI];
            inc = data.range[2] ?? (Math.abs(data.range[1] - data.range[0]) / ncoords);
            for (let i = 0, θ = data.range[0]; θ <= data.range[1]; ++i, θ += inc) {
              data.expr.setSymbol("a", θ);
              let r = data.expr.evaluate();
              if (data.expr.error) break;
              if (r.b !== undefined) r = r.a;
              if (!isNaN(r) && isFinite(r)) coords.push([r * Math.cos(θ), r * Math.sin(θ)]);
            }
            if (data.expr.error) data.emsg = data.expr.handleError();
            break;
          }
          case 'c': // Coords
            coords = data.coords;
            data.drawAll = true;
            break;
          case 'e': {
            break;
          }
          case '~': {
            data.degree ??= 3;
            data.c ??= 0;
            if (this._lines.get(data.id) === undefined) {
              data.emsg = 'Unknown line with ID ' + data.id;
              break;
            }
            if (data.expr === undefined) {
              data.emsg = 'Expression object uninitialised.';
              break;
            }
            const approxStr = this.taylorApprox(data.id, data.degree, data.C);
            data.expr.load(approxStr);
            data.expr.parse();
            if (data.expr.error) {
              data.emsg = 'Unable to create Taylor approximation. Does this curve exist at <a=' + data.C + '>?';
              break;
            }
            const inc = xAxisSpan / ncoords;
            for (let i = 0, x = opts.xstart; i < ncoords; ++i, x += inc) {
              data.expr.setSymbol("x", x);
              let y = data.expr.evaluate();
              if (data.expr.error) break;
              if (Graph.validCoordinates(x, y)) coords.push([x, y]);
            }
            if (data.expr.error) data.emsg = data.expr.handleError();
            break;
          }
          case 'z': {
            // coords = [x, Re(z), Im(z)]
            inc = xAxisSpan / ncoords;
            for (var i = 0, x = opts.xstart; i < ncoords; ++i, x += inc) {
              data.expr.setSymbol('x', new Complex(x));
              let z = data.expr.evaluate();
              if (data.expr.error) break;
              let aok = Graph.validCoordinates(x, z.a);
              let bok = Graph.validCoordinates(x, z.b);
              if (aok || bok) coords.push([x, aok ? z.a : undefined, bok ? z.b : undefined]);
            }
            if (data.expr.error) data.emsg = data.expr.handleError();
            break;
          }
          default:
            data.emsg = `Unknown plot type '${data.type}'`;
        }
      }
      if (!coords || coords.length === 0) {
        data.error = true;
        data.emsg ??= 'Coordinate array is empty';
      } else {
        data.error = false;
        delete data.emsg;
      }
      return coords;
    } else {
      return false;
    }
  }

  /** Generate coordinates of the gradient to curve <ID>. genNewCoords - generate new coordinates if line.coords is present? */
  generateGradientCoords(id, genNewCoords = false, opts = {}) {
    const line = this._lines.get(id);
    if (line) {
      const coords = line.coords && !genNewCoords ? line.coords : this.generateCoords(id, opts);
      return gutils.calcGradient(coords);
    } else {
      return false;
    }
  }

  /** Generate coordinates of the integrand to curve <ID>. genNewCoords - generate new coordinates if line.coords is present?. Assume passes through (0,0) */
  generateIntegrandCoords(id, genNewCoords = false, opts = {}) {
    const line = this._lines.get(id);
    if (line) {
      const coords = line.coords && !genNewCoords ? line.coords : this.generateCoords(id, opts);
      return gutils.calcCoordsFromGradient(coords);
    } else {
      return false;
    }
  }

  /** Plot coordinate array according to line data */
  _plotPoints(coords, data) {
    this._ctx.save();
    this._ctx.lineWidth = data.lineWidth ?? this.opts.lineWidth;
    this._ctx.strokeStyle = data.color ?? 'black';
    data.color = this._ctx.strokeStyle;
    data.shade ??= "";
    if (data.dash) this._ctx.setLineDash(data.dash);

    let off = 10, noff = -off, height = this.height + off, width = this.width + off, asyh = this.height / 1.5; // Check that coords are in screen bounds!
    if (data.join === undefined || data.join) {
      coords = coords.filter(([x, y]) => (x >= noff && x < width && y >= noff && y < height));
      let inPath = false;
      let pathSectionStart; // Coordinates of path start
      for (let i = 0; i < coords.length; i++) {
        let [x, y] = coords[i];
        if (inPath) {
          this._ctx.lineTo(x, y);
        } else {
          this._ctx.beginPath();
          if (data.shade[1] === "t") this._ctx.setLineDash([10, 4]); // Not equal to - dashed line
          this._ctx.moveTo(x, y);
          pathSectionStart = coords[i];
          inPath = true;
        }

        let stroke = false; // Close the path?
        if (coords[i + 1] === undefined) {
          stroke = true;
        } else if (Math.abs(y - coords[i + 1][1]) >= asyh) {
          stroke = true;
          inPath = false;
        } else if (Math.abs(coords[i + 1][0] - x) > (data.drawAll ? this.width * .33 : this.opts.xstep)) {
          stroke = true;
          inPath = false;
        }
        if (stroke) {
          if (data.shade[0] === "g") { // Greater -> Above line
            this._ctx.lineTo(x, -off);
            this._ctx.lineTo(pathSectionStart[0], -off);
            this._ctx.lineTo(...pathSectionStart);
          } else if (data.shade[0] === "l") { // Less -> Below line
            this._ctx.lineTo(x, this.height + off);
            this._ctx.lineTo(pathSectionStart[0], this.height + off);
            this._ctx.lineTo(...pathSectionStart);
          }
          this._ctx.stroke();
          if (data.shade) {
            this._ctx.fillStyle = (data.color || "#000000") + "35";
            this._ctx.fill();
          }
        }
      }
    } else {
      this._ctx.fillStyle = data.color ?? 'black';
      coords.forEach(([x, y]) => {
        if (x < noff || x > width || y < noff || y > height) return;
        this._ctx.beginPath();
        this._ctx.arc(x, y, this._ctx.lineWidth, 0, 6.3);
        this._ctx.fill();
      });
    }
    this._ctx.restore();
  }

  plotComplexField(data) {
    data.error = false;
    const outs = []; // [Input, Output][]
    const outsN = []; // [zOutMag, zOutArg][]
    let maxMag = -1;
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const idx = x + y * this.width;
        const [a, b] = this.fromCoordinates(x, y), zIn = new Complex(a, b);
        data.expr.setSymbol("z", zIn);
        const zOut = data.expr.evaluate();
        if (data.expr.error) break;
        const mag = zOut.getMag(), arg = zOut.getArg();
        if (mag > maxMag) maxMag = mag;
        outs[idx] = [zIn, zOut];
        outsN[idx] = [mag, arg];
      }
      if (data.expr.error) break;
    }
    if (data.expr.error) {
      data.error = true;
      data.emsg = data.expr.handleError();
      return;
    }
    data.coords = outs;

    let img = this._ctx.getImageData(0, 0, this.width, this.height);
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        let idx = 4 * (x + y * this.width);
        // let [zIn, zOut] = outs[x + y * this.width];
        let [mag, arg] = outsN[x + y * this.width];
        let hu = arg < 0 ? 360 + arg / Math.PI * 180 : arg / Math.PI * 180;
        let bright = data.C ? mag / maxMag * 75 : 50;
        let rgb = gutils.hsl2rgb(hu, 100, bright);
        img.data[idx] = rgb[0];
        img.data[idx + 1] = rgb[1];
        img.data[idx + 2] = rgb[2];
        img.data[idx + 3] = 255;
      }
    }
    this._ctx.putImageData(img, 0, 0);
  }

  plotComplexFieldDerivative(data) {
    data.error = false;
    const outs = [], original = this._lines.get(data.id).coords, w = this.width;
    for (let i = 0; i < original.length; ++i) {
      const [zIn, zOut] = original[i];
      let changes = [], zOther;
      zOther = original[i - w]; // UP
      if (zOther) changes.push(Complex.sub(zOther[1], zOut));
      zOther = original[i - w - 1]; // UP LEFT
      if (zOther) changes.push(Complex.sub(zOther[1], zOut));
      zOther = original[i - w + 1]; // UP RIGHT
      if (zOther) changes.push(Complex.sub(zOther[1], zOut));
      zOther = original[i + w]; // DOWN
      if (zOther) changes.push(Complex.sub(zOut, zOther[1]));
      zOther = original[i + w - 1]; // DOWN LEFT
      if (zOther) changes.push(Complex.sub(zOut, zOther[1]));
      zOther = original[i + w + 1]; // DOWN RIGHT
      if (zOther) changes.push(Complex.sub(zOut, zOther[1]));
      zOther = original[i - 1]; // LEFT
      if (zOther) changes.push(Complex.sub(zOther[1], zOut));
      zOther = original[i + 1]; // RIGHT
      if (zOther) changes.push(Complex.sub(zOut, zOther[1]));
      let av = changes[0];
      for (let j = 0; j < changes.length; j++) av.add(changes[j]);
      av.a /= changes.length;
      av.b /= changes.length;
      outs[i] = [zIn, av];
    }
    data.coords = outs;

    let img = this._ctx.getImageData(0, 0, this.width, this.height);
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        let idx = 4 * (x + y * this.width);
        let [zIn, zOut] = outs[x + y * this.width], arg = zOut.getMag();
        let hu = arg < 0 ? 360 + arg / Math.PI * 180 : arg / Math.PI * 180;
        let rgb = gutils.hsl2rgb(hu, 100, 50);
        img.data[idx] = rgb[0];
        img.data[idx + 1] = rgb[1];
        img.data[idx + 2] = rgb[2];
        img.data[idx + 3] = 255;
      }
    }
    this._ctx.putImageData(img, 0, 0);
  }

  plotWhereEqual(data) {
    const img = this._ctx.getImageData(0, 0, this.width, this.height);
    data.error = false;
    data.coords = [];
    data.C ??= 0.02;
    for (let sx = 0; sx < this.width; sx++) {
      for (let sy = 0; sy < this.height; sy++) {
        let [x, y] = this.fromCoordinates(sx, sy);
        data.lhs.setSymbol("x", x).setSymbol("y", y);
        let lhs = data.lhs.evaluate();
        if (lhs instanceof Complex) lhs = lhs.a;
        if (data.lhs.error) break;
        data.rhs.setSymbol("x", x).setSymbol("y", y);
        let rhs = data.rhs.evaluate();
        if (rhs instanceof Complex) rhs = rhs.a;
        if (data.rhs.error) break;
        if (Math.abs(lhs - rhs) <= data.C) {
          let idx = 4 * (sx + sy * this.width);
          img.data[idx] = 0;
          img.data[idx + 1] = 0;
          img.data[idx + 2] = 0;
          img.data[idx + 3] = 255;
          data.coords.push([x, y]);
        }
      }
      if (data.lhs.error || data.rhs.error) break;
    }
    if (data.lhs.error) data.emsg = data.lhs.handleError();
    if (data.rhs.error) data.emsg = data.rhs.handleError();
    this._ctx.putImageData(img, 0, 0);
  }

  /** Return array of axis-intercepts for the given line at the given axis. An array of coords may be given in place of if. */
  getAxisIntercept(id, axis, iterations = 20, divs = 50) {
    const DP = 5;
    const axisIndex = axis === 'x' ? 0 : 1, otherAxisIndex = axisIndex ? 0 : 1;
    const coords = Array.isArray(id) ? id : this.getLine(id).coords;
    let intercepts = gutils.extractChangeOfSign(coords, otherAxisIndex, DP);
    lerpCoords(intercepts, 0.5);
    return intercepts;
  }

  /** Return array of turning points for the given line */
  getTurningPoints(id, iterations = 20, divs = 50) {
    let line = this._lines.get(id), points = [];
    if (line) {
      // if (line.type !== 'x' && line.type !== 'y') return console.error(`Cannot find turning points of line of type ${line.type}`);
      let coords = line.coords ?? this.generateCoords(id);
      let mcoords = gutils.calcGradient(coords);
      let roots = this.getAxisIntercept(mcoords, 'x', iterations, divs);
      roots.forEach(([rx, ry]) => {
        let subPoints = gutils.getCorrespondingCoordinate(rx, 'x', coords, true);
        points.push(...subPoints);
      });
    }
    return points;
  }

  /** Calculate area under curve <ID> between x=<a> and x=<b>
   * If function privided we can work with, <n> is number of divisions to use, UNLESS <n>=-1, in which case use coord array
   * - x => Use f(x) to generate <n> trapeziums
   * - y => Use f(y) to generate <n> trapeziums
   * - θ => Use f(θ) to generate <n> triangles
   * - p => Use f(p) to generate <n> trapeziums
   * Else, use coordinate array
   * obj = { path: number[][] }
   *  - Populate property <path> with coordinate array
   * @returns numerical area
   */
  getArea(id, a, b, n = 10000, obj = undefined) {
    if (a === b) return 0;
    const line = this._lines.get(id);
    line.color ??= "#000000";
    if (line === undefined) return NaN;
    if (n !== -1) {
      if (line.type === 'x') {
        const h = (b - a) / n, coords = [];
        for (let x = a; x <= b; x += h) { // Generate coordinates
          line.expr.setSymbol("x", x);
          let y = line.expr.evaluate();
          if (Graph.validCoordinates(x, y)) coords.push([x, y]);
        }
        let area = 0; // Area of curve excluding edge trapeziums
        for (let i = 1; i < coords.length - 1; ++i) area += coords[i][1];
        let A = 0.5 * h * ((coords[0][1] + coords[coords.length - 1][1]) + 2 * area);
        // Populate <areaPath>
        let points = coords.map(([x, y]) => this.getCoordinates(x, y));
        const ORIGIN = this.getCoordinates(0, 0);
        obj.path = [
          ORIGIN,
          [points[0][0], ORIGIN[1]],
          ...points,
          [points[points.length - 1][0], ORIGIN[1]],
          [points[0][0], ORIGIN[1]]
        ];
        return A;
      } else if (line.type === 'y') { // Generate coordinates
        const h = (b - a) / n, coords = [];
        for (let y = a; y <= b; y += h) { // Generate coordinates
          line.expr.setSymbol("y", y);
          let x = line.expr.evaluate();
          if (Graph.validCoordinates(x, y)) coords.push([x, y]);
        }
        let area = 0; // Area of curve excluding edge trapeziums
        // Trapezium rule
        for (let i = 1; i < coords.length - 1; ++i) area += coords[i][0];
        let A = 0.5 * h * ((coords[0][0] + coords[coords.length - 1][0]) + 2 * area);
        // Populate <areaPath>
        let points = coords.map(([x, y]) => this.getCoordinates(x, y));
        const ORIGIN = this.getCoordinates(0, 0);
        obj.path = [
          ORIGIN,
          [ORIGIN[0], points[0][1]],
          ...points,
          [ORIGIN[0], points[points.length - 1][1]],
          [ORIGIN[0], points[0][1]]
        ];
        return A;
      } else if (line.type === 'θ') {
        const α = (b - a) / n, coords = []; // Angle
        for (let θ = a; θ <= b; θ += α) {
          line.expr.setSymbol("a", θ);
          let r = line.expr.evaluate();
          if (!isNaN(r) && isFinite(r)) {
            let x = r * Math.cos(θ), y = r * Math.sin(θ);
            coords.push([x, y]);
          }
        }
        let A = 0;
        // Find area using triangles: 0.5*a*b*sin(C), a = sqrt(x0^2+y0^2), b = sqrt(xn^2+yn^2), C = α
        for (let i = 0; i < coords.length - 1; i++) A += 0.5 * Math.hypot(...coords[i]) * Math.hypot(...coords[i + 1]) * Math.sin(α);
        let points = coords.map(([x, y]) => this.getCoordinates(x, y));
        const ORIGIN = this.getCoordinates(0, 0);
        obj.path = [
          ORIGIN,
          ...points,
          ORIGIN
        ];
        return A;
      } else if (line.type === 'p') {
        const h = (b - a) / n, coords = [];
        for (let p = a; p <= b; p += h) {
          line.exprx.setSymbol("p", p);
          line.expry.setSymbol("p", p);
          let x = line.exprx.evaluate(), y = line.expry.evaluate();
          if (Graph.validCoordinates(x, y)) coords.push([x, y]);
        }
        let A = 0;
        // Trapeziums A = 0.5*(a+b)*h; heights fy(p), fy(p+h); width fx(p+h)-fx(p)
        for (let i = 0; i < coords.length - 1; ++i) A += 0.5 * (coords[i][1] + coords[i + 1][1]) * (coords[i + 1][0] - coords[i][0]);
        let points = coords.map(([x, y]) => this.getCoordinates(x, y));
        const ORIGIN = this.getCoordinates(0, 0);
        obj.path = [
          [points[0][0], ORIGIN[1]],
          ...points,
          [points[points.length - 1][0], ORIGIN[1]],
          [points[0][0], ORIGIN[1]]
        ];
        return A;
      }
    }

    // Use co-ordinates themselves
    if (line.type === 'z') { // COMPLEX: BOTH REAL AND IMAGINARY PARTS
      // Real, and imaginary
      let coords = line.coords,
        secStart = gutils.getCorrepondingCoordinateIndex(a, 'x', coords, false),
        secEnd = gutils.getCorrepondingCoordinateIndex(b, 'x', coords, false);
      coords = secStart <= secEnd ? coords.slice(secStart, secEnd + 1) : coords.slice(secEnd, secStart + 1);
      let re = gutils.getArea(coords), im = gutils.getArea(coords.map(([x, _, i]) => ([x, i])));
      // Populate <areaPath>
      let points = coords.map(([x, y]) => this.getCoordinates(x, y));
      const ORIGIN = this.getCoordinates(0, 0);
      obj.path = [[ // REAL payh
        ORIGIN,
        [points[0][0], ORIGIN[1]],
        ...points,
        [points[points.length - 1][0], ORIGIN[1]],
        [points[0][0], ORIGIN[1]]
      ]];
      points = coords.map(([x, _, y]) => this.getCoordinates(x, y));
      obj.path[1] = [ // IMAG path
        ORIGIN,
        [points[0][0], ORIGIN[1]],
        ...points,
        [points[points.length - 1][0], ORIGIN[1]],
        [points[0][0], ORIGIN[1]]
      ];
      return new Complex(re, im);
    } else {
      let coords = line.coords,
        secStart = gutils.getCorrepondingCoordinateIndex(a, 'x', coords, false),
        secEnd = gutils.getCorrepondingCoordinateIndex(b, 'x', coords, false);
      coords = secStart <= secEnd ? coords.slice(secStart, secEnd + 1) : coords.slice(secEnd, secStart + 1);
      // Populate <areaPath>
      let points = coords.map(([x, y]) => this.getCoordinates(x, y));
      const ORIGIN = this.getCoordinates(0, 0);
      obj.path = [
        ORIGIN,
        [points[0][0], ORIGIN[1]],
        ...points,
        [points[points.length - 1][0], ORIGIN[1]],
        [points[0][0], ORIGIN[1]]
      ];
      return gutils.getArea(coords);
    }
  }

  /** Get intercepts between two lines (or coordinate arrays) */
  getIntercepts(id1, id2, DP = undefined) {
    const coords1 = Array.isArray(id1) ? id1 : this._lines.get(id1).coords;
    const coords2 = Array.isArray(id2) ? id2 : this._lines.get(id2).coords;
    return gutils.getIntercepts(coords1, coords2, DP);
  }

  /** Get corresponding coordinates on a line */
  getCorrepondingCoordinates(coord, axis, lineID, DP = undefined) {
    const coords = Array.isArray(lineID) ? lineID : this._lines.get(lineID).coords;
    return gutils.getCorrespondingCoordinate(coord, axis, coords, true, DP, true);
  }

  /** Get asymptotes for a line. Return { x, y } */
  getAsymptotes(id) {
    const line = this._lines.get(id);
    if (line) {
      return {
        x: gutils.getAsymptotes(line.coords, this.getYAxisSpan() / 1.4, 'x'),
        y: gutils.getAsymptotes(line.coords, this.getXAxisSpan() / 1.4, 'y'),
      };
    } else {
      return undefined;
    }
  }

  /** Return taylor-approximation of curve with given id. Return string source of expression. */
  taylorApprox(id, n, around = 0) {
    const coords = this._lines.get(id).coords;
    const coeffs = gutils.taylorApprox(coords, n, around);
    let eq = "";
    for (let i = 0; i < coeffs.length; i++) {
      if (coeffs[i] === 0) continue;
      let term = Math.abs(coeffs[i]).toString();
      if (i > 0) {
        term += " * " + (around === 0 ? "x" : `(x ${around < 0 ? "-" : "+"} ${Math.abs(around)})`);
        if (i !== 1) term += " ** " + i;
      }
      if (coeffs[i] < 0) term = "-" + (i === 0 ? "" : " ") + term;
      else if (i > 0) term = "+ " + term;
      eq += term + " ";
    }
    return eq.trim();
  }

  /** Get maximum points of a function */
  getMaxPoints(id) {
    return gutils.getMaxPoints(this._lines.get(id).coords);
  }

  /** Get minimum points of a function */
  getMinPoints(id) {
    return gutils.getMinPoints(this._lines.get(id).coords);
  }

  /** Populate this._events */
  _generateEvents(handlers, onupdate) {
    for (let type in handlers) this._events.push([type, handlers[type]]);
  }

  /**
   * Add event handlers to this._eventListenerEl
   * @param {{ [type: string]: (e: Event) => void }} handlers extra handlers to register
   * @param {(g: Graph) => void} onupdate something has been changed - request to update the canvas
  */
  addEvents(handlers, onupdate) {
    this._generateEvents(handlers, onupdate);
    for (let i = 0; i < this._events.length; i++) {
      const bound = e => this._events[i][1](e, onupdate);
      this._events[i][2] = bound;
      this._eventListenerEl.addEventListener(this._events[i][0], bound);
    }
  }

  /** Remove event handlers from this._eventListenerEl */
  removeEvents() {
    this._events.forEach(([type, _, handle]) => this._eventListenerEl.removeEventListener(type, handle)); // Remove BOUND handlers at [2]
    this._events.length = 0;
  }
}

Graph.validCoordinates = (x, y) => !isNaN(x) && isFinite(x) && !isNaN(y) && isFinite(y);