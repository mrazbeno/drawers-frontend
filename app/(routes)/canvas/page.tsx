"use client"

import * as React from "react";
import { BrushSettings, CanvasStrokeHistory, CursorEvent, DrawEndEvent, DrawStartEvent, DrawUpdateEvent, RoomAction, RoomUsers, ServerToClientEvents, StrokeHistoryRecord } from "drawers-shared"
import { useSocket } from "@/providers/SocketProvider";
import { MousePointer2 } from 'lucide-react';
import { SOFT_BRUSH_PRESET_STROKE } from "../../(components)/BrushSettingsPanel";
import { toast } from "sonner"
import { makeStroke, generateDarkColor, throttleRaf, generateLightColor } from "@/app/lib/utility"
import { Vector2, ForeignUserState, ForeignUserMap, DEFAULT_STATE } from "@/app/lib/types"
import { useRouter } from "next/navigation";
import { useResponsive } from "@/hooks/useResponsive"
import InputGuideDialog from "@/app/(components)/InputGuideDialog";
import dynamic from "next/dynamic";

const CanvasSidePanel = dynamic(() => import("@/app/(components)/CanvasSidePanel"), {
    ssr: false,
});

const CANVAS_BG_COLOR = "#fff"
const DEFAULT_BRUSH_COLOR = "#000"
const DEFAULT_BRUSH_SETTINGS: BrushSettings = { strokeOptions: SOFT_BRUSH_PRESET_STROKE, brushColor: DEFAULT_BRUSH_COLOR }

