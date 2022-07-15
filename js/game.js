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
        for (let i = 0; i < len && this.spirits[i].visible; i++) {
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
        this.init()
    }

    init() {
        const stage = this.render.push(Assets.images.game_bg, new Stage({ game: this }))
        Fish.generator.create = Fish.generator.create.bind(this, this.render, Stage.boundary)
        const gun = this.render.push(
            Assets.images.cannon1,
            new Gun({
                ctx: this.render.ctx, x: 0, y: 0, speed: 0, level: 1,
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
        
        for (let i = 0; i < Fish.generator.amount; i++) Fish.generator.create()
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