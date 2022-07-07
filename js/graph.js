class Vector {
    constructor({ x = 0, y = 0 } = {}) {
        this.x = x
        this.y = y
    }

    get magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    Add(factor) {
        const f = typeof factor === 'object' ? { x: 0, y: 0, ...factor } : { x: factor, y: factor }
        return new Vector({
            x: this.x + f.x, y: this.y + f.y,
        })
    }

    Minus(factor) {
        const f = typeof factor === 'object' ? { x: 0, y: 0, ...factor } : { x: factor, y: factor }
        return new Vector({
            x: this.x - f.x, y: this.y - f.y,
        })
    }

    Multiply(factor) {
        const f = typeof factor === 'object' ? { x: 0, y: 0, ...factor } : { x: factor, y: factor }
        return new Vector({
            x: this.x * f.x, y: this.y * f.y,
        })
    }

    Rotate(theta) {
        return new Vector({
            x: this.x * Math.cos(theta) - this.y * Math.sin(theta),
            y: this.x * Math.sin(theta) + this.y * Math.cos(theta),
        })
    }

    Project(line) {
        const dotvalue = line.direction.x * (this.x - line.origin.x)
            + line.direction.y * (this.y - line.origin.y)
        return new Vector({
            x: line.origin.x + line.direction.x * dotvalue,
            y: line.origin.y + line.direction.y * dotvalue,
        })
    }
}

class Line {
    constructor({ x = 0, y = 0, dx = 0, dy = 0 }) {
        this.origin = new Vector({ x, y })
        this.direction = new Vector({ x: dx, y: dy })
    }
}

class Rect {
    constructor({
        x = 0, y = 0, w = 10, h = 10,
        theta = null, angle = 0,
    }) {
        this.center = new Vector({ x, y })
        this.size = new Vector({ x: w, y: h })
        this.theta = theta || Rect.toRadians(angle)
    }

    getAxis() {
        const OX = new Vector({ x: 1, y: 0 }), OY = new Vector({ x: 0, y: 1 })
        const RX = OX.Rotate(this.theta), RY = OY.Rotate(this.theta)
        return [
            new Line({ ...this.center, dx: RX.x, dy: RX.y }),
            new Line({ ...this.center, dx: RY.x, dy: RY.y }),
        ]
    }

    getCorners() {
        const axis = this.getAxis()
        const RX = axis[0].direction.Multiply(this.size.x / 2)
        const RY = axis[1].direction.Multiply(this.size.y / 2)
        return [
            this.center.Add(RX).Add(RY),
            this.center.Add(RX).Add(RY.Multiply(-1)),
            this.center.Add(RX.Multiply(-1)).Add(RY.Multiply(-1)),
            this.center.Add(RX.Multiply(-1)).Add(RY),
        ]
    }

    isRectCollide(rectB) {
        const isProjectionCollide = ({ rect, onRect }) => {
            const lines = onRect.getAxis()
            const corners = rect.getCorners()

            let isCollide = true
            
            lines.forEach((line, dimension) => {
                const futhers = { min: null, max: null }
                const rectHalfSize = (dimension === 0 ? onRect.size.x : onRect.size.y) / 2
                corners.forEach(corner => {
                    const projected = corner.Project(line)
                    const CP = projected.Minus(onRect.center)
                    const sign = (CP.x * line.direction.x) + (CP.y * line.direction.y) > 0
                    const signedDistance = CP.magnitude * (sign ? 1 : -1)

                    if (!futhers.min || futhers.min.signedDistance > signedDistance) {
                        futhers.min = { signedDistance, corner, projected }
                    }
                    if (!futhers.max || futhers.max.signedDistance < signedDistance) {
                        futhers.max = { signedDistance, corner, projected }
                    }
                })

                if (!(futhers.min.signedDistance < 0 && futhers.max.signedDistance > 0
                    || Math.abs(futhers.min.signedDistance) < rectHalfSize
                    || Math.abs(futhers.max.signedDistance) < rectHalfSize)) {
                    isCollide = false
                }
            })
            return isCollide
        }

        const rectA = this
        const rA = rectA instanceof Rect ? rectA : new Rect(rectA)
        const rB = rectB instanceof Rect ? rectB : new Rect(rectB)
        return isProjectionCollide({ rect: rA, onRect: rB })
            && isProjectionCollide({ rect: rB, onRect: rA })
    }
}

