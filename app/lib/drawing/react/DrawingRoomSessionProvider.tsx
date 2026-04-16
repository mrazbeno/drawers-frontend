"use client";

import * as React from "react";
import { io } from "socket.io-client";
import type { ReactNode } from "react";
import type { RoomUsers, ServerToClientEvents } from "drawers-shared";
import { TypedSocket } from "@/app/lib/TypedSocket";

type JoinRoomParams = {
  roomId: string;
  username: string;
};

type DrawingRoomSessionContextValue = {
  socket: TypedSocket | null;
  roomId: string;
  thisUserId: string;
  ownUsername: string;
  isConnected: boolean;
  isJoined: boolean;
  joinRoom: (params: JoinRoomParams) => Promise<{ myId: string }>;
  fetchUsers: () => Promise<{ users: RoomUsers; hostId: string }>;
  disconnect: () => void;
};

const DrawingRoomSessionContext =
  React.createContext<DrawingRoomSessionContextValue | null>(null);

function createTypedSocket() {
  return new TypedSocket(
    io(process.env.NEXT_PUBLIC_WS_URL!, {
      transports: ["websocket"],
    })
  );
}

export function DrawingRoomSessionProvider({ children }: { children: ReactNode }) {
  const socketRef = React.useRef<TypedSocket | null>(null);

  const [socketState, setSocketState] = React.useState<TypedSocket | null>(null);
  const [roomId, setRoomId] = React.useState("");
  const [thisUserId, setThisUserId] = React.useState("");
  const [ownUsername, setOwnUsername] = React.useState("");

  const ensureSocket = React.useCallback(() => {
    if (socketRef.current) return socketRef.current;

    const socket = createTypedSocket();

    socket.on("disconnect", () => {
      setSocketState(null);
      setThisUserId("");
      setRoomId("")
      setOwnUsername("");
    });

    socketRef.current = socket;
    setSocketState(socket);
    return socket;
  }, []);

  const joinRoom = React.useCallback(
    ({ roomId, username }: JoinRoomParams) => {
      const socket = ensureSocket();

      return new Promise<{ myId: string }>((resolve, reject) => {
        const handleSuccess: ServerToClientEvents["join_success"] = (myId) => {
          cleanup();
          setRoomId(roomId);
          setOwnUsername(username);
          setThisUserId(myId);
          resolve({ myId });
        };

        const handleError: ServerToClientEvents["join_error"] = (message) => {
          cleanup();
          reject(new Error(String(message)));
        };

        const cleanup = () => {
          socket.off("join_success", handleSuccess);
          socket.off("join_error", handleError);
        };

        socket.on("join_success", handleSuccess);
        socket.on("join_error", handleError);
        socket.emit("join_room", { roomId, username });
      });
    },
    [ensureSocket]
  );

  const fetchUsers = React.useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) throw new Error("Socket is not connected.");
    if (!roomId) throw new Error("No active room.");

    return new Promise<{ users: RoomUsers; hostId: string }>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        socket.off("return_users", handleUsers);
        reject(new Error("Fetch users request timed out. (10s)"));
      }, 10_000);

      const handleUsers = (users: RoomUsers, hostId: string) => {
        clearTimeout(timeout);
        socket.off("return_users", handleUsers);
        resolve({ users, hostId });
      };

      socket.on("return_users", handleUsers);
      socket.emit("fetch_users", roomId);
    });
  }, [roomId]);

  const disconnect = React.useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocketState(null);
    setRoomId("");
    setThisUserId("");
    setOwnUsername("");
  }, []);

  React.useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const value = React.useMemo(
    () => ({
      socket: socketState,
      roomId,
      thisUserId,
      ownUsername,
      isConnected: !!socketState,
      isJoined: !!socketState && !!roomId && !!thisUserId,
      joinRoom,
      fetchUsers,
      disconnect,
    }),
    [socketState, roomId, thisUserId, ownUsername, joinRoom, fetchUsers, disconnect]
  );

  return (
    <DrawingRoomSessionContext.Provider value={value}>
      {children}
    </DrawingRoomSessionContext.Provider>
  );
}

export function useDrawingRoomSession() {
  const ctx = React.useContext(DrawingRoomSessionContext);
  if (!ctx) {
    throw new Error("useDrawingRoomSession must be used within DrawingRoomSessionProvider");
  }
  return ctx;
}