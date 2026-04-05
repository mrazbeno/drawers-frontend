"use client"

import getStroke, { StrokeOptions } from "perfect-freehand"
import * as React from "react";
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Brush, Pencil } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox";
import { BrushSettings } from "drawers-shared"
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HexColorPicker } from "react-colorful";

const paletteColorCodes = [
    "#000000",
    "#ffffff",
    "#FF0000",
    "#0000FF",
    "#FFFF00",
    "#00FF00",
    "#FFA500",
    "#800080",
    "#FFC0CB",
    "#8B4513",
    "#808080",
    "#00FFFF",
    "#FF00FF",
    "#BFFF00",
    "#000080",
]

export const SOFT_BRUSH_PRESET_STROKE: StrokeOptions = {
    size: 16,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,

    easing: (t) => t,
    start: {
        taper: 100,
        easing: (t) => t,
        cap: true
    },
    end: {
        taper: 100,
        easing: (t) => t,
        cap: true
    }
};

export const HARD_PENCIL_PRESET_STROKE: StrokeOptions = {
    size: 16,
    thinning: 0,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,

    easing: (t) => t,
    start: {
        taper: 0,
        easing: (t) => t,
        cap: true
    },
    end: {
        taper: 0,
        easing: (t) => t,
        cap: true
    }
};

function generateSPoints(
    numPoints = 200,
    width = 300,
    height = 300,
    xOffset = 0,
    yOffset = 0,
) {
    const points: number[][] = [];

    // Parametric S-curve
    function sCurve(t: number): [number, number] {
        const x = xOffset + t * width;
        const y = yOffset + height / 2 + Math.sin(t * Math.PI * 2) * height / 2;
        return [x, y];
    }

    const step = 1 / numPoints;

    for (let i = 0; i < 1; i += step)
        points.push(sCurve(i))

    return points
}

interface BrushSettingsPanelProps {
    brushSettings: BrushSettings;
    onBrushSettingsChange: (next: BrushSettings) => void;
}

