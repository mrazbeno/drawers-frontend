"use client";

import * as React from "react";
import type { BrushSettings } from "drawers-shared";
import { useDrawingRuntime } from "./useDrawingRuntime";

export function useDrawingBrushSettings(): [
    BrushSettings,
    (brush: BrushSettings) => void
] {
    const runtime = useDrawingRuntime();

    const state = React.useSyncExternalStore(
        (listener) => runtime.subscribeState(listener),
        () => runtime.getPublicState(),
        () => runtime.getPublicState()
    );

    return [state.brushSettings, runtime.setBrushSettings.bind(runtime)];
}