export default function Page() {
    const [version, setVersion] = React.useState(0); // dummy to trigger re-render

    const socket = useSocket()
    const router = useRouter()

    const SVGstrokeHistoryRef = React.useRef<StrokeHistoryRecord[]>([])

    const imgCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const overlayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

    const imgCtxRef = React.useRef<CanvasRenderingContext2D | null>(null);
    const overlayCtxRef = React.useRef<CanvasRenderingContext2D | null>(null);
    const dprRef = React.useRef<number>(1);

    const [brushSettingsChanged, setBrushSettingsChanged] = React.useState<boolean>(false)
    const isDrawing = React.useRef(false);

    const [hostUserId, setHostUserId] = React.useState<string>("")

    const [foreignUserStates, setForeignUserStates] = React.useState<ForeignUserMap>(new Map());
    const foreignUserStatesRef = React.useRef(foreignUserStates);

    const drawSimulationsBrushesRef = React.useRef<Map<string, BrushSettings>>(new Map())
    const drawSimulationsPathRef = React.useRef<Map<string, { pts: number[][], end?: boolean }>>(new Map())
    const cursorPositionsRef = React.useRef<Map<ForeignUserState, Vector2>>(new Map())

    const [brushSettings, setBrushSettings] = React.useState<BrushSettings>(DEFAULT_BRUSH_SETTINGS);
    const brushSettingsRef = React.useRef(brushSettings);

    const pointersRef = React.useRef<Map<number, PointerData>>(new Map());
    const transformRef = React.useRef({ scale: 1, offsetX: 0, offsetY: 0 });

    const lastCursorPosRef = React.useRef<Vector2>({ x: 0, y: 0 })

    const [currentRoomId, setCurrentRoomId] = React.useState<string>("")
    const newPointsRef = React.useRef<number[][]>([]);
    const currentStrokeRef = React.useRef<number[][]>([]);
    const { isMobile, orientation } = useResponsive();

    function updateForeignUserState(userId: string, updater: (state: ForeignUserState) => ForeignUserState) {
        const current = foreignUserStatesRef.current;
        const existing = current.get(userId);
        if (!existing) return;

        const updated = new Map(current);
        updated.set(userId, updater(existing));

        setForeignUserStates(updated);
        foreignUserStatesRef.current = updated;
    }

    const drawSVG = (pathData: string, brush: BrushSettings) => {
        const ctx = imgCtxRef.current!;
        const { scale, offsetX, offsetY } = transformRef.current;
        const dpr = dprRef.current;

        const path = new Path2D(pathData);

        ctx.save();
        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
        ctx.fillStyle = brush.brushColor;
        ctx.fill(path);
        ctx.restore();
    }
    const drawSVGThrottleAF = throttleRaf(drawSVG)

    function diffAndSyncUserMap(
        current: Map<string, ForeignUserState>,
        fresh: Map<string, string>
    ): {
        newMap: Map<string, ForeignUserState>;
        joined: ForeignUserState[];
        left: ForeignUserState[];
    } {
        const newMap = new Map<string, ForeignUserState>();
        const joined: ForeignUserState[] = [];
        const left: ForeignUserState[] = [];

        const myId = socket.getThisUserId()

        // --- detect joins and update existing ---
        fresh.forEach((username, id) => {
            if (id === myId) return
            const existing = current.get(id);
            const updated: ForeignUserState = {
                ...DEFAULT_STATE,
                ...existing,
                id,
                username,
                color: existing?.color ?? generateDarkColor(),
            };

            newMap.set(id, updated);

            if (!existing) {
                joined.push(updated);
            }
        });

        // --- detect leaves ---
        current.forEach((state, id) => {
            if (!fresh.has(id)) {
                left.push(state);
            }
        });

        return { newMap, joined, left };
    }

    interface PointerData {
        id: number;
        x: number;
        y: number;
        startX: number;
        startY: number;
        pointerType: string;
    }

    const screenToWorld = (x: number, y: number): [number, number] => {
        const { scale, offsetX, offsetY } = transformRef.current;
        return [(x - offsetX) / scale, (y - offsetY) / scale];
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        pointersRef.current.set(e.pointerId, {
            id: e.pointerId,
            x,
            y,
            startX: x,
            startY: y,
            pointerType: e.pointerType,
        });

        // Pan mode
        if (e.pointerType === "mouse" && e.buttons === 2) {
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
        }

        // Pinch mode
        if (e.pointerType === "touch" && pointersRef.current.size === 2) {
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
        }

        if (e.pointerType === "pen" || e.buttons === 1 || e.pointerType === "touch") {
            isDrawing.current = true;
            const [cx, cy] = screenToWorld(x, y);
            newPointsRef.current = [[cx, cy, e.pressure ?? 0.5], [cx, cy, e.pressure ?? 0.5]];
            currentStrokeRef.current = [[cx, cy, e.pressure ?? 0.5], [cx, cy, e.pressure ?? 0.5]];

            const svg = makeStroke(currentStrokeRef.current, brushSettings)
            drawSVGThrottleAF(svg, brushSettings)

            sendDrawStartEvent()
        }

        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pointers = pointersRef.current;
        const ctx = imgCtxRef.current!;
        const canvas = imgCanvasRef.current!;
        const t = transformRef.current;

        const [cx, cy] = screenToWorld(x, y);
        sendCursorEvent(cx, cy)
        drawCircleCursorThrottleAF(x, y)

        const p = pointers.get(e.pointerId);
        if (p) {
            p.x = x;
            p.y = y;
        }

        if (pointers.size === 1) {
            const onlyPointer = Array.from(pointers.values())[0]!;

            // Drawing mode
            if (
                (onlyPointer.pointerType === "pen" && isDrawing.current) ||
                (onlyPointer.pointerType === "touch" && isDrawing.current) ||
                (onlyPointer.pointerType === "mouse" && e.buttons === 1)
            ) {
                newPointsRef.current.push([cx, cy, e.pressure ?? 0.5]);
                currentStrokeRef.current.push([cx, cy, e.pressure ?? 0.5]);
                const svg = makeStroke(currentStrokeRef.current, brushSettings)
                drawSVGThrottleAF(svg, brushSettings)
                sendDrawUpdateEvent()
            }

            // Pan mode (mouse)
            if (onlyPointer.pointerType === "mouse" && e.buttons === 2) {
                const dx = x - onlyPointer.startX;
                const dy = y - onlyPointer.startY;
                t.offsetX += dx;
                t.offsetY += dy;
                onlyPointer.startX = x;
                onlyPointer.startY = y;
                redrawThrottleAF();
                setVersion(v => v + 1);
            }
        }

        // Pan & zoom mode (touch)
        if (pointers.size === 2) {
            const pts = Array.from(pointers.values());
            const p1 = pts[0]!, p2 = pts[1]!


            const prevMidX = (p1.startX + p2.startX) / 2;
            const prevMidY = (p1.startY + p2.startY) / 2;
            const currMidX = (p1.x + p2.x) / 2;
            const currMidY = (p1.y + p2.y) / 2;

            const prevDist = Math.hypot(p1.startX - p2.startX, p1.startY - p2.startY);
            const currDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

            const zoomFactor = currDist / prevDist;
            t.scale *= zoomFactor;

            // pan adjustment
            t.offsetX += currMidX - prevMidX;
            t.offsetY += currMidY - prevMidY;

            // update start positions
            p1.startX = p1.x;
            p1.startY = p1.y;
            p2.startX = p2.x;
            p2.startY = p2.y;

            redrawThrottleAF();
            setVersion(v => v + 1);
            drawCircleCursor()
        }
    };

    const preSnapshotQueueRef = React.useRef<
        { type: "draw_start" | "draw_update" | "draw_end"; payload: any }[]
    >([]);

    const [isCanvasReady, setIsCanvasReady] = React.useState(false);
    const isCanvasReadyRef = React.useRef(false);

    const drawCircleCursor = (x: number = lastCursorPosRef.current.x, y: number = lastCursorPosRef.current.y) => {

        const canvas = overlayCanvasRef.current
        const ctx = overlayCtxRef.current
        if (!canvas || !ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const cursorSize = (brushSettings.strokeOptions.size ?? 1) * transformRef.current.scale * 0.5

        ctx.strokeStyle = "black"
        ctx.beginPath()
        ctx.arc(x, y, cursorSize, 0, Math.PI * 2)
        ctx.stroke()

        lastCursorPosRef.current.x = x
        lastCursorPosRef.current.y = y
    }
    const drawCircleCursorThrottleAF = throttleRaf(drawCircleCursor)

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (isDrawing.current) {
            isDrawing.current = false;
            const svg = makeStroke(currentStrokeRef.current, brushSettings)
            SVGstrokeHistoryRef.current.push({ brushSettings, svgPath: svg })
            sendDrawEndEvent()
        }

        newPointsRef.current = []
        currentStrokeRef.current = []

        pointersRef.current.delete(e.pointerId);
    };

    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const { offsetX, offsetY, deltaY } = e.nativeEvent;
        const t = transformRef.current;
        const zoomAmount = Math.exp(-deltaY / 400);

        // zoom centered on cursor
        const worldX = (offsetX - t.offsetX) / t.scale;
        const worldY = (offsetY - t.offsetY) / t.scale;

        t.scale *= zoomAmount;
        t.offsetX = offsetX - worldX * t.scale;
        t.offsetY = offsetY - worldY * t.scale;

        redraw();
        setVersion(v => v + 1);
        drawCircleCursor()
    };

    const redraw = () => {
        const ctx = imgCtxRef.current!;
        const canvas = imgCanvasRef.current!;
        ctx.fillStyle = CANVAS_BG_COLOR
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (const stroke of SVGstrokeHistoryRef.current) {
            drawSVG(stroke.svgPath, stroke.brushSettings)
        }

        if (newPointsRef.current.length > 0) {
            const svg = makeStroke(newPointsRef.current, brushSettings)
            drawSVG(svg, brushSettings)
        }
    };
    const redrawThrottleAF = throttleRaf(redraw)


    const sendDrawStartEvent = () => {
        const pts = newPointsRef.current;
        socket.emitEvent("draw_start", { roomId: socket.getRoomId(), userId: socket.getThisUserId(), points: pts, newBrushSettings: brushSettingsChanged ? brushSettings : undefined })
        setBrushSettingsChanged(v => false)
    }

    const sendDrawEndEvent = () => {
        const pts = newPointsRef.current;
        socket.emitEvent("draw_end", {
            roomId: socket.getRoomId(),
            userId: socket.getThisUserId(),
            points: pts,
        });
        newPointsRef.current = [];
    };

    const sendDrawUpdateEvent = React.useMemo(
        () => throttleRaf(() => {
            const pts = newPointsRef.current;
            if (pts.length === 0) return;

            socket.emitEvent("draw_update", {
                roomId: socket.getRoomId(),
                userId: socket.getThisUserId(),
                points: pts,
            });

            // Clear only after emitting
            newPointsRef.current = [];
        }),
        [socket]
    );

    const sendCursorEvent = React.useMemo(
        () =>
            throttleRaf((x: number, y: number) => {
                socket.emitEvent("cursor_move", { roomId: socket.getRoomId(), userId: socket.getThisUserId(), x, y })
            }),
        [socket]
    );

    const drawPendingSimulations = throttleRaf(() => {
        const toBeDeleted = []
        let wasDrawing = false

        for (const [key, path] of drawSimulationsPathRef.current.entries()) {
            const user = foreignUserStatesRef.current.get(key)
            if (!user) {
                toBeDeleted.push(key)
                continue
            }

            const brushCfg = drawSimulationsBrushesRef.current.get(key) ?? DEFAULT_BRUSH_SETTINGS
            const svg = makeStroke(path.pts, brushCfg)
            drawSVG(svg, brushCfg)
            wasDrawing = true

            if (path.end) {
                SVGstrokeHistoryRef.current.push({ svgPath: svg, brushSettings: brushCfg })
                toBeDeleted.push(key)
            }
        }

        for (const key of toBeDeleted) {
            drawSimulationsPathRef.current.delete(key)
        }

        if (wasDrawing)
            setVersion(v => v + 1)
    })

    const updateCursorPositions = throttleRaf(() => {
        for (const [user, pos] of cursorPositionsRef.current.entries())
            user.cursorPos = pos
        setVersion(v => v + 1)
    })

    function leaveRoom() {
        socket.disconnect()
        router.push("/")
    }

    function clearCanvas() {
        const imgCanvas = imgCanvasRef.current
        const imgCanvasCtx = imgCtxRef.current

        if (!imgCanvasCtx || !imgCanvas) return
        if (hostUserId !== socket.getThisUserId()) return

        const { width, height } = imgCanvas

        socket.emitEvent("clear_canvas", { roomId: socket.getRoomId(), username: socket.getOwnUserName() })

        imgCanvasCtx.fillStyle = CANVAS_BG_COLOR
        imgCanvasCtx.fillRect(0, 0, width, height)
    }

    const resize = () => {
        const imgCv = imgCanvasRef.current;
        const overlayCv = overlayCanvasRef.current;

        if (!imgCv || !overlayCv) return

        const rect = imgCv.getBoundingClientRect();
        const newWidth = rect.width;
        const newHeight = rect.height;
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        dprRef.current = dpr;

        imgCv.width = Math.floor(newWidth * dpr);
        imgCv.height = Math.floor(newHeight * dpr);

        overlayCv.width = Math.floor(newWidth * dpr);
        overlayCv.height = Math.floor(newHeight * dpr);

        imgCtxRef.current?.setTransform(dpr, 0, 0, dpr, 0, 0);
        overlayCtxRef.current?.setTransform(dpr, 0, 0, dpr, 0, 0);

        redrawThrottleAF()
        drawCircleCursor()
        setVersion(v => v + 1)
    };

    const handleUserJoin = (data: RoomUsers) => {
        updateUsers(data)
    };

    const handleUserLeave = (data: RoomUsers) => {
        updateUsers(data)
    };

    function queueOrRun<T extends "draw_start" | "draw_update" | "draw_end">(type: T, payload: any, fn: () => void) {
        if (!isCanvasReadyRef.current) {
            preSnapshotQueueRef.current.push({ type, payload });
            return;
        }
        fn();
    }

    function flushQueuedDrawEvents() {
        const queue = preSnapshotQueueRef.current;
        if (queue.length === 0) return;

        console.log(`Flushing ${queue.length} queued draw events...`);
        queue.forEach(({ type, payload }) => {
            switch (type) {
                case "draw_start": handleDrawStart(payload); break;
                case "draw_update": handleDrawUpdate(payload); break;
                case "draw_end": handleDrawEnd(payload); break;
            }
        });
        queue.length = 0;
    }

    const handleDrawStart = (data: DrawStartEvent) =>
        queueOrRun("draw_start", data, () => {
            const states = foreignUserStatesRef.current;
            const user = states.get(data.userId);
            const canvas = imgCanvasRef.current;
            if (!user || !canvas) return;

            if (data.newBrushSettings)
                drawSimulationsBrushesRef.current.set(user.id, data.newBrushSettings)

            drawSimulationsPathRef.current.set(user.id, { pts: [...data.points] })
        });

    const handleDrawUpdate = (data: DrawUpdateEvent) =>
        queueOrRun("draw_update", data, () => {

            const states = foreignUserStatesRef.current;
            const user = states.get(data.userId);
            const canvas = imgCanvasRef.current;
            if (!user || !canvas) return;
            const path = drawSimulationsPathRef.current.get(user.id)
            if (!path) return

            path.pts.push(...data.points);

            drawPendingSimulations()
        });

    const handleDrawEnd = (data: DrawEndEvent) =>
        queueOrRun("draw_end", data, () => {

            const canvas = imgCanvasRef.current;
            const states = foreignUserStatesRef.current;
            const user = states.get(data.userId);
            const ctx = imgCtxRef.current;
            if (!user || !ctx || !canvas) return;
            const path = drawSimulationsPathRef.current.get(user.id)
            if (!path) return

            path.pts.push(...data.points);
            path.end = true

            drawPendingSimulations()
        });

    const handleCursorMove = (data: CursorEvent) => {
        const user = foreignUserStatesRef.current.get(data.userId)
        if (!user) return

        cursorPositionsRef.current.set(user, { x: data.x, y: data.y })
        updateCursorPositions()
    };

    const handleClear = () => {
        const ctx = imgCtxRef.current;
        const canvas = imgCanvasRef.current;

        if (!ctx || !canvas) return;
        ctx.fillStyle = CANVAS_BG_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        SVGstrokeHistoryRef.current = []
    };

    const handleHostChanged = (data: string) => {
        setHostUserId(data);
    };

    const handleCanvasSnapShot = (data: { targetUserId: string; snapshot: CanvasStrokeHistory }) => {
        const ctx = imgCtxRef.current;
        const canvas = imgCanvasRef.current;
        if (!ctx || !canvas) return;

        SVGstrokeHistoryRef.current.push(...data.snapshot)
        redraw()
        setIsCanvasReady(true);
        isCanvasReadyRef.current = true;

        flushQueuedDrawEvents();
    };

    const handleRequestCanvasSnapShot = (targetUserId: string) => {
        socket.emitEvent("canvas_snapshot", { targetUserId: targetUserId, snapshot: SVGstrokeHistoryRef.current });
    }

    const handleRequestBrushState = (data: { targetUserId: string }) => {
        if (data.targetUserId === socket.getThisUserId()) return;

        socket.emitEvent("brush_state", {
            targetUserId: data.targetUserId,
            userId: socket.getThisUserId(),
            brushSettings: brushSettingsRef.current,
        });
    }

    const handleBrushState = (data: { targetUserId: string; userId: string; brushSettings: BrushSettings }) => {
        updateForeignUserState(data.userId, (u) => ({
            ...u,
            brushSettings: data.brushSettings,
        }));
    }

    async function initSync() {
        const resp = await socket.fetchUsers();

        updateUsers(resp.users);
        setHostUserId(resp.hostId);

        if (socket.getThisUserId() === resp.hostId) {
            setIsCanvasReady(true);
            isCanvasReadyRef.current = true;
        } else {
            socket.emitEvent("request_canvas_snapshot", {
                roomId: socket.getRoomId(),
                targetUserId: socket.getThisUserId(),
            });


            socket.emitEvent("request_brush_states", {
                roomId: socket.getRoomId(),
                targetUserId: socket.getThisUserId(),
            });
        }
    }

    function updateUsers(data: RoomUsers) {
        setForeignUserStates(prev => {
            const { newMap, joined, left } = diffAndSyncUserMap(prev, new Map(data));

            if (joined.length > 0) {
                const joinedStr = joined.map((v, i) => v.username).join(", ")
                toast.info(`New user${joined.length > 1 ? "s" : ""} joined: ${joinedStr}`)
            }

            if (left.length > 0) {
                for (const [k, v] of left.entries())
                    cursorPositionsRef.current.delete(v)

                const leftStr = left.map((v, i) => v.username).join(", ")
                toast.info(`User${joined.length > 1 ? "s" : ""} left: ${leftStr}`)
            }

            return newMap;
        });
    }

    const onSidePanelTabChange = async (e: string) => {
        if (e === "room_info") {
            const resp = await socket.fetchUsers()
            updateUsers(resp.users)
            setHostUserId(v => resp.hostId)
        }
    }

    // ==========  REACT EFFECTS  ==========

    React.useEffect(() => {
        isCanvasReadyRef.current = isCanvasReady;
    }, [isCanvasReady]);

    React.useEffect(() => {
        const imgCanvas = imgCanvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        if (!imgCanvas || !overlayCanvas) return;

        const imgCtx = imgCanvas.getContext("2d")!;
        const overlayCtx = overlayCanvas.getContext("2d")!;

        imgCtx.imageSmoothingEnabled = true;
        imgCtx.imageSmoothingQuality = "high";

        imgCtxRef.current = imgCtx;
        overlayCtxRef.current = overlayCtx;

        dprRef.current = Math.max(1, window.devicePixelRatio || 1);
        const dpr = dprRef.current;
        const { width, height } = imgCanvas.getBoundingClientRect();
        imgCanvas.width = Math.floor(width * dpr);
        imgCanvas.height = Math.floor(height * dpr);
        overlayCanvas.width = Math.floor(width * dpr);
        overlayCanvas.height = Math.floor(height * dpr);
        imgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        imgCtx.fillStyle = "white";
        imgCtx.fillRect(0, 0, width * dpr, height * dpr);

        setCurrentRoomId(v => socket.getRoomId())

        return () => { }
    }, [])

    React.useEffect(() => {
        foreignUserStatesRef.current = foreignUserStates;
    }, [foreignUserStates]);

    React.useEffect(() => {
        brushSettingsRef.current = brushSettings;
        drawCircleCursor()
    }, [brushSettings]);

    React.useEffect(() => {
        setBrushSettingsChanged(v => true)
    }, [brushSettings])

    React.useEffect(() => {
        resize();
        window.addEventListener("resize", resize);
        window.addEventListener("orientationchange", resize);

        return () => {
            window.removeEventListener("resize", resize);
            window.removeEventListener("orientationchange", resize);
        };
    }, []);

    React.useEffect(() => {
        if (!socket.socket) return;

        // Register all events once
        socket.socket.on("user_joined", handleUserJoin);
        socket.socket.on("user_left", handleUserLeave);
        socket.socket.on("draw_start", handleDrawStart);
        socket.socket.on("draw_update", handleDrawUpdate);
        socket.socket.on("draw_end", handleDrawEnd);
        socket.socket.on("cursor_move", handleCursorMove);
        socket.socket.on("clear_canvas", handleClear);
        socket.socket.on("host_changed", handleHostChanged);
        socket.socket.on("canvas_snapshot", handleCanvasSnapShot);
        socket.socket.on("request_canvas_snapshot", handleRequestCanvasSnapShot);
        socket.socket.on("brush_state", handleBrushState);
        socket.socket.on("request_brush_states", handleRequestBrushState);

        initSync()

        // Cleanup when component unmounts
        return () => {
            socket.socket?.off("user_joined", handleUserJoin);
            socket.socket?.off("user_left", handleUserLeave);
            socket.socket?.off("draw_start", handleDrawStart);
            socket.socket?.off("draw_update", handleDrawUpdate);
            socket.socket?.off("draw_end", handleDrawEnd);
            socket.socket?.off("cursor_move", handleCursorMove);
            socket.socket?.off("clear_canvas", handleClear);
            socket.socket?.off("host_changed", handleHostChanged);
            socket.socket?.off("canvas_snapshot", handleCanvasSnapShot);
            socket.socket?.off("request_canvas_snapshot", handleRequestCanvasSnapShot);
            socket.socket?.off("brush_state", handleBrushState);
            socket.socket?.off("request_brush_states", handleRequestBrushState);
        };
    }, [socket]);

    return (
        <div className="flex w-full h-full grow select-none">
            <div className="fixed m-2 right-0 bottom-0 z-10">
                <InputGuideDialog />
            </div>

            <CanvasSidePanel
                hostUserId={hostUserId}
                thisUserId={socket.getThisUserId()}
                thisUsername={socket.getOwnUserName()}
                clearCanvas={clearCanvas}
                leaveRoom={leaveRoom}
                resize={resize}
                isMobile={isMobile}
                currentRoomId={socket.getRoomId()}
                setBrushSettings={setBrushSettings}
                brushSettings={brushSettings}
                foreignUserStates={foreignUserStates}
                onSidePanelTabChange={onSidePanelTabChange}
            />

            <div className="flex basis-4/5 relative w-full h-full grow bg-black cursor-none overflow-hidden z-1">
                <div className="flex relative w-full h-full grow bg-black ">
                    <canvas
                        onContextMenu={e => { e.preventDefault() }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onWheel={handleWheel}
                        ref={imgCanvasRef} className="z-1 absolute w-full h-full  border-solid border-red touch-none select-none  t-0 l-0" draggable={false}>
                    </canvas>

                    <canvas ref={overlayCanvasRef} className="z-2 absolute w-full h-full grow  border-solid border-transparent t-0 l-0 pointer-events-none touch-none select-none" draggable={false}></canvas>

                    <div className="z-3 absolute w-full h-full pointer-events-none select-none bg-transparent" draggable={false}>
                        {Array.from(foreignUserStatesRef.current.values()).map((v, i) => (
                            <div key={v.id} className="absolute"
                                style={{
                                    left: `${v.cursorPos.x * transformRef.current.scale + transformRef.current.offsetX}px`,
                                    top: `${v.cursorPos.y * transformRef.current.scale + transformRef.current.offsetY}px`,
                                    transform: 'translate(-50%, -50%)', // optional: center on point
                                }}
                            >
                                <MousePointer2 fill="white" stroke="black" className="absolute h-8 w-8" />
                                <div className="absolute bg-green rounded-sm px-2 py-1 top-5 left-5" style={{ backgroundColor: v.color }}>
                                    {v.username}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}