<template>
  <div>
    <div>
      <p class="paramRow">
        <label for="zoomLevel" class="label paramRow__label">ズームレベル:</label>
        <input
          id="zoomLevel"
          class="input paramRow__input"
          type="number"
          v-model="data.zoom"
          @input="drawMap"
        />
      </p>
      <p class="paramRow">
        <label for="latitude" class="label paramRow__label">緯度:</label>
        <input
          id="latitude"
          class="input paramRow__input"
          type="number"
          v-model="data.latitude"
          @input="drawMap"
        />
      </p>
      <p class="paramRow">
        <label for="longitude" class="label paramRow__label">経度:</label>
        <input
          id="longitude"
          class="input paramRow__input"
          type="number"
          v-model="data.longitude"
          @input="drawMap"
        />
      </p>
    </div>
    <div
      style="position: relative;"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    >
      <canvas
        id="board"
        style="position: absolute; left: 50%; transform: translate(-50%, 0);"
        class="canvas"
        :width="data.clientWidth"
        :height="data.clientHeight"
      />
      <canvas
        id="board2"
        style="position: absolute; left: 50%; transform: translate(-50%, 0);"
        :width="data.clientWidth"
        :height="data.clientHeight"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { UnwrapNestedRefs, onMounted, computed, reactive } from 'vue'

/**
 * 地図タイルの取得・表示を行う.
 */
class TileSet {
  constructor(
    public name: string,
    public url: string,
    public tileSize: number,
    public zoomRange: { min: number, max: number }
  ) {
  }

  private cachedTiles: Map<string, HTMLImageElement> = new Map()

  /**
   * 指定されたキャンバスのコンテキストに地図タイルを描画する.
   * @param context 
   */
  draw(context: CanvasRenderingContext2D, numOfRowTiles: number, numOfColTiles: number, ctx2: CanvasRenderingContext2D) {
    const tileCoord = this.toTileCoordinate(
      this.tileSize,
      data.zoom,
      data.longitude,
      data.latitude
    )
    const drawRange = {
      halfNumOfRowTiles: Math.floor((numOfRowTiles + 1) / 2),
      halfNumOfColTIles: Math.floor((numOfColTiles + 1) / 2),
    }
    const offsets = {
      x: -tileCoord.px + data.clientWidth / 2,
      y: -tileCoord.py + data.clientHeight / 2,
    }
    for (let i = -drawRange.halfNumOfRowTiles; i <= drawRange.halfNumOfRowTiles; i++) {
      for (let j = -drawRange.halfNumOfColTIles; j <= drawRange.halfNumOfColTIles; j++) {
        this.getTileAt(data.zoom, tileCoord.x + i, tileCoord.y + j)
          .then(chara => context.drawImage(
            chara,
            this.tileSize * i + offsets.x,
            this.tileSize * j + offsets.y
          ))
      }
    }

    const coord1 = {
      lon: 139.5146546,
      lat: 35.4238236,
    }
    const tilecoord1 = this.toTileCoordinate(this.tileSize, data.zoom, coord1.lon, coord1.lat)
    const diffs = {
      x: tilecoord1.x - tileCoord.x,
      y: tilecoord1.y - tileCoord.y,
    }

    ctx2.clearRect(0, 0, data.clientWidth, data.clientHeight)
    ctx2.beginPath()
    ctx2.moveTo(0, data.clientHeight / 2)
    ctx2.lineTo(data.clientWidth, data.clientHeight / 2)
    ctx2.moveTo(data.clientWidth / 2, 0)
    ctx2.lineTo(data.clientWidth / 2, data.clientHeight)
    ctx2.stroke()
    if (Math.abs(tilecoord1.x - tileCoord.x) <= drawRange.halfNumOfRowTiles && Math.abs(tilecoord1.y - tileCoord.y) <= drawRange.halfNumOfColTIles) {
      ctx2.beginPath()
      ctx2.arc(
        this.tileSize * (tilecoord1.x - tileCoord.x) + tilecoord1.px - tileCoord.px + data.clientWidth / 2,
        this.tileSize * (tilecoord1.y - tileCoord.y) + tilecoord1.py - tileCoord.py + data.clientHeight / 2,
        5,
        0,
        Math.PI * 2,
        true
      )
      ctx2.stroke()
    }
  }

