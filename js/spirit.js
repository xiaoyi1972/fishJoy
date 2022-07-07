class Spirit {
    constructor(item, img, render) {
        this.item = item
        this.item.img = this.img = img
        Object.defineProperties(item, {
            dead: {
                set: function (v) {
                    this.$dead = v
                    if (this?.deadProxy) this.deadProxy()
                    render.sorted = false
                }.bind(this.item),
                get: function () { return this?.$dead ?? false }.bind(this.item)
            },
            cover: {
                set: function (v) { return this.$dead = v }.bind(this.item),
                get: function () { return this.$hide }.bind(this.item)
            },
        })
        Object.defineProperties(this, {
            visible: { get: function () { return !this.item.dead }.bind(this) },
            cover: { get: function () { return this.item.hide }.bind(this) },
        })
        this.zIndex = 0
        render.spirits.push(this)
    }
}

Spirit.loadResource = async function (imageUrlArray, imageArray) {
    const promiseArray = []
    for (let imageUrl in imageUrlArray) {
        promiseArray.push(new Promise(resolve => {
            const img = new Image()
            img.onload = function () {
                resolve()
            }
            img.src = './asset/' + imageUrlArray[imageUrl]
            imageArray[imageUrl] = img
        }))
    }
    await Promise.all(promiseArray)
    console.log("all images loaded")
}

class Collision {
    static type = { rect: 0, circle: 1 }

    constructor(props) {
        this.type = props?.type ?? Collision.type.rect
        switch (this.type) {
            case Collision.type.rect: this.shape = new Rect({ ...props }); break
            case Collision.type.circle: this.shape = { x: props.x, y: props.y, radius: props.radius }; break
        }
        this.color = props?.color ?? '#fff'
    }

    detect(target) {
        if (this.type == target.type && this.type == Collision.type.rect)
            return this.shape.isRectCollide(target.shape)
        else {
            const [rect, circle] = [this.shape, target.shape].sort(((a, b) => { return a.type > b.type ? 1 : -1 }))
            return rect.getCorners().some(v => Math.sqrt(Math.pow(v.x - circle.x, 2) + Math.pow(v.y - circle.y, 2)) < circle.radius)
        }
    }

    update({ x = 0, y = 0, w = 10, h = 10, theta = null } = {}) {
        const rect = this.shape
        rect.x = x, rect.y = y, rect.h = h, rect.theta = theta
    }

    draw(ctx, isColliding = false) {
        return
        ctx.save()
        ctx.strokeStyle = isColliding ? 'rgb(255,0,0)' : this.color
        const shape = this.shape
        switch (this.type) {
            case Collision.type.rect: {
                ctx.translate(shape.center.x, shape.center.y)
                ctx.rotate(shape.theta)
                ctx.strokeRect(shape.size.x / -2, shape.size.y / -2, shape.size.x, shape.size.y)
                //ctx.fillStyle = this.color
                //ctx.fillRect(-2, -2, 4, 4)
                ctx.restore()
                break
            }
            case Collision.type.circle: {
                ctx.beginPath()
                ctx.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI)
                ctx.stroke()
                break
            }
        }
    }
}


class Item {
    constructor(props = {}) {
        Object.assign(this, props)
        if (this?.init) this.init()
    }

    attach(func) {
        func(this)
        if (this?.bindEvent) {
            this.bindEvent(this)
            delete this.bindEvent
        }
        return this
    }
}

class Stage extends Item {
    draw(ctx) {
        ctx.drawImage(this.img, 0, 0, this.img.width, this.img.height)
    }

    tick(render) {
        const fishGenerator = this.game.fishGenerator
        //console.log('fish live:', fishGenerator.sets.size, ' fish amount:', fishGenerator.amount)
        while (fishGenerator.sets.size < fishGenerator.amount) {
            fishGenerator.create()
            //console.log('create')
        }
    }
}