export default function BrushSettingsPanel({ brushSettings, onBrushSettingsChange }: BrushSettingsPanelProps) {

    const previewCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

    const previewCtxRef = React.useRef<CanvasRenderingContext2D | null>(null);

    const [previewPoints, setPreviewPoints] = React.useState<number[][]>([])
    const [showStrokePts, setShowStrokePts] = React.useState<boolean>(false)

    function getSvgPathFromStroke(stroke: any) {
        if (!stroke.length) return ""

        const d = stroke.reduce(
            (acc: any, [x0, y0]: any, i: any, arr: any) => {
                const [x1, y1] = arr[(i + 1) % arr.length]
                acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
                return acc
            },
            ["M", ...stroke[0], "Q"]
        )

        d.push("Z")
        return d.join(" ")
    }

    function drawBrushPreview() {
        const prevCanv = previewCanvasRef.current
        const prevCtx = previewCtxRef.current

        if (!prevCanv || !prevCtx) return

        prevCtx.clearRect(0, 0, prevCanv.width, prevCanv.height)

        const stroke = getStroke(previewPoints, brushSettings.strokeOptions);
        const pathData = getSvgPathFromStroke(stroke);
        const path = new Path2D(pathData);

        prevCtx.fillStyle = brushSettings.brushColor;
        prevCtx.fill(path);

        if (!showStrokePts) return

        prevCtx.strokeStyle = "red"
        prevCtx.fillStyle = "black"
        for (const pt of previewPoints) {
            prevCtx.beginPath()
            prevCtx.arc(pt[0] ?? -100, pt[1] ?? -100, 2, 0, Math.PI * 2)
            prevCtx.closePath()
            prevCtx.fill()

            prevCtx.beginPath()
            prevCtx.arc(pt[0] ?? -100, pt[1] ?? -100, 2, 0, Math.PI * 2)
            prevCtx.stroke()
        }
    }

    React.useEffect(() => {
        drawBrushPreview()
    }, [previewPoints, brushSettings, showStrokePts])

    React.useEffect(() => {

        const previewCanvas = previewCanvasRef.current
        if (!previewCanvas) return;

        const previewCtx = previewCanvas.getContext("2d")!;

        previewCtxRef.current = previewCtx;

        const prevRect = previewCanvas.getBoundingClientRect()
        previewCanvas.width = prevRect.width
        previewCanvas.height = prevRect.height

        createPreviewPoints()

        loadBrushSettingsToUI()

        return () => { }
    }, [])

    function loadBrushSettingsToUI() {
        setThinning(brushSettings.strokeOptions.thinning ?? 0)
        setSmoothing(brushSettings.strokeOptions.smoothing ?? 0)
        setStreamline(brushSettings.strokeOptions.streamline ?? 0)
        setStartTaper(brushSettings.strokeOptions.start?.taper ?? 0)
        setEndTaper(brushSettings.strokeOptions.end?.taper ?? 0)
        setStartUseCap(brushSettings.strokeOptions.start?.cap ?? true)
        setEndUseCap(brushSettings.strokeOptions.end?.cap ?? true)
        setSimPressure(brushSettings.strokeOptions.simulatePressure ?? true)
        setBrushColor(brushSettings.brushColor ?? "#000")
        setBrushSize(brushSettings.strokeOptions.size ?? 1)
    }

    function createPreviewPoints() {
        const previewCanvas = previewCanvasRef.current
        if (!previewCanvas) return;
        const { width, height } = previewCanvas.getBoundingClientRect();

        const previewPoints = generateSPoints(
            30,
            width * 0.8,
            height * 0.8,
            width * 0.1,
            height * 0.1
        )

        setPreviewPoints(f => previewPoints)
    }

    const [thinning, setThinning] = React.useState<number>(0.5)
    const [smoothing, setSmoothing] = React.useState<number>(0.5)
    const [streamline, setStreamline] = React.useState<number>(0.5)
    const [startTaper, setStartTaper] = React.useState<number | boolean>(1)
    const [endTaper, setEndTaper] = React.useState<number | boolean>(1)
    const [startUseCap, setStartUseCap] = React.useState<boolean>(true)
    const [endUseCap, setEndUseCap] = React.useState<boolean>(true)
    const [simPressure, setSimPressure] = React.useState<boolean>(true)
    const [brushColor, setBrushColor] = React.useState<string>("#000000");
    const [brushSize, setBrushSize] = React.useState<number>(16)

    const sliderValue = Math.sqrt(brushSize)

    const handleSliderChange = (value: number[]) => {
        setBrushSize(Math.floor(Math.pow(value[0] ?? 0, 2)))
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Math.floor(+e.target.value)
        if (!isNaN(val) && val >= 1 && val <= MAX_BRUSH_SIZE) {
            setBrushSize(val)
        }
    }

    React.useEffect(() => {

        onBrushSettingsChange({
            ...brushSettings,
            strokeOptions: {
                ...brushSettings.strokeOptions,
                thinning,
                smoothing,
                streamline,
                size: brushSize,
                simulatePressure: simPressure,
                start: {
                    ...brushSettings.strokeOptions.start,
                    taper: startTaper,
                    cap: startUseCap,
                },
                end: {
                    ...brushSettings.strokeOptions.end,
                    taper: endTaper,
                    cap: endUseCap,
                },
            },
            brushColor,
        })
    }, [
        startTaper,
        endTaper,
        startUseCap,
        endUseCap,
        thinning,
        smoothing,
        streamline,
        brushSize,
        simPressure,
        brushColor
    ])

    const MAX_BRUSH_SIZE = 100

    const [isColorPickDialogOpen, setIsColorPickDialogOpen] = React.useState(false);

    function handleColorPick() {
        setBrushColor(color)
        setIsColorPickDialogOpen(false)
    }

    const [color, setColor] = React.useState("#aabbcc");

    function setPresetStrokeOptions(options: StrokeOptions) {
        const size = brushSettings.strokeOptions.size
        brushSettings.strokeOptions = options
        brushSettings.strokeOptions.size = size
        drawBrushPreview()
        loadBrushSettingsToUI()
    }

    return (
        <div className="flex w-full h-full grow select-none">
            <div className="flex w-full h-full flex-col gap-2">
                <h2 className="text-xl font-bold">Brush settings</h2>
                <div className="flex flex-col w-full">
                    <h3>Presets</h3>
                    <div className="flex flex-row w-full gap-2">
                        <Button className="grow basis-1" onClick={e => { setPresetStrokeOptions(HARD_PENCIL_PRESET_STROKE) }}><Pencil />Hard pencil</Button>
                        <Button className="grow basis-1" onClick={e => { setPresetStrokeOptions(SOFT_BRUSH_PRESET_STROKE) }}><Brush />Soft brush</Button>
                    </div>
                </div>
                <Separator />
                <div className="flex gap-2 flex-col">
                    <Label htmlFor="brush_size_input">Brush size</Label>
                    <Input min={1} max={MAX_BRUSH_SIZE} step={1} id="brush_size_input" value={brushSize} onChange={handleInputChange} type="number" />
                    <Slider min={1} max={Math.sqrt(MAX_BRUSH_SIZE)} step={0.1} value={[sliderValue]} onValueChange={handleSliderChange} />
                </div>
                <Separator />
                <div className="flex gap-2 flex-col">
                    <Label htmlFor="brush_size_input">Thinning</Label>
                    <Input min={0.0} max={1.0} step={0.02} id="brush_size_input" value={thinning} onChange={e => setThinning(+e.target.value)} type="number" />
                    <Slider min={0.0} max={1.0} step={0.02} value={[thinning]} onValueChange={(value) => setThinning(value[0] ?? 0)} />
                </div>
                <Separator />
                <div className="flex gap-2 flex-col">
                    <Label htmlFor="brush_size_input">Smoothing</Label>
                    <Input min={0.0} max={1.0} step={0.02} id="brush_size_input" value={smoothing} onChange={e => setSmoothing(+e.target.value)} type="number" />
                    <Slider min={0.0} max={1.0} step={0.02} value={[smoothing]} onValueChange={(value) => setSmoothing(value[0] ?? 0)} />
                </div>
                <Separator />
                <div className="flex gap-2 flex-col">
                    <Label htmlFor="brush_size_input">Streamline</Label>
                    <Input min={0.0} max={1.0} step={0.02} id="brush_size_input" value={streamline} onChange={e => setStreamline(+e.target.value)} type="number" />
                    <Slider min={0.0} max={1.0} step={0.02} value={[streamline]} onValueChange={(value) => setStreamline(value[0] ?? 0)} />
                </div>
                <Separator />
                <div className="flex flex-row  gap-2">
                    <Checkbox id="cb_sim_press" checked={simPressure} onCheckedChange={(checked) => { setSimPressure(checked == true) }} />
                    <Label htmlFor="cb_sim_press">Simulate pressure based on velocity</Label>
                </div>
                <Separator />
                <div className="flex gap-2 flex-row">
                    <div className="flex gap-2 grow flex-col">
                        <h2>Stroke start</h2>
                        <Label htmlFor="brush_size_input">Taper length</Label>
                        <Input min={0.0} max={100} step={1} id="brush_size_input" value={typeof startTaper == "boolean" ? 100 : startTaper} onChange={e => setStartTaper(+e.target.value == 100 ? true : +e.target.value)} type="number" />
                        <Slider min={0.0} max={100} step={1} value={[typeof startTaper == "boolean" ? 100 : startTaper]} onValueChange={(value) => setStartTaper((value[0] ?? 0) == 100 ? true : value[0] ?? 0)} />
                        <div className="flex flex-row gap-2" >
                            <Checkbox checked={startUseCap} onCheckedChange={(checked) => { setStartUseCap(checked == true) }} id="cb_use_start_line_cap" />
                            <Label htmlFor="cb_use_start_line_cap">Use line cap</Label>
                        </div>
                    </div>
                    <Separator orientation="vertical" />
                    <div className="flex gap-2 grow flex-col">
                        <h2>Stroke end</h2>
                        <Label htmlFor="brush_size_input">Taper length</Label>
                        <Input min={0.0} max={100} step={1} id="brush_size_input" value={typeof endTaper == "boolean" ? 100 : endTaper} onChange={e => setEndTaper(+e.target.value == 100 ? true : +e.target.value)} type="number" />
                        <Slider min={0.0} max={100} step={1} value={[typeof endTaper == "boolean" ? 100 : endTaper]} onValueChange={(value) => setEndTaper((value[0] ?? 0) == 100 ? true : value[0] ?? 0)} />
                        <div className="flex flex-row gap-2">
                            <Checkbox checked={endUseCap} onCheckedChange={(checked) => { setEndUseCap(checked == true) }} id="cb_use_end_line_cap" />
                            <Label htmlFor="cb_use_end_line_cap">Use line cap</Label>
                        </div>
                    </div>
                </div>

                <div className="w-full flex justify-between items-end">

                    <h2 className="text-xl font-bold inline">Brush preview</h2>
                </div>
                <div className="flex w-full
                grow
                    rounded-sm
                    bg-[#ccc]
                    [background-image:linear-gradient(45deg,#999_25%,transparent_25%),linear-gradient(-45deg,#999_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#999_75%),linear-gradient(-45deg,transparent_75%,#999_75%)]
                    [background-size:20px_20px]
                    [background-position:0_0,0_10px,10px_-10px,-10px_0]
                ">
                    <canvas className="w-full" ref={previewCanvasRef}></canvas>
                </div>
                <div className="flex gap-2 flex-col">
                    <div className="flex flex-row grow gap-2">
                        <Checkbox id="cb_show_stroke_pts" checked={showStrokePts} onCheckedChange={(checked) => { setShowStrokePts(checked == true) }} />
                        <Label htmlFor="cb_show_stroke_pts">Show stroke points</Label>
                    </div>
                    <div className="grid grid-cols-8 grid-rows-2 gap-2 w-full grow ">

                        {paletteColorCodes.map((c, i) => (
                            <div key={i} style={{ backgroundColor: c }} onClick={e => { setBrushColor(c) }} 
                            className="rounded-sm cursor-pointer h-5">

                            </div>
                        ))}

                        {/* Username Dialog */}
                        <Dialog open={isColorPickDialogOpen} onOpenChange={setIsColorPickDialogOpen}>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl">Pick a color</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 pt-4 flex flex-col">
                                    <div className="flex gap-2">
                                        <div className="space-y-2">
                                            <HexColorPicker color={color} onChange={setColor} />
                                        </div>
                                        <div style={{ backgroundColor: color }}
                                            className="grow rounded-lg border-solid border-2 border-black">
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleColorPick}
                                        className="w-full h-12 text-lg"
                                        variant="default"
                                    >
                                        Set new color
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <button
                            style={{ background: "linear-gradient(in hsl longer hue 90deg, red 0 100%)" }}
                            className="rounded-sm cursor-pointer h-5"
                            onClick={e => { setIsColorPickDialogOpen(true) }}/>
                        
                    </div>
                </div>
            </div>
        </div>
    );
}