"use client";

import * as React from "react";
import type { BrushSettings } from "drawers-shared";
import type { IDrawingRuntime } from "../app/DrawingRuntime";
import { getDrawingRuntime } from "../runtime/getDrawingRuntime";

const DrawingContext = React.createContext<IDrawingRuntime | null>(null);

export function DrawingProvider(props: {
    initialBrushSettings: BrushSettings;
    authorId?: string;
    children: React.ReactNode;
}) {
    const runtimeRef = React.useRef<IDrawingRuntime | null>(null);

    if (!runtimeRef.current) {
        runtimeRef.current = getDrawingRuntime({
            initialBrushSettings: props.initialBrushSettings,
            authorId: props.authorId,
        });
    }

    return (
        <DrawingContext.Provider value={runtimeRef.current}>
            {props.children}
        </DrawingContext.Provider>
    );
}

export function useDrawingContext() {
    const runtime = React.useContext(DrawingContext);
    if (!runtime) {
        throw new Error("useDrawingContext must be used inside DrawingProvider.");
    }
    return runtime;
}