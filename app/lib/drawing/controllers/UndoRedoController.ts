import type { IStrokeDocument } from "../document/types";

export type UndoRedoOp =
    | { type: "hide"; strokeId: string }
    | { type: "show"; strokeId: string };

export interface IUndoRedoController {
    recordCommittedStroke(strokeId: string): void;

    undo(): UndoRedoOp | null;
    redo(): UndoRedoOp | null;

    clearHistory(): void;

    canUndo(): boolean;
    canRedo(): boolean;
}

export class UndoRedoController implements IUndoRedoController {
    private document: IStrokeDocument;

    private undoStack: string[] = [];
    private redoStack: string[] = [];

    constructor(params: { document: IStrokeDocument }) {
        this.document = params.document;
    }

    recordCommittedStroke(strokeId: string): void {
        this.undoStack.push(strokeId);
        this.redoStack = [];
    }

    undo(): UndoRedoOp | null {
        const strokeId = this.undoStack.pop();
        if (!strokeId) return null;

        this.document.apply({
            type: "stroke_hide",
            strokeId,
        });

        this.redoStack.push(strokeId);

        return {
            type: "hide",
            strokeId,
        };
    }

    redo(): UndoRedoOp | null {
        const strokeId = this.redoStack.pop();
        if (!strokeId) return null;

        this.document.apply({
            type: "stroke_show",
            strokeId,
        });

        this.undoStack.push(strokeId);

        return {
            type: "show",
            strokeId,
        };
    }

    clearHistory(): void {
        this.undoStack = [];
        this.redoStack = [];
    }

    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }
}