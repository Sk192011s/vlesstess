// main.ts (Fixed Import Link)
import { serve } from "https://deno.land/std@0.184.0/http/server.ts";

// (FIX) This is the new, working import link
import { connect } from "https://raw.githubusercontent.com/zizifn/edgetunnel/main/deno/connect.ts";

// Deno Deploy ရဲ့ Environment Variable ကနေ UUID ကို ယူပါ
const UUID = Deno.env.get("UUID") || "dba99842-a33e-4bd3-a183-26e4a690be03";

serve((req: Request) => {
  return connect(req, UUID);
});
