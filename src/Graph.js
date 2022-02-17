import { Point } from "./Point.js";
import { calcCoordsFromGradient, calcGradient, extractChangeOfSign, getAsymptotes, getCorrespondingCoordinate, getCorrepondingCoordinateIndex, getIntercepts, lerpCoords, roundMultiple, roundTowards0, taylorApprox, getMaxPoints, getMinPoints } from "./utils.js";

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
        this._points.push(new Point(arg.lineID, arg.typeID, +arg.x, +arg.y));
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
        if (n !== 0 && this.opts.markXAxis) {
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

          if (this.opts.subGridDivs > 0) {
            for (let ii = 0, xx = x; ii < this.opts.subGridDivs; ++ii, xx += subGridInc) {
              this._ctx.beginPath();
              this._ctx.strokeStyle = 'black';
              this._ctx.lineWidth = this.opts.gridThickness / 2;
              this._ctx.moveTo(xx, 0);
              this._ctx.lineTo(xx, this.height);
              this._ctx.stroke();
            }
          }
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

      const lll = 5, subGridInc = this.opts.ystepGap / this.opts.subGridDivs;
      for (let i = 0, n = roundMultiple(this.opts.ystart, this.opts.ystep, roundTowards0), y = this.getCoordinates(0, n)[1]; y < this.height; i++, n -= this.opts.ystep, y += this.opts.ystepGap) {
        if (n !== 0 && this.opts.markYAxis) {
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

          if (this.opts.subGridDivs > 0) {
            for (let ii = 0, yy = y; ii < this.opts.subGridDivs; ++ii, yy += subGridInc) {
              this._ctx.beginPath();
              this._ctx.strokeStyle = 'black';
              this._ctx.lineWidth = this.opts.gridThickness / 2;
              this._ctx.moveTo(0, yy);
              this._ctx.lineTo(this.width, yy);
              this._ctx.stroke();
            }
          }
        }
      }
    }

    // lines
    lines: {
      for (let [id, data] of this._lines) {
        data.draw ??= true;
        let coords = this.generateCoords(id);
        data.coords = coords;
        if (!data.draw) continue;
        coords = coords.map(([x, y]) => this.getCoordinates(x, y));
        if (!data.error) {
          if (coords.length !== 0) {
            this._plotPoints(coords, data);
          }
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
          case 'x': // Control the x-coordinate
            inc = xAxisSpan / ncoords;
            try {
              if (data.cond) {
                for (var i = 0, x = opts.xstart; i < ncoords; ++i, x += inc) {
                  if (!data.cond(x)) continue;
                  let y = data.fn(x);
                  if (Graph.validCoordinates(x, y)) coords.push([x, y]);
                }
              } else {
                for (var i = 0, x = opts.xstart; i < ncoords; ++i, x += inc) {
                  let y = data.fn(x);
                  if (Graph.validCoordinates(x, y)) coords.push([x, y]);
                }
              }
            } catch (e) {
              data.emsg = e.message;
            }
            break;
          case 'y': // Control the y-coordinate
            inc = yAxisSpan / ncoords;
            opts.ystart ??= this.opts.ystart;
            try {
              if (data.cond) {
                for (let i = 0, y = opts.ystart; i < ncoords; ++i, y -= inc) {
                  if (!data.cond(y)) continue;
                  let x = data.fn(y);
                  if (Graph.validCoordinates(x, y)) coords.push([x, y]);
                }
              } else {
                for (let i = 0, y = opts.ystart; i < ncoords; ++i, y -= inc) {
                  let x = data.fn(y);
                  if (Graph.validCoordinates(x, y)) coords.push([x, y]);
                }
              }
            } catch (e) {
              data.emsg = e.message;
            }
            break;
          case 'p': // Control a parameter
            opts.xstart ??= this.opts.xstart;
            opts.ystart ??= this.opts.ystart;
            if (!Array.isArray(data.range)) {
              data.emsg = `Invalid 'range' property`;
              break;
            }
            inc = data.range[2] ?? (Math.abs(data.range[1] - data.range[0]) / ncoords);
            try {
              for (let i = 0, p = data.range[0]; p <= data.range[1]; ++i, p += inc) {
                let x = data.fnx(p), y = data.fny(p);
                if (Graph.validCoordinates(x, y)) coords.push([x, y]);
              }
            } catch (e) {
              data.emsg = e.message;
            }
            break;
          case 'd': { // Plot gradient of another function
            coords = calcGradient(refLine.coords);
            break;
          }
          case 'i': { // Plot integrand of another function
            data.C ??= 0;
            coords = calcCoordsFromGradient(refLine.coords, data.C);
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
          case 'θ': // Polar
            if (!data.range) data.range = [0, 2 * Math.PI];
            inc = data.range[2] ?? (Math.abs(data.range[1] - data.range[0]) / ncoords);
            try {
              for (let i = 0, θ = data.range[0]; θ <= data.range[1]; ++i, θ += inc) {
                let r = data.fn(θ);
                if (!isNaN(r) && isFinite(r)) {
                  let x = r * Math.cos(θ), y = r * Math.sin(θ);
                  coords.push([x, y]);
                }
              }
            } catch (e) {
              data.emsg = e.message;
              break;
            }
            break;
          case 'c': // Coords
            coords = data.coords;
            break;
          case 'e': {
            const D = 0.04;
            for (let h = 0; h < this.height; h += 1) {
              for (let w = 0; w < this.width; w += 1) {
                let [x, y] = this.fromCoordinates(w, h);
                let lhs = data.lhs(x, y), rhs = data.rhs(x, y);
                if (lhs >= rhs - D && lhs <= rhs + D) {
                  coords.push([x, y]);
                }
              }
            }
            break;
          }
          case '~': {
            if (this._lines.get(data.id) === undefined) {
              data.emsg = 'Unknown line with ID ' + data.id;
            } else {
              try {
                let approx;
                try {
                  approx = this.taylorApprox(data.id, data.degree, data.C ?? 0);
                } catch (e) {
                  console.warn(e);
                  data.emsg = 'Unable to create Taylor approximation. Does this curve exist at <a=' + data.C + '>?';
                  break;
                }
                data.fnRaw = approx.fnRaw;
                data.fn = approx.fn;
                const inc = xAxisSpan / ncoords;
                for (var i = 0, x = opts.xstart; i < ncoords; ++i, x += inc) {
                  let y = approx.fn(x);
                  if (Graph.validCoordinates(x, y)) coords.push([x, y]);
                }
              } catch (e) {
                data.emsg = e.message;
              }
            }
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
      return calcGradient(coords);
    } else {
      return false;
    }
  }

  /** Generate coordinates of the integrand to curve <ID>. genNewCoords - generate new coordinates if line.coords is present?. Assume passes through (0,0) */
  generateIntegrandCoords(id, genNewCoords = false, opts = {}) {
    const line = this._lines.get(id);
    if (line) {
      const coords = line.coords && !genNewCoords ? line.coords : this.generateCoords(id, opts);
      return calcCoordsFromGradient(coords);
    } else {
      return false;
    }
  }

  _plotPoints(coords, data) {
    this._ctx.save();
    this._ctx.lineWidth = data.lineWidth ?? this.opts.lineWidth;
    this._ctx.strokeStyle = data.color ?? 'black';
    data.color = this._ctx.strokeStyle;
    if (data.dash) this._ctx.setLineDash(data.dash);

    let off = 10, noff = -off, height = this.height + off, width = this.width + off, asyh = this.height / 1.5; // Check that coords are in screen bounds!
    if (data.join === undefined || data.join) {
      coords = coords.filter(([x, y]) => (x >= noff && x < width && y >= noff && y < height));
      let inPath = false;
      for (let i = 0; i < coords.length; i++) {
        let [x, y] = coords[i];
        if (inPath) {
          this._ctx.lineTo(x, y);
        } else {
          this._ctx.beginPath();
          this._ctx.moveTo(x, y);
          inPath = true;
        }

        if (coords[i + 1] === undefined) {
          this._ctx.stroke();
        } else if (Math.abs(y - coords[i + 1][1]) >= asyh) {
          this._ctx.stroke();
          inPath = false;
        } else if (Math.abs(coords[i + 1][0] - x) > g.opts.xstep) {
          this._ctx.stroke();
          inPath = false;
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

  /** Return array of axis-intercepts for the given line at the given axis. An array of coords may be given in place of if. */
  getAxisIntercept(id, axis, iterations = 20, divs = 50) {
    const DP = 5;
    const axisIndex = axis === 'x' ? 0 : 1, otherAxisIndex = axisIndex ? 0 : 1;
    const coords = Array.isArray(id) ? id : this.getLine(id).coords;
    let intercepts = extractChangeOfSign(coords, otherAxisIndex, DP);
    lerpCoords(intercepts, 0.5);
    return intercepts;
  }

  /** Return array of turning points for the given line */
  getTurningPoints(id, iterations = 20, divs = 50) {
    let line = this._lines.get(id), points = [];
    if (line) {
      // if (line.type !== 'x' && line.type !== 'y') return console.error(`Cannot find turning points of line of type ${line.type}`);
      let coords = line.coords ?? this.generateCoords(id);
      let mcoords = calcGradient(coords);
      let roots = this.getAxisIntercept(mcoords, 'x', iterations, divs);
      roots.forEach(([rx, ry]) => {
        let subPoints = getCorrespondingCoordinate(rx, 'x', coords, true);
        points.push(...subPoints);
      });
    }
    return points;
  }

  /** Calculate area under curve <ID> (or where <ID> is coordinate array) between <a> and <b> */
  getArea(id, a, b, n = 10000) {
    if (Array.isArray(id)) {
      let coords = [], secStart = getCorrepondingCoordinateIndex(a, 'x', id, false), secEnd = getCorrepondingCoordinateIndex(b, 'x', id, false);
      coords = secStart <= secEnd ? id.slice(secStart, secEnd + 1) : id.slice(secEnd, secStart + 1);
      n = coords.length;
      let h = (b - a) / n, mid = 0;
      for (let i = 1; i < coords.length - 1; ++i) {
        mid += coords[i][1];
      }
      let A = 0.5 * h * ((coords[0][1] + coords[coords.length - 1][1]) + 2 * mid);
      return A;
    } else {
      const line = this._lines.get(id);
      if (line) {
        if (line.type !== 'x') {
          console.error(`Cannot find area under line of type '${line.type}'`);
          return NaN;
        }
        const h = (b - a) / n, coords = [];
        for (let x = a; x <= b; x += h) {
          let y = line.fn(x);
          if (Graph.validCoordinates(x, y)) coords.push([x, y]);
        }
        let mid = 0;
        for (let i = 1; i < coords.length - 1; ++i) mid += coords[i][1];
        let A = 0.5 * h * ((coords[0][1] + coords[coords.length - 1][1]) + 2 * mid);
        return A;
      } else {
        return NaN;
      }
    }
  }

  /** Get intercepts between two lines (or coordinate arrays) */
  getIntercepts(id1, id2, DP = undefined) {
    const coords1 = Array.isArray(id1) ? id1 : this._lines.get(id1).coords;
    const coords2 = Array.isArray(id2) ? id2 : this._lines.get(id2).coords;
    return getIntercepts(coords1, coords2, DP);
  }

  /** Get corresponding coordinates on a line */
  getCorrepondingCoordinates(coord, axis, lineID, DP = undefined) {
    const coords = Array.isArray(lineID) ? lineID : this._lines.get(lineID).coords;
    return getCorrespondingCoordinate(coord, axis, coords, true, DP, true);
  }

  /** Get asymptotes for a line. Return { x, y } */
  getAsymptotes(id) {
    const line = this._lines.get(id);
    if (line) {
      return {
        x: getAsymptotes(line.coords, this.getYAxisSpan() / 1.4, 'x'),
        y: getAsymptotes(line.coords, this.getXAxisSpan() / 1.4, 'y'),
      };
    } else {
      return undefined;
    }
  }

  /** Return taylor-approximation of curve with given id. Returns line object, but does not create it. */
  taylorApprox(id, n, around = 0) {
    const coords = this._lines.get(id).coords;
    const coeffs = taylorApprox(coords, n, around);
    const eq = coeffs.map((c, i) => c === 0 ? '' : c + (i === 0 ? '' : '*' + (around === 0 ? 'x' : `(x${around < 0 ? '' : '-'}${around})`) + '**' + i)).filter(x => x.length !== 0).join('+');
    return {
      type: 'x',
      fnRaw: eq,
      fn: Function('x', 'return ' + eq)
    };
  }

  /** Get maximum points of a function */
  getMaxPoints(id) {
    return getMaxPoints(this._lines.get(id).coords);
  }

  /** Get minimum points of a function */
  getMinPoints(id) {
    return getMinPoints(this._lines.get(id).coords);
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