// connect.ts
// This is the VLESS library code.
// Keep this file in your repo.

import {
  readableStreamFromIterable,
  writableStreamFromWriter,
} from "https://deno.land/std@0.184.0/streams/mod.ts";
import {
  writeAll,
} from "https://deno.land/std@0.184.0/streams/write_all.ts";

const VLESS_VERSION = new Uint8Array([0, 0]);
const VLESS_ADDON_LENGTH = new Uint8Array([0]);

const VLESS_CMD = {
  CONNECT: 0x01,
};

const VLESS_ATYP = {
  IPV4: 0x01,
  DOMAIN: 0x02,
  IPV6: 0x03,
};

interface Options {
  uuid: string;
  proxyIP?: string;
  proxyPort?: number;
}

const defaultOptions: Options = {
  uuid: "00000000-0000-0000-0000-000000000000",
  proxyIP: "1.1.1.1",
  proxyPort: 80,
};

async function readVlessHeader(reader: Deno.Reader, uuid: string) {
  const version = new Uint8Array(2);
  if ((await reader.read(version)) === null) {
    throw new Error("Invalid VLESS header: Version read failed");
  }
  if (version[0] !== VLESS_VERSION[0] || version[1] !== VLESS_VERSION[1]) {
    throw new Error("Invalid VLESS header: Invalid version");
  }

  const uuidBytes = new Uint8Array(16);
  if ((await reader.read(uuidBytes)) === null) {
    throw new Error("Invalid VLESS header: UUID read failed");
  }
  const uuidStr = bytesToUUID(uuidBytes);
  if (uuidStr !== uuid) {
    throw new Error("Invalid VLESS header: UUID mismatch");
  }

  const addonLen = new Uint8Array(1);
  if ((await reader.read(addonLen)) === null) {
    throw new Error("Invalid VLESS header: Addon length read failed");
  }
  if (addonLen[0] !== VLESS_ADDON_LENGTH[0]) {
    const addon = new Uint8Array(addonLen[0]);
    if ((await reader.read(addon)) === null) {
      throw new Error("Invalid VLESS header: Addon read failed");
    }
  }

  const cmd = new Uint8Array(1);
  if ((await reader.read(cmd)) === null) {
    throw new Error("Invalid VLESS header: Command read failed");
  }
  if (cmd[0] !== VLESS_CMD.CONNECT) {
    throw new Error("Invalid VLESS command: Only CONNECT is supported");
  }

  const port = new Uint8Array(2);
  if ((await reader.read(port)) === null) {
    throw new Error("Invalid VLESS header: Port read failed");
  }
  const portNum = (port[0] << 8) | port[1];

  const atyp = new Uint8Array(1);
  if ((await reader.read(atyp)) === null) {
    throw new Error("Invalid VLESS header: Address type read failed");
  }

  let host: string;
  if (atyp[0] === VLESS_ATYP.IPV4) {
    const addr = new Uint8Array(4);
    if ((await reader.read(addr)) === null) {
      throw new Error("Invalid VLESS header: IPv4 address read failed");
    }
    host = `${addr[0]}.${addr[1]}.${addr[2]}.${addr[3]}`;
  } else if (atyp[0] === VLESS_ATYP.DOMAIN) {
    const len = new Uint8Array(1);
    if ((await reader.read(len)) === null) {
      throw new Error("Invalid VLESS header: Domain length read failed");
    }
    const domain = new Uint8Array(len[0]);
    if ((await reader.read(domain)) === null) {
      throw new Error("Invalid VLESS header: Domain read failed");
    }
    host = new TextDecoder().decode(domain);
  } else if (atyp[0] === VLESS_ATYP.IPV6) {
    const addr = new Uint8Array(16);
    if ((await reader.read(addr)) === null) {
      throw new Error("Invalid VLESS header: IPv6 address read failed");
    }
    const parts = [];
    for (let i = 0; i < 16; i += 2) {
      parts.push(((addr[i] << 8) | addr[i + 1]).toString(16));
    }
    host = parts.join(":");
  } else {
    throw new Error("Invalid VLESS header: Unknown address type");
  }

  return { host, port: portNum };
}

async function connect(req: Request, uuid: string) {
  const upgrade = req.headers.get("Upgrade");
  if (upgrade?.toLowerCase() !== "websocket") {
    return new Response("This is a VLESS proxy server.");
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = async () => {
    let earlyData: Uint8Array | null = null;
    const readable = readableStreamFromIterable((async function* () {
      let yielded = false;
      while (!yielded) {
        if (earlyData) {
          yield earlyData;
          earlyData = null;
          yielded = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    })());
    
    const reader = readable.getReader();
    
    socket.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        earlyData = new Uint8Array(e.data);
      } else if (typeof e.data === "string") {
        // Handle text data
      }
    };

    let { host, port } = await readVlessHeader(reader as any, uuid);

    if (host.endsWith(".workers.dev") || host.endsWith(".pages.dev")) {
       host = defaultOptions.proxyIP as string;
       port = defaultOptions.proxyPort as number;
    }
    
    reader.releaseLock();

    try {
      const conn = await Deno.connect({ hostname: host, port });

      const connWriter = writableStreamFromWriter(conn);
      const writer = connWriter.getWriter();

      await writer.write(VLESS_VERSION);
      writer.releaseLock();
      
      const readableFromSocket = new ReadableStream({
        start(controller) {
          socket.onmessage = (e) => {
            if (e.data instanceof ArrayBuffer) {
              controller.enqueue(new Uint8Array(e.data));
            }
          };
          socket.onclose = () => controller.close();
          socket.onerror = (e) => controller.error(e);
        },
      });

      await readableFromSocket.pipeTo(connWriter, { preventClose: true });
      
      const writableToSocket = new WritableStream({
        write(chunk) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(chunk);
          }
        },
        close() {
          socket.close();
        },
        abort(e) {
          socket.close(1000, e.message);
        }
      });

      await conn.readable.pipeTo(writableToSocket);
      
    } catch (e) {
      console.error("Failed to connect to target:", e.message);
      socket.close(1000, "Connection failed");
    }
  };

  socket.onerror = (e) => {
    console.error("WebSocket error:", (e as ErrorEvent).message);
  };

  return response;
}

function bytesToUUID(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export { connect };