class Gun extends Item {
    init() {
        this.xOffset = 42, this.yOffset = 10, this.angle = 0
        this.bullet = null
        this.timer = { interval: 2, index: 0, time: 100 }
        this.frame = { index: 0, max: 5 }
        this.playing = false
        Object.defineProperty(this, "level", {
            get: function () { return this.$level }.bind(this),
            set: function (v) {
                this.$level = v
                this.img = Assets.images[`cannon${this.level}`]
            }.bind(this)
        })
        this.level = 1
        this.relative = {}, this.rotate = {}, this.start = {}
        Object.defineProperties(this.relative, {
            x: { get: function () { return this.ctx.width / 2 + this.xOffset }.bind(this) },
            y: { get: function () { return this.ctx.height + this.yOffset }.bind(this) },
        })
        Object.defineProperties(this.start, {
            x: { get: function () { return this.relative.x - this.img.width / 2 }.bind(this) },
            y: { get: function () { return this.relative.y - this.img.height / 5 }.bind(this) },
        })
        Object.defineProperties(this.rotate, {
            x: { get: function () { return this.start.x + this.img.width / 2 }.bind(this) },
            y: { get: function () { return this.start.y + this.img.height / 5 * .5 }.bind(this) },
        })
    }

    aim(event) {
        this.point = { x: event.offsetX, y: event.offsetY }
        this.getAngle(this.rotate, this.point)
    }

    click(render, event) {
        //if (this.bullet != null) return
        const { x: sx, y: sy } = this.getAngle(this.rotate, { x: event.offsetX, y: event.offsetY })
        const hypotenuse = Math.sqrt(Math.pow(sx, 2) + Math.pow(sy, 2))
        const props = {
            x: this.rotate.x, y: this.rotate.y,
            vx: sx / hypotenuse, vy: sy / hypotenuse,
            angle: this.angle,
            speed: 5,
            level: this.level,
            boundary: this.boundary,
            gun: this,
            game: this.game,
            isCollided: false
        }
        this.bullet = render.push(Assets.images.bullet, new Bullet(props), 5)
        this.frame.index = 0
        this.playing = true
    }

    getAngle(center, point) {
        const pos = { x: point.x - center.x, y: Math.abs(point.y - center.y) }
        const angle = Math.atan2(pos.x, pos.y)
        this.angle = angle
        return pos
    }

    draw(ctx) {
        const { img, start, rotate, angle } = this
        const width = img.width, height = img.height / 5
        ctx.save()
        //this.getAngle(rotate)
        ctx.translate(rotate.x, rotate.y) //rotate center
        ctx.rotate(angle)
        ctx.translate(-rotate.x, -rotate.y)
        ctx.translate(start.x, start.y)
        ctx.drawImage(img, 0, 0 + height * this.frame.index, width, height, 0, 0, width, height)
        ctx.restore()
    }

    tick(render) {
        if (this.playing && ++this.timer.index > this.timer.interval) {
            this.timer.index = 0
            if (++this.frame.index == this.frame.max) {
                this.playing = false
                this.frame.index = 0
            }
        }

    }
}

class Bullet extends Item {
    static config = {
        1: { x: 86, y: 0, w: 25, h: 28 },
        2: { x: 61, y: 1, w: 25, h: 28 },
        3: { x: 32, y: 36, w: 27, h: 30 },
        4: { x: 30, y: 82, w: 29, h: 33 },
        5: { x: 30, y: 0, w: 31, h: 35 },
        6: { x: 0, y: 82, w: 30, h: 36 },
        7: { x: 0, y: 45, w: 32, h: 37 },
    }

    get collision() {
        const type = Bullet.config[this.level]
        return new Collision({ x: this.x, y: this.y, w: type.w, h: type.h, angle: this.angle * 180 / Math.PI })
    }

    deadProxy() {
        if (this.gun.bullet == this)
            this.gun.bullet = null
    }

