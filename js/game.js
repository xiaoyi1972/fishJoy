class Rand {
    constructor(_seed = Math.floor(new Date().getMilliseconds())) {
        this.seed = _seed
    }

    gen(min = 0, max = min + 1) {
        this.seed = (this.seed * 9301 + 49297) % 233280
        return min + this.seed / 233280.0 * (max - min)
    }
}

class Render {
    constructor(canvas) {
        this.ctx = canvas.getContext('2d')
        this.spirits = []
        this.over = false
        this.sorted = false
        this.loop = this.loop.bind(this)
        this.tickElements = []
        this.elements = { click: [], mouseMove: [] }
        this.mouseClick = this.mouseClick.bind(this), this.mouseMove = this.mouseMove.bind(this)
        canvas.addEventListener('click', this.mouseClick)
        canvas.addEventListener('mousemove', this.mouseMove)
    }

    mouseMove(event) {
        event = event || window.event
        this.ctx.save()
        this.ctx.setTransform(1, 0, 0, 1, 0, 0)
        this.elements.mouseMove.forEach(item => {
            if (item.mouse?.move)
                for (const { area, handle } of item.mouse.move) {
                    if (this.ctx.isPointInPath(area, event.offsetX, event.offsetY)) {
                        handle(event)
                        return
                    }
                }
        })
        this.ctx.restore()
    }

    mouseClick(event) {
        event = event || window.event
        this.ctx.save()
        this.ctx.setTransform(1, 0, 0, 1, 0, 0)
        this.elements.click.forEach(item => {
            if (item.mouse?.click)
                for (const { area, handle } of item.mouse.click) {
                    if (this.ctx.isPointInPath(area, event.offsetX, event.offsetY)) {
                        handle(event)
                        break
                    }
                }
        })
        this.ctx.restore()
    }

    restart() {
        this.over = false
        if (!this.handle) cancelAnimationFrame(this.handle)
        this.loop()
    }

    loop(time) {
        if (!this.over) {
            TWEEN.update()
            this.logic()
            this.draw()
            this.handle = requestAnimationFrame(this.loop)
        }
    }

    logic() {
        const len = this.tickElements.length
        const filterElements = this.tickElements.filter(spirit => {
            const e = spirit.item
            if (!e.dead) e.tick(this)
            return !e.dead
        })
        this.tickElements = [...filterElements, ...this.tickElements.slice(len, this.tickElements.length)]
    }

    draw() {
        if (!this.sorted) {
            this.spirits.sort((a, b) => { return a.visible && b.visible ? (a.zIndex < b.zIndex ? -1 : 1) : a.visible < b.visible ? 1 : -1 })
            this.sorted = true
        }
        this.ctx.clearRect(0, 0, this.ctx.width, this.ctx.height)
        const len = this.spirits.length, sortedArray = []
        // console.log(`spirits[${this.spirits.length}] lived_fish{${this.fishGenerator.sets.size}]`)
        for (let i = 0; i < len && this.spirits[i].visible; i++) {
            //if (this.spirits[i].animate instanceof Animator) this.spirits[i].animate.update()
            if (!this.spirits[i].cover) this.spirits[i].item.draw(this.ctx)
            sortedArray.push(this.spirits[i])
        }
        this.spirits = sortedArray
    }

    bindEvent(item) {
        if (item.mouse?.click) this.elements.click.push(item)
        if (item.mouse?.move) this.elements.mouseMove.push(item)
    }

    push(img, item, zIndex = 0) {
        item.bindEvent = this.bindEvent.bind(this)
        const spirit = new Spirit(item, img, this)
        if (spirit.item?.tick) this.tickElements.push(spirit)
        spirit.zIndex = zIndex
        this.sorted = false
        return item
    }
}

