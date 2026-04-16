"use client";

import * as React from "react";
import InputGuideDialog from "@/app/(components)/InputGuideDialog";
import UndoRedoButtonsFloater from "@/app/(components)/UndoRedoFloater";
import { RemoteCursorLayer } from "@/app/lib/drawing/presence/remoteCursorLayer";
import { useDrawingRoom } from "@/app/lib/drawing/react/DrawingRoomProvider";
import { useRoomPresence } from "@/app/lib/drawing/react/RoomPresenceProvider";
import dynamic from "next/dynamic";
// import CanvasSidePanel from "@/app/(components)/CanvasSidePanel";

// TODO: remove this temp hydration fix
const CanvasSidePanel = dynamic( () => import("@/app/(components)/CanvasSidePanel"), { ssr: false } );

export default function CanvasClient() {

  const {
    runtime,
    imageCanvasRef,
    overlayCanvasRef,
    interactionState,
  } = useDrawingRoom();

  const {
    foreignUserStates,
    cursorStore,
  } = useRoomPresence();

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
        runtime.undo();
        return;
      }

      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        runtime.redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [runtime]);

  return (
    <div className="flex w-full h-full grow select-none">

      <InputGuideDialog />

      <UndoRedoButtonsFloater/>

      <CanvasSidePanel/>

      <div
        className={`flex basis-4/5 relative w-full h-full grow bg-black overflow-hidden z-1 ${
          interactionState.isPanning ? "cursor-grabbing" : "cursor-none"
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
            runtime={runtime}
            foreignUserStates={foreignUserStates}
            cursorStore={cursorStore}
          />
        </div>
      </div>
    </div>
  );
}