"use client";

import { useDrawingContext } from "./drawingContext";

export function useDrawingRuntime() {
    return useDrawingContext();
}