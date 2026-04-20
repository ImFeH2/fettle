import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  PrimitiveHoveredItem,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts'

type CanvasRenderingTarget2D = Parameters<IPrimitivePaneRenderer['draw']>[0]

export type DrawingTool = 'select' | 'trendLine' | 'horizontalLine' | 'range'

export interface DrawingPoint {
  time: Time
  price: number
}

export interface TrendLineDrawing {
  id: string
  kind: 'trendLine'
  start: DrawingPoint
  end: DrawingPoint
}

export interface HorizontalLineDrawing {
  id: string
  kind: 'horizontalLine'
  price: number
}

export interface RangeDrawing {
  id: string
  kind: 'range'
  start: DrawingPoint
  end: DrawingPoint
}

export type ChartDrawing = TrendLineDrawing | HorizontalLineDrawing | RangeDrawing
export type DraftDrawing = TrendLineDrawing | RangeDrawing

interface TrendLineShape {
  id: string
  kind: 'trendLine'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  selected: boolean
  preview: boolean
}

interface HorizontalLineShape {
  id: string
  kind: 'horizontalLine'
  y: number
  color: string
  label: string
  selected: boolean
  preview: boolean
}

interface RangeShape {
  id: string
  kind: 'range'
  left: number
  right: number
  top: number
  bottom: number
  strokeColor: string
  fillColor: string
  selected: boolean
  preview: boolean
}

type RenderShape = TrendLineShape | HorizontalLineShape | RangeShape

const colors = {
  trendLine: '#2563eb',
  horizontalLine: '#f97316',
  rangeStroke: '#0f766e',
  rangeFill: 'rgba(15, 118, 110, 0.16)',
  selected: '#111827',
  handleFill: '#ffffff',
} as const

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function distanceToSegment(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const dx = x2 - x1
  const dy = y2 - y1

  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1)
  }

  const projection = clamp(
    ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy),
    0,
    1
  )

  const projectedX = x1 + projection * dx
  const projectedY = y1 + projection * dy

  return Math.hypot(x - projectedX, y - projectedY)
}

function normalizeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  return {
    left: Math.min(x1, x2),
    right: Math.max(x1, x2),
    top: Math.min(y1, y2),
    bottom: Math.max(y1, y2),
  }
}

function formatPriceLabel(value: number) {
  const absoluteValue = Math.abs(value)

  if (absoluteValue >= 1000) {
    return value.toFixed(2)
  }

  if (absoluteValue >= 1) {
    return value.toFixed(4)
  }

  return value.toFixed(6)
}

function createShape(
  params: SeriesAttachedParameter<Time>,
  drawing: ChartDrawing,
  selected: boolean,
  preview: boolean
): RenderShape | null {
  const timeScale = params.chart.timeScale()
  const series = params.series

  if (drawing.kind === 'horizontalLine') {
    const y = series.priceToCoordinate(drawing.price)

    if (y === null) {
      return null
    }

    return {
      id: drawing.id,
      kind: drawing.kind,
      y,
      color: colors.horizontalLine,
      label: formatPriceLabel(drawing.price),
      selected,
      preview,
    }
  }

  const x1 = timeScale.timeToCoordinate(drawing.start.time)
  const y1 = series.priceToCoordinate(drawing.start.price)
  const x2 = timeScale.timeToCoordinate(drawing.end.time)
  const y2 = series.priceToCoordinate(drawing.end.price)

  if (x1 === null || y1 === null || x2 === null || y2 === null) {
    return null
  }

  if (drawing.kind === 'trendLine') {
    return {
      id: drawing.id,
      kind: drawing.kind,
      x1,
      y1,
      x2,
      y2,
      color: colors.trendLine,
      selected,
      preview,
    }
  }

  const bounds = normalizeRect(x1, y1, x2, y2)

  return {
    id: drawing.id,
    kind: drawing.kind,
    left: bounds.left,
    right: bounds.right,
    top: bounds.top,
    bottom: bounds.bottom,
    strokeColor: colors.rangeStroke,
    fillColor: colors.rangeFill,
    selected,
    preview,
  }
}

