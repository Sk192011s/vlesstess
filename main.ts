// main.ts
import { serve } from "https://deno.land/std@0.184.0/http/server.ts";
import { connect } from "https://deno.land/x/vless@v1.0.0/mod.ts";

const UUID = Deno.env.get("UUID") || "dba99842-a33e-4bd3-a183-26e4a690be03";

serve((req: Request) => {
  return connect(req, UUID);
});
