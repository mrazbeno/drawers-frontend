import { BrushSettings } from "drawers-shared";

export interface Vector2 { x: number; y: number }

export interface ForeignUserState {
  id: string
  username: string
  cursorPos: Vector2
  color: string
  brushSettings?: BrushSettings
}

export type ForeignUserMap = Map<string, ForeignUserState>

export interface Viewport {
  x: number
  y: number
  scale: number
}

export const DEFAULT_STATE: Omit<ForeignUserState, "id" | "username"> = {
  cursorPos: { x: 0, y: 0 },
  color: "#000"
}
