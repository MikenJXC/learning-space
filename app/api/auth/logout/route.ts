import { checkOrigin, endSession, json } from "@/lib/auth";
export async function POST(request: Request) {
  const error = checkOrigin(request);
  if (error) return error;
  await endSession();
  return json({ signedOut: true });
}
