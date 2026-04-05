"use client";

import * as React from "react";
import { useDrawingRuntime } from "./useDrawingRuntime";

export function useDrawingPublicState() {
    const runtime = useDrawingRuntime();

    return React.useSyncExternalStore(
        (listener) => runtime.subscribeState(listener),
        () => runtime.getPublicState(),
        () => runtime.getPublicState()
    );
}