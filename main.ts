// main.ts (The Ultimate Fix)
import { serve } from "https://deno.land/std@0.184.0/http/server.ts";

// (FIX 1) Import from the local file, not a dead URL
import { connect } from "./connect.ts";

const UUID = Deno.env.get("UUID") || "dba99842-a33e-4bd3-a183-26e4a690be03";

serve(async (req) => {
	const url = new URL(req.url);

	// (FIX 2) Add the "ed=2048" logic to prevent Timeouts
	if (url.pathname.startsWith('/') && url.searchParams.get('ed') === '2048') {
		// This is the VLESS connection
		return connect(req, UUID);
	}

	// Homepage / Other paths
	const vlessKey = `vless://${UUID}@${url.hostname}:443?path=%2F%3Fed%3D2048&security=tls&encryption=none&host=${url.hostname}&fp=randomized&type=ws&sni=${url.hostname}#Deno-EDTunnel`;
	
	return new Response(`
    <h1>Welcome to your VLESS Server (Fixed)</h1>
    <p>Your Deno Deploy (Pro) server is running.</p>
    <p>Copy this key into V2Box:</p>
    <pre>${vlessKey}</pre>
  `, {
		status: 200,
		headers: { "Content-Type": "text/html" },
	});
});
