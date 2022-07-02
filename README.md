# Graph Sketcher
The `Graph` class takes two arguments: a HTML `<canvas>` to draw to, and an optional HTML element to register events to.

## Properties
These are the main `Graph` API properties.

- `width: number` : width of canvas.
- `height: number` : height of canvas.
- `canvas: HTMLCanvasElement` [*readonly*] : `<canvas>` element.
- `ctx: CanvasRenderingContext2D` [*readonly*] : `<canvas>` rendering context.

## Methods
These are the main `Graph` API methods.

- `addEvents(events: IEventMap)` : add events in `events` and some pre-coded events to `Graph::__eventListenerEl`.
- `addLine(data: ILine): number` : takes line data and adds to graph. Returns ID of line. See Lines section for information on `ILine`.
- `generateCoords(id: number, opts?: object): number[][]` : generate array of coordinates for the given line. `opts` will override `Graph::opts`.
- `generateGradientCoords(id: number, genNewCoords?: boolean, opts?: object): number[][]` : generate array of coordinates which map the change of gradient of curve `id`. If `genNewCoords` is truthy, first generate new coordinates for line `id` with `opts` options. *(Differentiate)*
- `generateIntegrandCoords(id: number, genNewCoords?: boolean, opts?: object): number[][]` : generate array of coordinates which plot a new curve as if coordinates of line `id` where mapping the change in gradient. If `genNewCoords` is truthy, first generate new coordinates for line `id` with `opts` options. *(Integrate, C=0)*
- `getAxisIntercept(id: number | number[][], axis: 'x' | 'y', iterations: number, divs: number)` - use iteration to calculate axis-intercepts of line with id `id` of in array of coordinates `id`.
- `fixOpts()` : "fixes" the `Graph::opts` object by filling in `undefined` properties.
- `getCoordinates(x: number, y: number): [number, number]` : takes coordinates to plot and transform to coordinates on `<canvas>`. See Formulae section.
- `getLine(id: number): ILine | undefined` : retrieved line object with ID `id`.
- `fromCoordinates(x: number, y: number): [number, number]` : takes coordinates on `<canvas>` and transform to graph coordinates. See Formulae section.
- `removeEvents()` : remove events added via `Graph::addEvents` from `Graph::__eventListenerEl`.

## Formulae
Key formulae used in `Graph`.

- Span of x-axis: `xAxisSpan = (width / xstepGap) * xstep`
- Span of y-axis: `yAxisSpan = (height / ystepGap) * ystep`
- Map plotted coordinates to `<canvas>` coordinates. Map `[x, y]` to `[((x - xstart) / xstep) * xstepGap, ((ystart - y) / ystep) * ystepGap]`.
- Map `<canvas>` coordinates to plotted coordinates. Map `[x, y]` to `[((xstep * x) / xstepGap) + xstart, ystart - ((y * ystep) / ystepGap)]`.

## Options
These control the behaviour of the graph and reside in the `Graph::opts` property. All properties are optional.

- `axisThickness: number` : line thickness of the axis.
- `grid: boolean` : whether to display a grid (grid lines are at every x/y-interval).
- `gridThickness: number` : line thickness of the grid (if `grid == true`).
- `lineWidth: number` : the default value of `ILine.lineWidth` if it is not defined for that line.
- `ncoords: number` : the default value of `ILine.ncoords` if it is not defined for that line.
- `subGridDivs: number` : number of sub-divisions inside each x/y-step. If < 0, don't draw.
- `xStart: number` : The starting value (leftmost value) on the x-axis.
- `xStep: number` : An x-axis interval is places at every one of these. e.g. `xStep=2`, an interval is placed every `2` on the x-axis.
- `xStepGap: number` : The pixel gap between x-axis intervals.
- `xStepLabel: (x: number) => string` : Function defining labels on the x-axis. Called at every interval on the x-axis, it takes the current x-coordinate at the interval and returns the label to display.
- `yStart: number` : The starting value (topmost value) on the y-axis.
- `yStep: number` : An y-axis interval is places at every one of these. e.g. `yStep=2`, an interval is placed every `2` on the y-axis.
- `yStepGap: number` : The pixel gap between y-axis intervals.
- `yStepLabel: (y: number) => string` : Function defining labels on the y-axis. Called at every interval on the y-axis, it takes the current y-coordinate at the interval and returns the label to display.

## Lines
Each line is an object which contains sketching and aesthetic data.

- `C: number` [*optional*] [`default=0|1`]
  - If `type == 'm'`, specifies the integration constant (y-offset) with `default=0`
  - If `type == 't'`, specifies the translation constants as an array: `[scale_x, shift_x, scale_y, shift_y, theta]` with `default=[1, 0, 1, 0, pi]`
  - If `type == ~`, specifies what to approximate around