    draw(ctx) {
        const img = Assets.images[`bullet`], type = Bullet.config[this.level]
        //draw bullet
        ctx.save()
        ctx.translate(this.x, this.y)
        ctx.rotate(this.angle)
        ctx.drawImage(img,
            type.x, type.y, type.w, type.h,
            type.w / -2, type.h / -2, type.w, type.h)
        ctx.restore()
        //draw collision
        this.collision.draw(ctx, this.isCollided)
    }

    tick(render) {
        this.y -= this.vy * this.speed, this.x += this.vx * this.speed
        let flag = false
        const capture = (collision, callback = null, single = false) => {
            const fishGenerator = this.game.fishGenerator
            for (const fish of fishGenerator.sets) {
                if (collision.detect(fish.collision)) {
                    //if (collision.shape.isRectCollide(fish.collision.shape)) {
                    this.isCollided = true
                    if (fish.canBeCaptured(this.level)) {
                        //fish dying
                        fishGenerator.delete(fish)
                        fish.dying.state = true
                    }
                    this.dead = true
                    //create web
                    if (callback != null) callback()
                    if (single) break
                }
            }
        }

        //out of boundary
        for (const corner of this.collision.shape.getCorners()) {
            if (this.boundary.check(corner) && !flag) {
                this.isCollided = false
                //shot judgement
                capture(this.collision, () => {
                    //create web
                    const web = render.push(Assets.images.web, new Web({ x: this.x, y: this.y, level: this.level }), 3)
                    capture(web.collision)
                }, true)
                flag = true
                return true
            }
            else {
                this.dead = true
                return false
            }
        }
    }
}

class Web extends Item {
    static config = {
        1: { x: 332, y: 372, w: 88, h: 88 },
        2: { x: 13, y: 412, w: 110, h: 110 },
        3: { x: 176, y: 367, w: 130, h: 130 },
        4: { x: 252, y: 194, w: 150, h: 150 },
        5: { x: 0, y: 244, w: 163, h: 155 },
        6: { x: 242, y: 0, w: 180, h: 180 },
        7: { x: 21, y: 22, w: 200, h: 200 },
    }

    init() {
        const size = Web.config[this.level]
        this.collision = new Collision({ x: this.x, y: this.y, radius: Math.max(size.w, size.h) / 2, type: Collision.type.circle, color: 'pink' })
        this.tween = new TWEEN.Tween({ rw: .8, rh: .8 }).to({ rw: 1, rh: 1 }, 120).yoyo(true).repeat(1)
            .easing(TWEEN.Easing.Linear.None).onUpdate(
                function (object) {
                    this.rw = object.rw, this.rh = object.rh
                }.bind(this)
            ).onComplete(
                function (object) {
                    this.dead = true
                }.bind(this)
            ).start()
        //this.tween.start()
    }

    draw(ctx) {
        const img = Assets.images[`web`], type = Web.config[this.level]
        //draw bullet
        ctx.save()
        ctx.translate(this.x, this.y)
        ctx.drawImage(img,
            type.x, type.y, type.w, type.h,
            type.w * this.rw / -2, type.h * this.rh / -2, type.w * this.rw, type.h * this.rh)
        ctx.restore()
        this.collision.draw(ctx)
    }
}

class Fish extends Item {
    static sets = new Set()
    static config = {
        1: {
            size: { w: 55, h: 37 }, collision: { x: 0, y: -7, w: 55, h: 26 },
            captureRate: .55, price: 1
        },
        2: {
            size: { w: 78, h: 64 }, collision: { x: 0, y: -12, w: 78, h: 35 },
            captureRate: .5, price: 2
        },
        3: {
            size: { w: 72, h: 56 }, collision: { x: 0, y: -12, w: 82, h: 32 },
            captureRate: .45, price: 5
        },
        4: {
            size: { w: 77, h: 59 }, collision: { x: 0, y: -12, w: 77, h: 34 },
            captureRate: .4, price: 10
        },
        5: {
            size: { w: 107, h: 122 }, collision: { x: 4, y: - 7, w: 91, h: 72 },
            captureRate: .35, price: 20
        },
    }

