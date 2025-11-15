// main.ts
import { serve } from "https://deno.land/std@0.184.0/http/server.ts";

// Import from the local file in your own repo
import { connect } from "./connect.ts";

const UUID = Deno.env.get("UUID") || "dba99842-a33e-4bd3-a183-26e4a690be03";

serve((req: Request) => {
  return connect(req, UUID);
});
