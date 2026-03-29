import { Socket} from "socket.io-client";

import { ClientToServerEvents, ServerToClientEvents } from "drawers-shared";

interface SocketReservedEvents {
  connect: () => void;
  connect_error: (err: Error) => void;
  disconnect: (reason: string) => void;
  disconnecting: (reason: string) => void;
  newListener: (event: string | symbol, listener: (...args: any[]) => void) => void;
  removeListener: (event: string | symbol, listener: (...args: any[]) => void) => void;
}

type AllServerEvents = ServerToClientEvents & Partial<Pick<SocketReservedEvents, 'connect' | 'disconnect' | 'connect_error'>>;

export class TypedSocket {
  constructor(private socket: Socket<ServerToClientEvents, ClientToServerEvents>) {}

  on<T extends keyof AllServerEvents>(
    event: T,
    cb: AllServerEvents[T]
  ) {
    
    this.socket.on(event as any, cb as any); // cast needed due to Socket.io overloads
  }

  off<T extends keyof AllServerEvents>(
    event: T,
    cb: AllServerEvents[T]
  ) {
    this.socket.off(event as any, cb as any); // cast needed due to Socket.io overloads
  }

  emit<T extends keyof ClientToServerEvents>(
    event: T,
    ...args: Parameters<ClientToServerEvents[T]>
  ) {
    this.socket.emit(event, ...args);
  }

  disconnect(){
    this.socket.disconnect()
  }
}