- `color: string` [*optional*] [`default='black'`] contains a CSS color string and specifies the color of the line.
- `coord: 'x' | 'y'` [*optional*] [`default='y'`] If type is `a` or `s`, specifies which coordinate to add/subtract.
- `dash: number[]` [*optional*] [`default=[]`] specifies the line dash pattern. `[]` sets to a solid line.
- `drawAll: boolean` [`default=false`] connect every co-ordinate?
- `id: number` [*optional*] required for some line types. Specifies IDs of lines.
- `ids: number[]` [*optional*] required for some line types. Specifies list of line IDs.
- `join: boolean` [*optional*] [`default=true`] specifies whether to join plotted coordinates or not.
  - `true`: draw line segments between each coordinate.
  - `false`: draw circle of radius `lineWidth` at each coordinate.
- `lineWidth: string` [*optional*] specifies width of line/radii of dots. If not present, `opts.lineWidth` is used.
- `ncoords: number` [*optional*] specifies the number of coordinates to calculate before sketching. If not present, the graph's `opts.ncoords` is used instead. The larger `ncoords`, the smoother the line.
- `degree: number` [*optional*] Required if `type == ~`. Specifies polynomial degree of approximation.
- `fn: Function|Expression` : the sketching function/expression of the line. The input and output depends on `type` (see `type` for more).
  - `x`: signature `(x: number) => number`. Coordinates: `[x, fn(x)]`.
  - `y`: signature `(y: number) => number`. Coordinates: `[fn(y), y]`.
  - `p`: signature uses `fnx` and `fny` seperatly. Coordinates: `[fnx(p), fny(p)]`.
  - `z`: contains `Expression` object
`fnx: (p: number) => number` : function used for sketching type `p`. Takes parameter `p` and returns `x` coordinate.
`fny: (p: number) => number` : function used for sketching type `p`. Takes parameter `p` and returns `y` coordinate.
- `range: any[] | 'x' | 'y' | 'a'` [*optional*] specifies the **inclusive** range for certain types `p` and `θ` syntax `[min, max, <step>]`.
  - `any[]` : 2/3-element array `[min, max, <step>]`
  - `x` : the x-axis boundaries are `min` and `max` respectively.
  - `y` : the y-axis boundaries are `min` and `max` respectively.
  - `a` : angle; span from `0` to `2pi`.
- `shade: string` [*optional*] [`default=""`] Shade area of curve. Ignored if `join=false`.
  - ``   : default - just sketch the line
  - `gt` : shade below the curve. Dashed line.
  - `lt` : shade below the curve. Dashed line.
  - `ge` : shade below the curve. Solid line.
  - `le` : shade below the curve. Solid line.
- `type: string` [*optional*] [`default='x'`] specifies the type of the line
  - `x` : the x-coordinates are passed into `data.fn` and the output is `y`. Coordinates: `[x, data.fn(x)]`.
  - `y` : the y-coordinates are passed into `data.fn` and the output is `x`. Coordinates: `[data.fn(y), y]`.
  - `p` : parametric. The paremeter `p` is controlled by `range` and outputs a 2-element array `[x, y]`. Coordinates: `data.fn(p)`.
  - `d` : derivative. Sketch the change in gradient of line with ID `id` (must be specified and sketched already).
  - `i` : integrand. Sketch a curve as if `id` is the change in gradient of that function (reverse `m`). The constant `C` is specifide.
  - `a` : addition. The key `ids` contains an array of line IDs to add together.
  - `s` : subtraction. The key `ids` contains an array of line IDs to subtract from one another.
  - `m` : multiplication. The key `ids` contains an array of line IDs to multiply togetherr.
  - `t` : translate. Translate coordinates of line `id` by scaling X, shifting X, scale Y, shifting Y, rotate (property `C` is an array)
  - `z` : complex. The x-coordinate is passed into `data.fn`, which returns `Complex` z = a + bi and plots `[a, b]`
  - `θ` : polar. `θ` varies in `range` and `f(θ)` returns `r`, which is plotted as the polar coordinate `[r, θ]`.
  - `~` : approximation. Use Taylor approximation to approximate curve `id`.

*The following properties are generated by `.sketch()`*
- `coords: [number, number][]` an array of coordinates generated by the line
- `error: boolean` was there an error sketching this line?

## Events
Events may be added to the graph - the second argument passed to `Graph::constructor` is this element.

### `addEvents(events: object, onUpdate: OnUpdate)`
Registers events to `Graph::_eventListenerEl`:
- Pre-coded events, which handle things such as moving the graph view and zooming.
- Events from `events` paremeter. This is an object mapping the event type to the listener function. `{ [type: string]: (e: Event, onUpdate: OnUpdate) => void }`.

The parameter `onUpdate` has signature `OnUpdate` (`() => void`) and used to request a redraw of the canvas. This does not actually do anything - the functionality must be coded by the user in the function.

### `removeEvents()`
Removes all events registered by `addEvents` from `Graph::_eventListenerEl`.