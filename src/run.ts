import { createSignupServer, infrai } from "./developer_signup.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");
console.log(`starting developer signup gate with ${infrai.captcha.verify}`);
createSignupServer(key).listen(3000, () => console.log("POST /developer-tools/signup on http://localhost:3000"));
