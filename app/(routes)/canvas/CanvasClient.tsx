"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
    BrushSettings,
} from "drawers-shared";

import { useSocket } from "@/providers/SocketProvider";
import { TypedSocket } from "@/app/lib/TypedSocket";
import { useResponsive } from "@/hooks/useResponsive";
import InputGuideDialog from "@/app/(components)/InputGuideDialog";

import { SOFT_BRUSH_PRESET_STROKE } from "@/app/(components)/BrushSettingsPanel";
import { createCollabDrawingRuntime } from "@/app/lib/drawing/runtime/createCollabRuntime";
import type { IDrawingRuntime } from "@/app/lib/drawing/app/DrawingRuntime";
import { resetDrawingRuntime } from "@/app/lib/drawing/runtime/getDrawingRuntime";

import { useRoomPresence } from "@/app/lib/drawing/presence/useRoomPresence";
import UndoRedoButtonsFloater from "@/app/(components)/UndoRedoFloater";
import { RemoteCursorLayer } from "@/app/lib/drawing/presence/remoteCursorLayer";

const CanvasSidePanel = dynamic(
    () => import("@/app/(components)/CanvasSidePanel"),
    { ssr: false }
);

const DEFAULT_BRUSH_COLOR = "#000000";
const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
    strokeOptions: SOFT_BRUSH_PRESET_STROKE,
    brushColor: DEFAULT_BRUSH_COLOR,
};