Rect.toRadians = (degrees) => degrees * Math.PI / 180
Rect.toDegrees = (radians) => radians * 180 / Math.PI
Rect.fixFloat = (number, precision = Math.log10(1 / Number.EPSILON)) => number ? parseFloat(number.toFixed(precision)) : 0

class Quadtree {
    constructor(bounds, max_objects, max_levels, level) {
        this.max_objects = max_objects || 10
        this.max_levels = max_levels || 4
        this.level = level || 0
        this.bounds = bounds
        this.objects = []
        this.nodes = []
    }

    split() {
        const nextLevel = this.level + 1,
            subWidth = this.bounds.width / 2, subHeight = this.bounds.height / 2,
            x = this.bounds.x, y = this.bounds.y
        //top right node
        this.nodes[0] = new Quadtree({
            x: x + subWidth, y: y,
            width: subWidth, height: subHeight
        }, this.max_objects, this.max_levels, nextLevel)
        //top left node
        this.nodes[1] = new Quadtree({
            x: x, y: y,
            width: subWidth, height: subHeight
        }, this.max_objects, this.max_levels, nextLevel)
        //bottom left node
        this.nodes[2] = new Quadtree({
            x: x, y: y + subHeight,
            width: subWidth, height: subHeight
        }, this.max_objects, this.max_levels, nextLevel)
        //bottom right node
        this.nodes[3] = new Quadtree({
            x: x + subWidth, y: y + subHeight,
            width: subWidth, height: subHeight
        }, this.max_objects, this.max_levels, nextLevel)
    }

    getIndex(pRect) {
        const indexes = [],
            verticalMidpoint = this.bounds.x + (this.bounds.width / 2),
            horizontalMidpoint = this.bounds.y + (this.bounds.height / 2)
        const startIsNorth = pRect.y < horizontalMidpoint,
            startIsWest = pRect.x < verticalMidpoint,
            endIsEast = pRect.x + pRect.width > verticalMidpoint,
            endIsSouth = pRect.y + pRect.height > horizontalMidpoint
        //top-right quad
        if (startIsNorth && endIsEast) { indexes.push(0) }
        //top-left quad
        if (startIsWest && startIsNorth) { indexes.push(1) }
        //bottom-left quad
        if (startIsWest && endIsSouth) { indexes.push(2) }
        //bottom-right quad
        if (endIsEast && endIsSouth) { indexes.push(3) }
        return indexes
    }


    insert(pRect) {
        let i = 0, indexes
        //if we have subnodes, call insert on matching subnodes
        if (this.nodes.length) {
            indexes = this.getIndex(pRect)
            for (i = 0; i < indexes.length; i++) {
                this.nodes[indexes[i]].insert(pRect)
            }
            return
        }
        //otherwise, store object here
        this.objects.push(pRect)
        //max_objects reached
        if (this.objects.length > this.max_objects && this.level < this.max_levels) {
            //split if we don't already have subnodes
            if (!this.nodes.length) {
                this.split()
            }
            //add all objects to their corresponding subnode
            for (i = 0; i < this.objects.length; i++) {
                indexes = this.getIndex(this.objects[i])
                for (let k = 0; k < indexes.length; k++) {
                    this.nodes[indexes[k]].insert(this.objects[i])
                }
            }
            //clean up this node
            this.objects = []
        }
    }

    retrieve(pRect) {
        let indexes = this.getIndex(pRect),
            returnObjects = this.objects
        //if we have subnodes, retrieve their objects
        if (this.nodes.length) {
            for (let i = 0; i < indexes.length; i++) {
                returnObjects = returnObjects.concat(this.nodes[indexes[i]].retrieve(pRect))
            }
        }
        //remove duplicates
        returnObjects = returnObjects.filter(function (item, index) {
            return returnObjects.indexOf(item) >= index
        })
        return returnObjects
    }

    clear() {
        this.objects = []
        for (let i = 0; i < this.nodes.length; i++) {
            if (this.nodes.length) {
                this.nodes[i].clear()
            }
        }
        this.nodes = []
    }
}
