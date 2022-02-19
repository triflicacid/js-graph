import { getTextMetrics } from "./utils.js";

export class Point {
    constructor(lineID, typeID, x, y) {
        this.lineID = lineID;
        this.typeID = typeID;
        // NB coordinates are translated coordinates on canvas
        this.x = x;
        this.y = y;
        this.flag = false;
    }

    typeString() {
        return Point.types[this.typeID] || "";
    }

    toString() {
        const t = Point.types[this.typeID];
        return (t ? `${t}: ` : '') + `(${this.x}, ${this.y})`;
    }

    display(ctx, transformCoords) {
        ctx.beginPath();
        ctx.fillStyle = "red";
        let [x, y] = transformCoords(this.x, this.y);
        const r = Point.radius * (this.flag ? 2 : 1);
        ctx.arc(x, y, r, 0, 2*Math.PI);
        ctx.fill();
        if (this.flag) {
            const text = this.toString();
            const { width, height } = getTextMetrics(ctx, text);
            ctx.beginPath();
            ctx.fillStyle = 'lightgray';
            ctx.strokeStyle = "black";
            ctx.lineWidth = 1;
            ctx.rect(x - 3, y - height - 6, width + 6, height + 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "black";
            y = y - r - 4;
            ctx.fillText(text, x, y);
        }
    }
}

Point.types = {
    0: 'Y-Intercept',
    1: 'Root',
    2: 'Minimum',
    3: 'Maximum',
    4: 'Turning',
    5: 'Intercept',
};
Point.radius = 3;