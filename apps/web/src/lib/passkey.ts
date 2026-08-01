import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import {
  beginPasskeyRegistration,
  verifyPasskeyRegistration,
  beginPasskeyLogin,
  verifyPasskeyLogin,
  type IssuedSession,
  type PasskeySummary,
} from "./api";

/**
 * Runs the full registration ceremony: fetch options from the server,
 * hand them to the browser's WebAuthn API (the part that actually shows
 * the "use your fingerprint/PIN" prompt), then send the signed response
 * back to be verified and stored. Throws whatever the browser throws if
 * the user cancels the prompt — callers show that message as-is.
 */
export async function registerPasskey(
  deviceLabel?: string,
): Promise<PasskeySummary> {
  const { options, challengeId } = await beginPasskeyRegistration();
  const response = await startRegistration({ optionsJSON: options });
  return verifyPasskeyRegistration(challengeId, response, deviceLabel);
}

/**
 * Usernameless sign-in — the browser prompts with whatever passkeys it
 * has saved for this site before the server knows who's signing in.
 */
export async function loginWithPasskey(): Promise<IssuedSession> {
  const { options, challengeId } = await beginPasskeyLogin();
  const response = await startAuthentication({ optionsJSON: options });
  return verifyPasskeyLogin(challengeId, response);
}

export { browserSupportsWebAuthn } from "@simplewebauthn/browser";