export default function CanvasClient() {
    const router = useRouter();
    const socketStore = useSocket();
    const { isMobile } = useResponsive();

    const {
        hostUserId,
        foreignUserStates,
        cursorStore,
        initRoomPresence,
        refreshRoomInfo,
    } = useRoomPresence(socketStore);

    const imageCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const overlayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

    const runtimeRef = React.useRef<IDrawingRuntime | null>(null);

    const [brushSettings, setBrushSettings] = React.useState<BrushSettings>(
        DEFAULT_BRUSH_SETTINGS
    );

    const [interactionState, setInteractionState] = React.useState({
        isDrawing: false,
        isPanning: false,
    });

    const [runtimePublicState, setRuntimePublicState] = React.useState(() => ({
        strokeCount: 0,
        canUndo: false,
        canRedo: false,
        brushSettings: DEFAULT_BRUSH_SETTINGS,
    }));

    const leaveRoom = React.useCallback(() => {
        runtimeRef.current?.unmount();
        resetDrawingRuntime();
        socketStore.disconnect();
        router.push("/");
    }, [router, socketStore]);

    const clearCanvas = React.useCallback(() => {
        if (hostUserId !== socketStore.getThisUserId()) return;
        runtimeRef.current?.clear();
    }, [hostUserId, socketStore]);

    const handleBrushSettingsChange = React.useCallback((next: BrushSettings) => {
        setBrushSettings(next);
        runtimeRef.current?.setBrushSettings(next);
    }, []);

    const handleExportSvg = React.useCallback(() => {
        const svgText = runtimeRef.current?.exportSvg();
        if (!svgText) {
            toast.info("There is no drawing to export.");
            return;
        }

        const blob = new Blob([svgText], {
            type: "image/svg+xml;charset=utf-8",
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "drawing.svg";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        toast.success("SVG downloaded.");
    }, []);

    const handleUndo = React.useCallback(() => {
        runtimeRef.current?.undo();
    }, []);

    const handleRedo = React.useCallback(() => {
        runtimeRef.current?.redo();
    }, []);

    const handleResizeViewport = React.useCallback(() => {
        runtimeRef.current?.resize();
    }, []);

    const onSidePanelTabChange = React.useCallback(async (tab: string) => {
        if (tab === "room_info") {
            await refreshRoomInfo();
        }
    }, [refreshRoomInfo]);

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const tag = target?.tagName?.toLowerCase();

            const isTypingTarget =
                tag === "input" ||
                tag === "textarea" ||
                target?.isContentEditable;

            if (isTypingTarget) return;

            const isMod = event.ctrlKey || event.metaKey;
            if (!isMod) return;

            const key = event.key.toLowerCase();

            if (key === "z" && !event.shiftKey) {
                event.preventDefault();
                runtimeRef.current?.undo();
                return;
            }

            if (key === "z" && event.shiftKey) {
                event.preventDefault();
                runtimeRef.current?.redo();
                return;
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, []);

    function redirToHome() {
        router.push("/")
    }

    React.useEffect(() => {
        if (!socketStore.socket) {redirToHome(); return;}
        if (!imageCanvasRef.current) {redirToHome(); return;}

        const typedSocket = socketStore.socket as TypedSocket;

        const runtime = createCollabDrawingRuntime({
            socket: typedSocket,
            roomId: socketStore.getRoomId(),
            userId: socketStore.getThisUserId(),
            initialBrushSettings: brushSettings,
        });

        runtimeRef.current = runtime;

        runtime.mount({
            imageCanvas: imageCanvasRef.current,
            overlayCanvas: overlayCanvasRef.current ?? undefined,
        });

        const unsubscribeRuntimeInteraction = runtime.subscribeInteraction(() => {
            setInteractionState(runtime.getInteractionState());
        });

        const unsubscribeRuntimeState = runtime.subscribeState(() => {
            const state = runtime.getPublicState();
            setRuntimePublicState(state);
            setBrushSettings(state.brushSettings);
        });

        const onWindowResize = () => {
            runtime.resize();
        };

        window.addEventListener("resize", onWindowResize);
        window.addEventListener("orientationchange", onWindowResize);

        const setup = async () => {
            const resp = await initRoomPresence();

            if (socketStore.getThisUserId() === resp.hostId) {
                runtime.markRemoteSyncReady();
            } else {
                runtime.markRemoteSyncWaiting();
                runtime.requestSnapshot?.(socketStore.getThisUserId());
                runtime.requestBrushStates?.(socketStore.getThisUserId());
            }
        };

        setup();

        return () => {
            unsubscribeRuntimeInteraction();
            unsubscribeRuntimeState();
            window.removeEventListener("resize", onWindowResize);
            window.removeEventListener("orientationchange", onWindowResize);
            runtime.unmount();
        };
    }, [socketStore.socket]); // deliberate: runtime instance tied to connected socket


    React.useEffect(() => {
        const socket = socketStore.socket;
        if (!socket) return;

        return () => { };
    }, [socketStore.socket,]);

    return (
        <div className="flex w-full h-full grow select-none">

            <InputGuideDialog />

            <UndoRedoButtonsFloater
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={runtimePublicState.canUndo}
                canRedo={runtimePublicState.canRedo}
            />

            <CanvasSidePanel
                hostUserId={hostUserId}
                thisUserId={socketStore.getThisUserId()}
                thisUsername={socketStore.getOwnUserName()}
                currentRoomId={socketStore.getRoomId()}
                isMobile={isMobile}
                foreignUserStates={foreignUserStates}
                onSidePanelTabChange={onSidePanelTabChange}
                onLeaveRoom={leaveRoom}
                onClearCanvas={clearCanvas}
                onResizeViewport={handleResizeViewport}
                brushSettings={brushSettings}
                onBrushSettingsChange={handleBrushSettingsChange}
                onExportSvg={handleExportSvg}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={runtimePublicState.canUndo}
                canRedo={runtimePublicState.canRedo}
            />

            {/* <div className="flex basis-4/5 relative w-full h-full grow bg-black cursor-none overflow-hidden z-1"> */}
            <div
                className={`flex basis-4/5 relative w-full h-full grow bg-black overflow-hidden z-1 ${interactionState.isPanning ? "cursor-grabbing" : "cursor-none"
                    }`}
            >
                <div className="flex relative w-full h-full grow bg-black">
                    <canvas
                        ref={imageCanvasRef}
                        className="z-1 absolute w-full h-full touch-none select-none t-0 l-0"
                        draggable={false}
                    />
                    <canvas
                        ref={overlayCanvasRef}
                        className="z-2 absolute w-full h-full grow pointer-events-none touch-none select-none t-0 l-0"
                        draggable={false}
                    />

                    <RemoteCursorLayer
                        runtime={runtimeRef.current}
                        foreignUserStates={foreignUserStates}
                        cursorStore={cursorStore}
                    />

                </div>
            </div>
        </div>
    );
}
