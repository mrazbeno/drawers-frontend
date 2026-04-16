"use client";

import * as React from "react";
import { Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResponsive } from "@/hooks/useResponsive";
import { useDrawingRoom } from "../lib/drawing/react/DrawingRoomProvider";

function Kbd(props: { children: React.ReactNode }) {
    return (
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            {props.children}
        </kbd>
    );
}

export default function UndoRedoButtonsFloater() {
    const { isMobile } = useResponsive();
    const { runtime, publicState } = useDrawingRoom()
    const { canRedo, canUndo } = publicState

    const handleUndo = React.useCallback(() => {
        runtime.undo();
    }, [runtime]);

    const handleRedo = React.useCallback(() => {
        runtime.redo();
    }, [runtime]);


    return (
        <div className="fixed right-0 bottom-0 m-2 z-30 flex gap-2">
            <Button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                variant="secondary"
                className="shadow-md gap-2"
                title="Undo"
            >
                <Undo2 className="h-4 w-4" />
                <span>Undo</span>
                {!isMobile ? (
                    <span className="ml-1 inline-flex items-center gap-1">
                        <Kbd>Ctrl</Kbd>
                        <Kbd>Z</Kbd>
                    </span>
                ) : null}
            </Button>

            <Button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                variant="secondary"
                className="shadow-md gap-2"
                title="Redo"
            >
                <Redo2 className="h-4 w-4" />
                <span>Redo</span>
                {!isMobile ? (
                    <span className="ml-1 inline-flex items-center gap-1">
                        <Kbd>Ctrl</Kbd>
                        <Kbd>Shift</Kbd>
                        <Kbd>Z</Kbd>
                    </span>
                ) : null}
            </Button>
        </div>
    );
}