    get collision() {
        const type = Fish.config[this.level],
            size = type.size, edge = type.collision,
            collision = new Collision({ x: this.x, y: this.y, w: size.w, h: size.h, theta: this.angle }),
            rect = collision.shape
        let [RX, RY] = rect.getAxis()
        RX = RX.direction.Multiply(edge.x), RY = RY.direction.Multiply(edge.y)
        rect.center = rect.center.Add(RX).Add(RY)
        rect.size.x = edge.w, rect.size.y = edge.h
        return collision
    }

    init() {
        this.timer = { last: null, interval: 10, index: 0 }
        this.frame = { index: 0, max: 7 }
        this.dying = {
            state: false,
            interval: 60, index: 0
        }
    }

    canBeCaptured(level) {
        return Fish.config[this.level].captureRate * (1 + level * 0.05) > this.game.fishGenerator.rand.gen()
    };

    draw(ctx) {
        const img = Assets.images[`fish${this.level}`], type = Fish.config[this.level], size = type.size
        ctx.save()
        ctx.translate(this.x, this.y)
        ctx.rotate(this.angle)
        ctx.drawImage(img,
            0, 0 + size.h * this.frame.index, size.w, size.h,
            size.w / -2, size.h / -2, size.w, size.h)
        ctx.restore()
        this.collision.draw(ctx)
    }

    tick(render) {
        //console.log('is dying', this.dying.state)
        //switch spirit frame
        if (++this.timer.index > this.timer.interval) {
            this.timer.index = 0
            this.frame.index++
            this.frame.index &= 3
            if (this.dying.state) this.frame.index += 4
        }
        if (this.dying.state) {
            if (this.dying.index++ == this.dying.interval) {
                this.dead = true
                //create coin
                render.push(Assets.images.coinAni1,
                    new Coin({
                        x: this.x, y: this.y,
                        sx: this.boundary.cx + 100, sy: this.boundary.fy - 50,
                        level: Fish.config[this.level].price < 15 ? 1 : 2
                    }), 7)
                render.push(Assets.images.coinAni1,
                    new CoinText({
                        x: this.x, y: this.y,
                        sx: this.x, sy: this.y - 50,
                        num: Fish.config[this.level].price,
                        level: 1,
                        game: this.game
                    }), 7)
            }
            return
        }
        //update moving position
        this.y += this.vy * this.speed
        this.x += this.vx * this.speed
        //out of boundary
        const size = Fish.config[this.level].size,
            corners = new Rect({ x: this.x, y: this.y, w: size.w, h: size.h, theta: this.angle }).getCorners()
        for (const corner of corners) {
            if (this.boundary.check(corner)) return
        }
        this.dead = true
        //  console.log('dead')
        return
    }
}



class Coin extends Item {
    init() {
        this.type = { x: 0, y: 0, w: 60, h: 60 }
        this.timer = {
            interval: 4, index: 0, time: 100
        }
        this.frame = {
            index: 0, max: 10
        }
        this.tween = new TWEEN.Tween({ x: this.x, y: this.y }).to({ x: this.sx, y: this.sy }, 700)
            .easing(TWEEN.Easing.Linear.None).onUpdate(
                function (object) {
                    this.x = object.x, this.y = object.y
                }.bind(this)
            ).onComplete(
                function (object) {
                    this.dead = true
                }.bind(this)
            ).start()
    }

    draw(ctx) {
        const img = Assets.images[`coinAni${this.level}`], type = this.type
        ctx.save()
        ctx.translate(this.x, this.y)
        ctx.drawImage(img,
            type.x, type.y + type.h * this.frame.index, type.w, type.h,
            type.w / -2, type.h / -2, type.w, type.h)
        ctx.restore()
    }