  toTileCoordinate(tileSize: number, zoom: number, longitude: number, latitude: number) {
    const xr = (180 + longitude) / 360
    const yr = 0.5 - 0.5 * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) / Math.PI
    const x = Math.floor(Math.pow(2, zoom) * xr)
    const y = Math.floor(Math.pow(2, zoom) * yr)
    const px = Math.floor(tileSize * Math.pow(2, zoom) * xr) % tileSize
    const py = Math.floor(tileSize * Math.pow(2, zoom) * yr) % tileSize
    const xp = tileSize * Math.pow(2, zoom) * xr
    const yp = tileSize * Math.pow(2, zoom) * yr
    return { x, y, px, py, xp, yp }
  }

  /**
   * タイル画像を取得する.
   * 取得した画像はキャッシュに保持しておく.
   */
  private getTileAt(z: number, x: number, y: number): Promise<HTMLImageElement> {
    const key = this.toKey(z, x, y)
    const value = this.cachedTiles.get(key)
    if (!!value) {
      return new Promise(r => r(value))
    }
    const image = new Image();
    image.src = this.formatString(this.url, { z: z, x: x, y: y })
    this.cachedTiles.set(key, image)
    return new Promise(r => {
      image.onload = () => {
        r(image)
      }
    })
  }

  private toKey(z: number, x: number, y: number) {
    return `${z}-${x}-${y}`
  }

  /**
   * String.format() ライクな関数.
   * 例:
   *  assert(
   *    this.format("hello, {who}.", { who: "world" }),
   *    "hello, world."
   *  )
   */
  private formatString(str: string, params: any) {
    let result = str;
    for (let key in params) {
      result = result.replace("{" + key + "}", params[key]);
    }
    return result;
  }
}

/**
 * data
 */
const data: UnwrapNestedRefs<{
  zoom: number,
  longitude: number,
  latitude: number,
  clientWidth: number,
  clientHeight: number,
}> = reactive({
  zoom: 13,
  longitude: 139.7673068,
  latitude: 35.6809591,
  clientWidth: 256 * 3.5,
  clientHeight: 256 * 1.5,
})

/** 世界地図上の位置.  */
const xr = computed(() => (180 + data.longitude) / 360)
const yr = computed(() => 0.5 - 0.5 * Math.log(Math.tan(Math.PI / 4 + data.latitude * Math.PI / 360)) / Math.PI)

/** 表示するタイル数.  */
const numOfRowTiles = computed(() => data.clientWidth / tileSet.tileSize)
const numOfColTiles = computed(() => data.clientHeight / tileSet.tileSize)

/** 表示対象のタイルAPI.  */
const tileSet = new TileSet(
  "国土地理院-標準",
  "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  256,
  { min: 5, max: 18 }
)

/** キャンバスのコンテキスト */
let context: undefined | CanvasRenderingContext2D = undefined
let ctx2: undefined | CanvasRenderingContext2D = undefined

/** ドラッグ中のマウスイベントオブジェクト */
let dragged: any = undefined

onMounted(() => {
  const board2 = <HTMLCanvasElement>document.querySelector("#board2")
  ctx2 = <CanvasRenderingContext2D>board2.getContext("2d")
  // ctx2.beginPath()
  // ctx2.moveTo(0, data.clientHeight / 2)
  // ctx2.lineTo(data.clientWidth, data.clientHeight / 2)
  // ctx2.moveTo(data.clientWidth / 2, 0)
  // ctx2.lineTo(data.clientWidth / 2, data.clientHeight)
  // ctx2.stroke()

  const board = <HTMLCanvasElement>document.querySelector("#board")
  context = <CanvasRenderingContext2D>board.getContext("2d")
  new Promise((resolve, reject) =>
    // クライアントのGPS座標を取得する.
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
    // クライアントのGPS座標が取得できればそれを、そうでなければデフォルトの座標を描画する.
    tileSet.draw(context!, numOfRowTiles.value, numOfColTiles.value, ctx2!)
  })
})

const drawMap = () => {
  tileSet.draw(context!, numOfRowTiles.value, numOfColTiles.value, ctx2!)
}

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
  data.longitude += 360 / tileSet.tileSize / Math.pow(2, data.zoom) * dx
  data.latitude += 360 / tileSet.tileSize / Math.pow(2, data.zoom) * dy * Math.cos(data.latitude * Math.PI / 180)
  tileSet.draw(context!, numOfRowTiles.value, numOfColTiles.value, ctx2!)
}

</script>

<style>
.paramRow {
  margin: 2px;
}

.paramRow__label {
  margin-right: 10px;
}
.paramRow__input {
  margin: 2px;
}

.label {
  display: inline-block;
  width: 150px;
  text-align: right;
}

.canvas {
  border: 1px solid;
}
</style>