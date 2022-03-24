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
    <canvas
      id="board"
      class="canvas"
      :width="data.clientWidth"
      :height="data.clientHeight"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    />
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
  draw(context: CanvasRenderingContext2D, numOfRowTiles: number, numOfColTiles: number) {
    const x = Math.floor(Math.pow(2, data.zoom) * xr.value)
    const y = Math.floor(Math.pow(2, data.zoom) * yr.value)
    const px = Math.floor(this.tileSize * Math.pow(2, data.zoom) * xr.value) % this.tileSize
    const py = Math.floor(this.tileSize * Math.pow(2, data.zoom) * yr.value) % this.tileSize
    for (let i = -Math.floor(numOfRowTiles / 2 + 1); i < Math.floor(numOfRowTiles / 2 + 2); i++) {
      for (let j = -Math.floor(numOfColTiles / 2 + 1); j < Math.floor(numOfColTiles / 2 + 2); j++) {
        this.getTileAt(data.zoom, x + i, y + j)
          .then(chara => context.drawImage(
            chara,
            this.tileSize * i - px + data.clientWidth / 2,
            this.tileSize * j - py + data.clientHeight / 2
          ))
      }
    }
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
  clientWidth: 256 * 3,
  clientHeight: 256 * 2,
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

/** ドラッグ中のマウスイベントオブジェクト */
let dragged: any = undefined

onMounted(() => {
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
    tileSet.draw(context!, numOfRowTiles.value, numOfColTiles.value)
  })
})

const drawMap = () => {
  tileSet.draw(context!, numOfRowTiles.value, numOfColTiles.value)
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
  tileSet.draw(context!, numOfRowTiles.value, numOfColTiles.value)
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