    tick(render) {
        if (++this.timer.index > this.timer.interval) {
            this.timer.index = 0
            this.frame.index++
            this.frame.index %= this.frame.max
        }
    }
}

class CoinText extends Item {
    init() {
        this.type = { x: 0, y: 0, w: 36, h: 49 }
        this.tween = new TWEEN.Tween({ x: this.x, y: this.y }).to({ x: this.sx, y: this.sy }, 500)
            .easing(TWEEN.Easing.Linear.None).onUpdate(
                function (object) {
                    this.x = object.x, this.y = object.y
                }.bind(this)
            ).onComplete(
                function (object) {
                    this.dead = true
                    this.game.data.score += this.num
                }.bind(this)
            ).start()
    }

    draw(ctx) {
        const img = Assets.images[`coinText`], type = this.type
        ctx.save()
        //draw X
        ctx.translate(this.x, this.y)
        ctx.drawImage(img,
            type.x + type.w * 10, type.y, type.w, type.h,
            type.w / -2, type.h / -2, type.w, type.h)
        const num = [...this.num.toString()]
        num.forEach(val => {
            ctx.translate(type.w, 0)
            ctx.drawImage(img,
                type.x + type.w * parseInt(val), type.y, type.w, type.h,
                type.w / -2, type.h / -2, type.w, type.h)
        })
        ctx.restore()
    }
}

class Bar extends Item {
    init() {
        this.gunButton = { pos: { x: 360, y: 0 }, cut: { x: 0, y: 75 }, data: { w: 36, h: 28 }, divide: 4 }
        this.text = { img: Assets.images.number_black, type: { x: 0, y: 0, w: 20, h: 24 } }
    }

    draw(ctx) {
        const width = this.img.width, height = 72
        const gunButton = this.gunButton
        ctx.save()
        ctx.translate(ctx.width / 2 - this.img.width / 2, ctx.height - height)
        ctx.drawImage(this.img, 0, 0, width, height, 0, 0, this.img.width, height)
        ctx.restore()

        ctx.save()
        ctx.translate(gunButton.pos.x, ctx.height - gunButton.data.h)
        const delta = (gunButton.divide.w - gunButton.data.w) / 2
        //draw plus button
        ctx.drawImage(this.img,
            gunButton.cut.x + 1 * (gunButton.data.w + gunButton.divide * 2) + gunButton.divide, gunButton.cut.y,
            gunButton.data.w, gunButton.data.h,
            gunButton.divide, 0, gunButton.data.w, gunButton.data.h)
        //draw sub button
        ctx.drawImage(this.img,
            gunButton.cut.x + 3 * (gunButton.data.w + gunButton.divide * 2) + gunButton.divide, gunButton.cut.y,
            gunButton.data.w, gunButton.data.h,
            130 + gunButton.divide, 0, gunButton.data.w, gunButton.data.h)
        ctx.restore()
        //draw click area
        ctx.save()
        ctx.strokeStyle = 'white'
        for (let click of this.mouse.click)
            ctx.stroke(click.area)
        ctx.restore()
        //draw score text
        const num = [...this.game.data.score.toString()]
        const text_space = [20, 43, 65, 87, 111, 135]
        num.forEach((val, index) => {
            ctx.save()
            ctx.translate(ctx.width / 2 - this.img.width / 2 + 10, ctx.height - this.text.type.h + 8)
            ctx.translate(text_space[index + 6 - num.length], 0)
            ctx.drawImage(this.text.img,
                this.text.type.x, this.text.type.y + this.text.type.h * parseInt(9 - val), this.text.type.w, this.text.type.h,
                this.text.type.w / -2, this.text.type.h / -2, this.text.type.w, this.text.type.h)
            ctx.restore()
        })
    }

    add(inc, event) {
        const gun = this.gun
        if (inc) {
            if (gun.level < 7) gun.level++;
        }
        else {
            if (gun.level > 1) gun.level--;
        }
    }
}