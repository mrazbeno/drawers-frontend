"use client";

import * as React from "react";
import { Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResponsive } from "@/hooks/useResponsive";

function Kbd(props: { children: React.ReactNode }) {
    return (
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            {props.children}
        </kbd>
    );
}

export default function UndoRedoButtonsFloater(props: {
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}) {
    const { isMobile } = useResponsive();

    return (
        <div className="fixed right-0 bottom-0 m-2 z-30 flex gap-2">
            <Button
                type="button"
                onClick={props.onUndo}
                disabled={!props.canUndo}
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
                onClick={props.onRedo}
                disabled={!props.canRedo}
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