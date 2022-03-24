<template>
  <input type="number" v-model="data.zoom" @input="drawImage" />
  <input type="number" v-model="data.longitude" @input="drawImage" />
  <input type="number" v-model="data.latitude" @input="drawImage" />
  <p>{{ centerX }}, {{ centerY }}</p>
  <button @click="translateImage(1, 0)">←</button>
  <button @click="translateImage(0, -1)">↑</button>
  <button @click="translateImage(0, 1)">↓</button>
  <button @click="translateImage(-1, 0)">→</button>
  <canvas
    id="board"
    :width="clientWidth"
    :height="clientHeight"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
  />
</template>

<script setup lang="ts">
import { UnwrapNestedRefs, onMounted, computed, ref, reactive } from 'vue'

/**
 * Promisenized setTimeout()
 */
async function delay(delayMillis: number) {
  return new Promise<void>(resolve => {
    setTimeout(() => resolve(), delayMillis)
  })
}

/**
 * String.format() function
 * e.g. "hello, {0}.".format("world");
 *      -> "hello, world."
 */
String.prototype.format = function () {
  let formatted = this;
  const args = arguments[0]
  for (let arg in args) {
    formatted = formatted.replace("{" + arg + "}", args[arg]);
  }
  return formatted;
}

class TileSet {
  private tiles: Map<string, HTMLImageElement> = new Map()

  /**
   * @param srcTemplate e.g. https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png
   */
  constructor(private srcTemplate: string, public tileSize: number) {
  }

  getTileAt(z: number, x: number, y: number): Promise<HTMLImageElement> {
    const key = this.toKey(z, x, y)
    const value = this.tiles.get(key)
    if (!!value) {
      return new Promise(r => r(value))
    }
    const chara = new Image();
    chara.src = this.srcTemplate.format({ z: z, x: x, y: y })
    this.tiles.set(key, chara)
    return new Promise(r => {
      chara.onload = () => {
        r(chara)
      }
    })
  }

  private toKey(z: number, x: number, y: number) {
    return `${z}-${x}-${y}`
  }
}

// defineProps<{ msg: string }>()

/**
 * data
 */
const data: UnwrapNestedRefs<{
  longitude: number,
  latitude: number,
  zoom: number,
  nx: number,
  ny: number,
  px: number,
  py: number,
  numOfRowTiles: number,
  numOfColTiles: number,
  tileSet: TileSet,
  ctx: undefined | CanvasRenderingContext2D,
  dragged: any,
}> = reactive({
  longitude: 139.7673068,
  latitude: 35.6809591,
  zoom: 13,
  nx: 0,
  ny: 0,
  px: 0,
  py: 0,
  numOfRowTiles: 6,
  numOfColTiles: 5,
  tileSet: new TileSet("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", 256),
  ctx: undefined,
  dragged: undefined,
})

/**
 * computed
 */
const centerX = computed(() => (180 + data.longitude) * Math.pow(2, data.zoom) / 360)
const centerY = computed(() => Math.pow(2, data.zoom - 1) * (1 - 1 / Math.PI * Math.log(Math.tan(Math.PI / 4 * (1 + data.latitude / 90)))))
const clientWidth = computed(() => data.tileSet.tileSize * data.numOfRowTiles)
const clientHeight = computed(() => data.tileSet.tileSize * data.numOfColTiles)

onMounted(() => {
  const board = <HTMLCanvasElement>document.querySelector("#board")
  data.ctx = <CanvasRenderingContext2D>board.getContext("2d")
  new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos),
      error => reject(error)
    )
  ).then(pos => {
    data.longitude = pos.coords.longitude
    data.latitude = pos.coords.latitude
  }).catch(error => {
    console.log(error)
  }).then(() => {
    drawImage()
  })
})

const drawImage = () => {
  data.nx = Math.floor(centerX.value)
  data.ny = Math.floor(centerY.value)
  data.px = (centerX.value - data.nx) * data.tileSet.tileSize
  data.py = (centerY.value - data.ny) * data.tileSet.tileSize
  for (let i = -Math.floor(data.numOfRowTiles / 2 + 1); i < Math.floor(data.numOfRowTiles / 2) + 2; i++) {
    for (let j = -Math.floor(data.numOfColTiles / 2 + 1); j < Math.floor(data.numOfColTiles / 2) + 2; j++) {
      data.tileSet
        .getTileAt(data.zoom, data.nx + i, data.ny + j)
        .then(chara => data.ctx?.drawImage(
          chara,
          data.tileSet.tileSize * i - data.px + clientWidth.value / 2,
          data.tileSet.tileSize * j - data.py + clientHeight.value / 2
        ))
    }
  }
}

let dragged: undefined | MouseEvent = undefined

const onMouseDown = (event: MouseEvent) => {
  dragged = event
}
const onMouseMove = (event: MouseEvent) => {
  if (!!dragged) {
    translateImage(dragged.x - event.x, - dragged.y + event.y)
    dragged = event
  }
}

const onMouseUp = (event: MouseEvent) => {
  dragged = undefined
}

const translateImage = (dx: number, dy: number) => {
  data.longitude += dx * 360 * Math.pow(2, -(data.zoom + 8))
  data.latitude += dy * 360 * Math.pow(2, -(data.zoom + 8)) * Math.cos(data.latitude * Math.PI / 180)
  drawImage()
}

</script>
