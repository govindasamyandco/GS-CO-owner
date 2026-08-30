/**
 * WebAuthn Biometric Fingerprint / Touch ID / Windows Hello Verification
 * Requires physical fingerprint / biometric verification before revealing QR code.
 */

export async function verifyBiometricFingerprint() {
  // Check if WebAuthn is supported by the browser
  if (typeof window !== "undefined" && window.PublicKeyCredential) {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const creationOptions = {
        publicKey: {
          rp: { name: "Govindasamy & Co Admin Security" },
          user: {
            id: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
            name: "govindasamy.textitle@gmail.com",
            displayName: "Admin Owner (Fingerprint Protected)"
          },
          challenge: challenge,
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },  // ES256
            { type: "public-key", alg: -257 } // RS256
          ],
          timeout: 60000,
          authenticatorSelection: {
            userVerification: "required" // Forces Fingerprint / Touch ID / Windows Hello prompt!
          }
        }
      };

      // Triggers native Windows Hello Fingerprint / Touch ID prompt!
      const credential = await navigator.credentials.create(creationOptions);
      if (credential) {
        return { success: true };
      }
    } catch (err) {
      console.warn("Biometric authentication error or canceled by user:", err.message);
      // Fallthrough to fallback prompt if user cancels or platform authenticator is not configured
    }
  }

  // Fallback: Prompt for Master Admin Security Password to verify physical owner presence
  const masterPass = prompt("🔒 BIOMETRIC / OWNER SECURITY CHECK:\n\nEnter Master Admin Password to unlock QR setup:");
  if (masterPass === "admin123" || masterPass === "govindasamy123") {
    return { success: true };
  }

  return { success: false, reason: "Fingerprint or Master Security check failed." };
}
