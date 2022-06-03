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
    constructor(props) {
        this.rect = new Rect({ ...props })
    }

    detect(target) {
        const isColliding = this.rect.isRectCollide(target.rect)
        return isColliding
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
            speed: 4,
            level: this.level,
            boundary: this.boundary,
            gun: this,
            game: this.game,
            isCollided: false
        }
        this.bullet = render.push(Assets.images.bullet, new Bullet(props), 5)
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
        ctx.drawImage(img, 0, 0, width, height, 0, 0, width, height)
        ctx.restore()
    }
}

class Bullet extends Item {
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
        this.collision.rect.draw(ctx, this.isCollided)
    }

    tick(render) {
        this.y -= this.vy * this.speed
        this.x += this.vx * this.speed
        //out of boundary
        for (const corner of this.collision.rect.getCorners()) {
            if (this.boundary.check(corner)) {
                const fishGenerator = this.game.fishGenerator
                this.isCollided = false
                //shot judgement
                for (const fish of fishGenerator.sets) {
                    if (this.collision.rect.isRectCollide(fish.collision.rect)) {
                        this.isCollided = true
                        //break
                        console.log('true')
                        //fish dying
                        fishGenerator.delete(fish)
                        fish.dying.state = this.dead = true
                        //create web
                        render.push(Assets.images.web, new Web({ x: this.x, y: this.y, level: this.level }), 3)
                        break
                    }
                }
                return true
            }
        }
        console.log('bullet dead')
        this.dead = true
        return false
    }
}

Bullet.config = {
    1: { x: 86, y: 0, w: 25, h: 28 },
    2: { x: 61, y: 1, w: 25, h: 28 },
    3: { x: 32, y: 36, w: 27, h: 30 },
    4: { x: 30, y: 82, w: 29, h: 33 },
    5: { x: 30, y: 0, w: 31, h: 35 },
    6: { x: 0, y: 82, w: 30, h: 36 },
    7: { x: 0, y: 45, w: 32, h: 37 },
}

class Web extends Item {
    init() {
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
    }
}

Web.config = {
    1: { x: 332, y: 372, w: 88, h: 88 },
    2: { x: 13, y: 412, w: 110, h: 110 },
    3: { x: 176, y: 367, w: 130, h: 130 },
    4: { x: 252, y: 194, w: 150, h: 150 },
    5: { x: 0, y: 244, w: 163, h: 155 },
    6: { x: 242, y: 0, w: 180, h: 180 },
    7: { x: 21, y: 22, w: 200, h: 200 },
}

class Fish extends Item {
    get collision() {
        const type = Fish.config[this.level]
        return new Collision({ x: this.x, y: this.y, w: type.w, h: type.h, angle: this.angle * 180 / Math.PI })
    }

    init() {
        this.timer = {
            last: null, interval: 10, count: 0
        }
        this.frame = {
            count: 0, max: 7
        }
        this.dying = {
            state: false,
            interval: 60, count: 0
        }
    }

    draw(ctx) {
        const img = Assets.images[`fish${this.level}`]
        const type = Fish.config[this.level]
        ctx.save()
        ctx.translate(this.x, this.y)
        ctx.rotate(this.angle)
        //console.log()
        ctx.drawImage(img,
            type.x, type.y + type.h * this.frame.count, type.w, type.h,
            type.w / -2, type.h / -2, type.w, type.h)
        ctx.restore()
        this.collision.rect.draw(ctx)
    }

    tick(render) {
        //console.log('is dying', this.dying.state)
        //switch spirit frame
        if (++this.timer.count > this.timer.interval) {
            this.timer.count = 0
            this.frame.count++
            this.frame.count &= 3
            if (this.dying.state) this.frame.count += 4
        }
        if (this.dying.state) {
            if (this.dying.count++ == this.dying.interval) {
                this.dead = true
                //create coin
                render.push(Assets.images.coinAni1,
                    new Coin({
                        x: this.x, y: this.y,
                        sx: this.boundary.cx + 100, sy: this.boundary.fy - 50,
                        level: 1
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
        for (const corner of this.collision.rect.getCorners()) {
            if (this.boundary.check(corner)) return
        }
        this.dead = true
        //console.log('dead')
        return
    }
}

Fish.sets = new Set()
Fish.config = {
    1: { x: 0, y: 0, w: 55, h: 37, price: 1 },
    2: { x: 0, y: 0, w: 78, h: 64, price: 2 },
    3: { x: 0, y: 0, w: 72, h: 56, price: 5 },
    4: { x: 0, y: 0, w: 77, h: 59, price: 10 },
    5: { x: 0, y: 0, w: 107, h: 122, price: 20 },
}

class Coin extends Item {
    init() {
        this.type = { x: 0, y: 0, w: 60, h: 60 }
        this.timer = {
            interval: 4, count: 0, time: 100
        }
        this.frame = {
            count: 0, max: 10
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
            type.x, type.y + type.h * this.frame.count, type.w, type.h,
            type.w / -2, type.h / -2, type.w, type.h)
        ctx.restore()
    }

    tick(render) {
        if (++this.timer.count > this.timer.interval) {
            this.timer.count = 0
            this.frame.count++
            this.frame.count %= this.frame.max
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