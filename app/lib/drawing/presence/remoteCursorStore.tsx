import { throttleRaf } from "@/app/lib/utility";

export type RemoteCursorSnapshot = Map<string, { x: number; y: number }>;

export interface IRemoteCursorStore {
    setCursor(userId: string, x: number, y: number): void;
    removeCursor(userId: string): void;
    clear(): void;

    getSnapshot(): RemoteCursorSnapshot;
    subscribe(listener: () => void): () => void;
}

export class RemoteCursorStore implements IRemoteCursorStore {
    private cursors = new Map<string, { x: number; y: number }>();
    private listeners = new Set<() => void>();

    private emitThrottled = throttleRaf(() => {
        for (const listener of this.listeners) {
            listener();
        }
    });

    setCursor(userId: string, x: number, y: number): void {
        this.cursors.set(userId, { x, y });
        this.emitThrottled();
    }

    removeCursor(userId: string): void {
        if (!this.cursors.has(userId)) return;
        this.cursors.delete(userId);
        this.emitThrottled();
    }

    clear(): void {
        if (this.cursors.size === 0) return;
        this.cursors.clear();
        this.emitThrottled();
    }

    getSnapshot(): RemoteCursorSnapshot {
        return new Map(this.cursors);
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}