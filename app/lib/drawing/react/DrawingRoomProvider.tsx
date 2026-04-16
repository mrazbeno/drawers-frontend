"use client";

import * as React from "react";
import type { BrushSettings } from "drawers-shared";

import type {
  IDrawingRuntime,
  InteractionState,
  PublicState,
} from "../app/DrawingRuntime";
import { createCollabDrawingRuntime } from "../runtime/createCollabRuntime";
import type { TypedSocket } from "@/app/lib/TypedSocket";
import { useRoomPresence } from "./RoomPresenceProvider";

type DrawingRoomContextValue = {
  runtime: IDrawingRuntime;
  imageCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
};

const DrawingRoomContext = React.createContext<DrawingRoomContextValue | null>(null);

type DrawingRoomProviderProps = {
  socket: TypedSocket;
  roomId: string;
  userId: string;
  children: React.ReactNode;
};

export function DrawingRoomProvider({
  socket,
  roomId,
  userId,
  children,
}: DrawingRoomProviderProps) {
  const runtimeRef = React.useRef<IDrawingRuntime | null>(null);
  const imageCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const { initRoomPresence } = useRoomPresence();

  if (!runtimeRef.current) {
    runtimeRef.current = createCollabDrawingRuntime({
      socket,
      roomId,
      userId,
    });
  }

  React.useEffect(() => {
    const runtime = runtimeRef.current!;
    const imageCanvas = imageCanvasRef.current;

    if (!imageCanvas) return;

    runtime.mount({
      imageCanvas,
      overlayCanvas: overlayCanvasRef.current ?? undefined,
    });

    const onResize = () => {
      runtime.resize();
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      runtime.unmount();
    };
  }, []);

  React.useEffect(() => {
    const runtime = runtimeRef.current!;
    let cancelled = false;

    const setup = async () => {
      const resp = await initRoomPresence();
      if (cancelled) return;

      if (userId === resp.hostId) {
        runtime.markRemoteSyncReady();
      } else {
        runtime.markRemoteSyncWaiting();
        runtime.requestSnapshot?.(userId);
        runtime.requestBrushStates?.(userId);
      }
    };

    setup();

    return () => {
      cancelled = true;
    };
  }, [initRoomPresence, userId]);

  const value = React.useMemo<DrawingRoomContextValue>(
    () => ({
      runtime: runtimeRef.current!,
      imageCanvasRef,
      overlayCanvasRef,
    }),
    []
  );

  return (
    <DrawingRoomContext.Provider value={value}>
      {children}
    </DrawingRoomContext.Provider>
  );
}

export function useDrawingRoom(): {
  runtime: IDrawingRuntime;
  imageCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  publicState: PublicState;
  interactionState: InteractionState;
  brushSettings: BrushSettings;
  setBrushSettings: (brush: BrushSettings) => void;
} {
  const ctx = React.useContext(DrawingRoomContext);
  if (!ctx) {
    throw new Error("useDrawingRoom must be used inside DrawingRoomProvider");
  }

  const { runtime, imageCanvasRef, overlayCanvasRef } = ctx;

  const publicState = React.useSyncExternalStore(
    (listener) => runtime.subscribeState(listener),
    () => runtime.getPublicState(),
    () => runtime.getPublicState()
  );

  const interactionState = React.useSyncExternalStore(
    (listener) => runtime.subscribeInteraction(listener),
    () => runtime.getInteractionState(),
    () => runtime.getInteractionState()
  );

  const setBrushSettings = React.useCallback(
    (brush: BrushSettings) => {
      runtime.setBrushSettings(brush);
    },
    [runtime]
  );

  return {
    runtime,
    imageCanvasRef,
    overlayCanvasRef,
    publicState,
    interactionState,
    brushSettings: publicState.brushSettings,
    setBrushSettings,
  };
}