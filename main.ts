// main.ts
import { serve } from "https://deno.land/std@0.184.0/http/server.ts";

// (NEW FIX) Using a different, active repository
import { connect } in "https://raw.githubusercontent.com/3Kmfi6HP/EDtunnel/main/deno/connect.ts";

const UUID = Deno.env.get("UUID") || "dba99842-a33e-4bd3-a183-26e4a690be03";

serve((req: Request) => {
  return connect(req, UUID);
});
