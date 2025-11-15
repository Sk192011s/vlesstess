// main.ts (The Correct "EDTunnel" Script)
// This is the complete script. It does NOT need a separate connect.ts file.

import { connect } from "https://deno.land/x/vless@v1.0.0/mod.ts";
import { serve } from "https://deno.land/std@0.184.0/http/server.ts";

// Set the vless uuid from Deno Deploy Environment Variables
const UUID = Deno.env.get("UUID") || "dba99842-a33e-4bd3-a183-26e4a690be03";

serve(async (req) => {
	const url = new URL(req.url);

	// Handle the VLESS WebSocket connection
	if (url.pathname.startsWith('/')) {
		// Check for the specific ?ed=2048 path
		if (url.searchParams.get('ed') === '2048') {
			// This is the VLESS connection
			return connect(req, UUID);
		} else {
			// This is the homepage (or other path), return the VLESS key
			const vlessKey = `vless://${UUID}@${url.hostname}:443?path=%2F%3Fed%3D2048&security=tls&encryption=none&host=${url.hostname}&fp=randomized&type=ws&sni=${url.hostname}#Deno-EDTunnel`;
			
			return new Response(`
        <h1>Welcome to your VLESS Server</h1>
        <p>Your Deno Deploy (Pro) server is running.</p>
        <p>Copy this key into V2Box:</p>
        <pre>${vlessKey}</pre>
      `, {
				status: 200,
				headers: { "Content-Type": "text/html" },
			});
		}
	}

	// Default 404
	return new Response("Not found", { status: 404 });
});