class Game {
    constructor() {
        const scene = document.querySelector('#game_box')
        Game.dpiOptimize(scene)
        this.render = new Render(scene)
        this.data = { score: 0 }
        this.fishGenerator = {
            rand: new Rand(),
            amount: 10,
            sets: new Set(),
            delete: function (fish) { this.fishGenerator.sets.delete(fish) }.bind(this),
            create: function (boundary) {
                if (this.fishGenerator.sets.size == this.fishGenerator.amount) return
                const rand = this.fishGenerator.rand, level = Math.trunc(rand.gen(1, 6))
                    , size = Fish.config[level].size
                let angle, x = rand.gen(boundary.cx, boundary.fx), y = rand.gen(boundary.cy, boundary.fy)
                x = x < boundary.fx / 2 ? boundary.cx : boundary.fx

                //x = (boundary.fx - boundary.cx) * .5, y = (boundary.fy - boundary.cy) * .5
                const angle_v = Math.atan2(y - boundary.fy / 2, x - boundary.fx / 2) * 180 / Math.PI
                angle = angle_v
                if (angle < 45 && angle >= -45) {  //right
                    angle = rand.gen(135, 225)
                } else if (angle < 135 && angle >= 45) {  //down
                    angle = rand.gen(-45, -135)
                } else if ((angle <= 180 && angle >= 135) || (angle >= -180 && angle < -135)) {  //left
                    angle = rand.gen(-45, 45)
                } else if (angle <= -45 && angle >= -135) {  //up
                    angle = rand.gen(45, 135)
                }
                angle = Rect.toRadians(angle)

                const corners = new Rect({ x: x, y: y, w: size.w, h: size.h, angle: Rect.toDegrees(angle) })
                    .getCorners()
                    .reduce((a, b) => {
                   //     console.log(a, b)
                        a = a ?? b
                        return x == boundary.cx ? (a.x > b.x ? a : b) : (a.x < b.x ? a : b)
                    }, null)
               // console.log(x, corners)
                x += x - corners.x
             //   console.log("x:", x, "===========")

                //   console.log(boundary.cx, boundary.fx, x)
                const vx = Math.cos(angle), vy = Math.sin(angle)
                const props = {
                    x: x, y: y,
                    vx: vx, vy: vy,
                    angle:
                        //0,
                        // Math.PI / 4 * 0,
                        angle,
                    speed: 1.,//- .5,
                    level: level,
                    boundary: boundary,
                    game: this
                }
                const fish = this.render.push(Assets.images[`fish${level}`], new Fish(props), 2)
                fish.deadProxy = function () { this.fishGenerator.delete(fish) }.bind(this)
                this.fishGenerator.sets.add(fish)
                return fish
            }
        }
        this.render.fishGenerator = this.fishGenerator
        this.init()
        //this.render.restart()
    }

    init() {
        const stage = this.render.push(Assets.images.game_bg, new Stage({ game: this })).attach(item => {
            const img = item.img
            item.boundary = {
                cx: 0, fx: img.width,
                cy: 0, fy: img.height
            }
            item.boundary.check = function (pos) {
                const { cx, fx, cy, fy } = item.boundary, { x, y } = pos
              //  console.log("cx:", cx, "fx:", fx, "cy:", cy, "fy:", fy, "x:", x, "y:", y)
                return (x < cx || x > fx || y < cy || y > fy) ? false : true
            }.bind(item.boundary)
        })

        this.fishGenerator.create = this.fishGenerator.create.bind(this, stage.boundary)
        this.fishGenerator.coinBox = { x: 50, y: stage.boundary.fy - 40 }

        const gun = this.render.push(
            Assets.images.cannon1,
            new Gun({
                ctx: this.render.ctx, x: 0, y: 0, speed: 0, level: 1, boundary: stage.boundary,
                game: this,
            }), 6
        ).attach(item => {
            const mouseMove = []
            {
                const path = new Path2D()
                path.rect(0, 0, this.render.ctx.width, this.render.ctx.height)
                mouseMove.push({ area: path, handle: item.aim.bind(item) })
            }
            const mouseClick = []
            {
                const path = new Path2D()
                path.rect(0, 0, this.render.ctx.width, this.render.ctx.height)
                mouseClick.push({ area: path, handle: item.click.bind(item, this.render) })
            }
            item.mouse = { move: mouseMove, click: mouseClick }
        })

        this.render.push(
            Assets.images.bottom,
            new Bar({ gun: gun, game: this }), 4
        ).attach(item => {
            const listeners = []
            const button = item.gunButton
            const relative = { x: button.pos.x + button.divide, y: this.render.ctx.height - button.data.h, spacing: 130 }
            {
                const path = new Path2D()
                path.rect(relative.x, relative.y, button.data.w, button.data.h)
                listeners.push({ area: path, handle: item.add.bind(item, true) })
            }
            {
                const path = new Path2D()
                path.rect(relative.x + relative.spacing, relative.y, button.data.w, button.data.h)
                listeners.push({ area: path, handle: item.add.bind(item, false) })
            }
            item.mouse = { click: listeners }
        })

        for (let i = 0; i < this.fishGenerator.amount; i++)
            this.fishGenerator.create()

        // this.render.push(Assets.images.web, new Web({ x: 200, y: 200, level: 1 }), 2)
    }

    play() {
        this.render.restart()
    }

    static dpiOptimize(canvas) {
        function getPixelRatio(context) {
            let backingStore = context.backingStorePixelRatio ||
                context.webkitBackingStorePixelRatio ||
                context.mozBackingStorePixelRatio ||
                context.msBackingStorePixelRatio ||
                context.oBackingStorePixelRatio ||
                context.backingStorePixelRatio || 1
            return (window.devicePixelRatio || 1) / backingStore
        }
        const ctx = canvas.getContext('2d'), ratio = getPixelRatio(ctx)
        canvas.style.width = canvas.width + 'px'
        canvas.style.height = canvas.height + 'px'
        canvas.width = canvas.width * ratio
        canvas.height = canvas.height * ratio
        ctx.scale(ratio, ratio)
        ctx.width = canvas.width / ratio, ctx.height = canvas.height / ratio
    }
}

let game
window.onload = async function () {
    await Spirit.loadResource(Assets.path, Assets.images)
    game = new Game()
    game.play()
}