function drawHandle(context: CanvasRenderingContext2D, x: number, y: number, strokeColor: string) {
  context.save()
  context.beginPath()
  context.arc(x, y, 4, 0, Math.PI * 2)
  context.fillStyle = colors.handleFill
  context.strokeStyle = strokeColor
  context.lineWidth = 2
  context.fill()
  context.stroke()
  context.restore()
}

function drawTrendLine(context: CanvasRenderingContext2D, shape: TrendLineShape) {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = shape.selected ? colors.selected : shape.color
  context.lineWidth = shape.selected ? 2.5 : 2
  context.globalAlpha = shape.preview ? 0.78 : 1
  context.setLineDash(shape.preview ? [8, 6] : [])
  context.beginPath()
  context.moveTo(shape.x1, shape.y1)
  context.lineTo(shape.x2, shape.y2)
  context.stroke()

  if (shape.selected || shape.preview) {
    drawHandle(context, shape.x1, shape.y1, shape.selected ? colors.selected : shape.color)
    drawHandle(context, shape.x2, shape.y2, shape.selected ? colors.selected : shape.color)
  }

  context.restore()
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

function drawHorizontalLine(
  context: CanvasRenderingContext2D,
  shape: HorizontalLineShape,
  width: number,
  height: number
) {
  context.save()
  context.strokeStyle = shape.selected ? colors.selected : shape.color
  context.lineWidth = shape.selected ? 2.5 : 1.8
  context.setLineDash([8, 6])
  context.beginPath()
  context.moveTo(0, shape.y)
  context.lineTo(width, shape.y)
  context.stroke()
  context.setLineDash([])

  context.font = '600 11px ui-sans-serif, system-ui, sans-serif'
  const textMetrics = context.measureText(shape.label)
  const labelWidth = textMetrics.width + 16
  const labelHeight = 22
  const labelX = Math.max(12, width - labelWidth - 12)
  const labelY = clamp(shape.y - labelHeight - 8, 12, Math.max(12, height - labelHeight - 12))

  drawRoundedRect(context, labelX, labelY, labelWidth, labelHeight, 999)
  context.fillStyle = shape.selected ? colors.selected : '#ffffff'
  context.strokeStyle = shape.selected ? colors.selected : shape.color
  context.lineWidth = 1.2
  context.fill()
  context.stroke()

  context.fillStyle = shape.selected ? '#ffffff' : shape.color
  context.textBaseline = 'middle'
  context.fillText(shape.label, labelX + 8, labelY + labelHeight / 2)
  context.restore()
}

function drawRange(context: CanvasRenderingContext2D, shape: RangeShape) {
  const width = Math.max(1, shape.right - shape.left)
  const height = Math.max(1, shape.bottom - shape.top)

  context.save()
  context.globalAlpha = shape.preview ? 0.75 : 1
  context.fillStyle = shape.selected ? 'rgba(17, 24, 39, 0.10)' : shape.fillColor
  context.strokeStyle = shape.selected ? colors.selected : shape.strokeColor
  context.lineWidth = shape.selected ? 2.5 : 1.8
  context.setLineDash(shape.preview ? [8, 6] : [])
  context.beginPath()
  context.rect(shape.left, shape.top, width, height)
  context.fill()
  context.stroke()

  if (shape.selected || shape.preview) {
    const strokeColor = shape.selected ? colors.selected : shape.strokeColor
    drawHandle(context, shape.left, shape.top, strokeColor)
    drawHandle(context, shape.right, shape.top, strokeColor)
    drawHandle(context, shape.left, shape.bottom, strokeColor)
    drawHandle(context, shape.right, shape.bottom, strokeColor)
  }

  context.restore()
}

class DrawingRenderer implements IPrimitivePaneRenderer {
  private readonly shapes: readonly RenderShape[]

  constructor(shapes: readonly RenderShape[]) {
    this.shapes = shapes
  }

  draw(target: CanvasRenderingTarget2D) {
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save()

      this.shapes.forEach((shape) => {
        if (shape.kind === 'trendLine') {
          drawTrendLine(context, shape)
          return
        }

        if (shape.kind === 'horizontalLine') {
          drawHorizontalLine(context, shape, mediaSize.width, mediaSize.height)
          return
        }

        drawRange(context, shape)
      })

      context.restore()
    })
  }
}

class DrawingPaneView implements IPrimitivePaneView {
  private readonly primitive: ChartDrawingPrimitive

  constructor(primitive: ChartDrawingPrimitive) {
    this.primitive = primitive
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'top'
  }

  renderer() {
    const shapes = this.primitive.getRenderableShapes()

    if (shapes.length === 0) {
      return null
    }

    return new DrawingRenderer(shapes)
  }
}

export class ChartDrawingPrimitive implements ISeriesPrimitive<Time> {
  private readonly paneViewsArray: readonly IPrimitivePaneView[]
  private attachedParams: SeriesAttachedParameter<Time> | null = null
  private drawings: ChartDrawing[] = []
  private selectedDrawingId: string | null = null
  private draftDrawing: DraftDrawing | null = null

  constructor() {
    this.paneViewsArray = [new DrawingPaneView(this)]
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.attachedParams = param
  }

  detached() {
    this.attachedParams = null
  }

  paneViews() {
    return this.paneViewsArray
  }

  setState(
    drawings: ChartDrawing[],
    selectedDrawingId: string | null,
    draftDrawing: DraftDrawing | null
  ) {
    this.drawings = drawings
    this.selectedDrawingId = selectedDrawingId
    this.draftDrawing = draftDrawing
    this.attachedParams?.requestUpdate()
  }

  getRenderableShapes() {
    const attachedParams = this.attachedParams

    if (!attachedParams) {
      return []
    }

    const unselectedShapes = this.drawings
      .filter((drawing) => drawing.id !== this.selectedDrawingId)
      .map((drawing) => createShape(attachedParams, drawing, false, false))
      .filter((shape): shape is RenderShape => shape !== null)

    const selectedShapes = this.drawings
      .filter((drawing) => drawing.id === this.selectedDrawingId)
      .map((drawing) => createShape(attachedParams, drawing, true, false))
      .filter((shape): shape is RenderShape => shape !== null)

    const draftShape = this.draftDrawing
      ? createShape(attachedParams, this.draftDrawing, false, true)
      : null

    return draftShape
      ? [...unselectedShapes, ...selectedShapes, draftShape]
      : [...unselectedShapes, ...selectedShapes]
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const shapes = this.getRenderableShapes()
    const tolerance = 8

    for (let index = shapes.length - 1; index >= 0; index -= 1) {
      const shape = shapes[index]

      if (shape.preview) {
        continue
      }

      if (shape.kind === 'trendLine') {
        if (distanceToSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2) <= tolerance) {
          return {
            externalId: shape.id,
            cursorStyle: 'pointer',
            zOrder: 'top',
          }
        }
        continue
      }

      if (shape.kind === 'horizontalLine') {
        if (Math.abs(y - shape.y) <= tolerance) {
          return {
            externalId: shape.id,
            cursorStyle: 'pointer',
            zOrder: 'top',
          }
        }
        continue
      }

      const insideBounds =
        x >= shape.left - tolerance
        && x <= shape.right + tolerance
        && y >= shape.top - tolerance
        && y <= shape.bottom + tolerance

      const nearBorder =
        Math.abs(x - shape.left) <= tolerance
        || Math.abs(x - shape.right) <= tolerance
        || Math.abs(y - shape.top) <= tolerance
        || Math.abs(y - shape.bottom) <= tolerance

      if (insideBounds && (nearBorder || (x >= shape.left && x <= shape.right && y >= shape.top && y <= shape.bottom))) {
        return {
          externalId: shape.id,
          cursorStyle: 'pointer',
          zOrder: 'top',
        }
      }
    }

    return null
  }
}

export function createDrawingId(tool: Exclude<DrawingTool, 'select'>) {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `drawing:${tool}:${randomPart}`
}

export function getDrawingLabel(tool: Exclude<DrawingTool, 'select'>) {
  switch (tool) {
    case 'trendLine':
      return 'Trend Line'
    case 'horizontalLine':
      return 'Horizontal Line'
    case 'range':
      return 'Range Box'
  }
}
