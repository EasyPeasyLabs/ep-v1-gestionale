// FIX: Updated imports and function definitions to align with Firebase Functions v2 SDK.
// Replaced `functions.config()` with `defineString` for environment configuration
// and adopted the v2 syntax for onRequest HTTPS functions.
// FIX: Corrected import paths. Both Request and Response for v2 `onRequest`
// must be from the `firebase-functions/v2/https` module. The previous `Response`
// import was from the v1 SDK, causing type errors.
// FINAL FIX: Replaced `defineString` with `process.env` to prevent deployment timeouts
// caused by parameter initialization. Secrets must now be set via `firebase functions:secrets:set`.
// FIX: Explicitly import Request and Response types from the v2 SDK to resolve
// type inference issues with Express-like properties (`.query`, `.status`, `.redirect`).
// FIX: Removed explicit `Request` and `Response` imports. `Response` is not exported
// from 'firebase-functions/v2/https' and relying on type inference is the correct
// approach for v2 Cloud Functions. This resolves both reported errors.
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {google} from "googleapis";

admin.initializeApp();
const db = admin.firestore();

export const googleAuthCallback = onRequest(
  {
    region: "europe-west1",
    // Make sure the secrets are available to the function
    secrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APP_REDIRECT_URL"],
  },
  // FIX: Removed explicit types for `req` and `res` to allow for correct type inference.
  async (req, res) => {
    // Access secrets via process.env. This is the most reliable way.
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const appRedirectUrl = process.env.APP_REDIRECT_URL;
    
    // The URL of this function itself for Google to call back to.
    const functionRedirectUrl = `https://europe-west1-ep-gestionale-v1.cloudfunctions.net/googleAuthCallback`;

    if (!clientId || !clientSecret || !appRedirectUrl) {
        logger.error("Client ID, Secret, or App Redirect URL are not configured in the environment.");
        res.status(500).send("Configuration error on the server.");
        return;
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      functionRedirectUrl,
    );
      
    const code = req.query.code as string;

    if (!code) {
        logger.error("Authorization code not received from Google.");
        res.redirect(`${appRedirectUrl}?auth_error=true&message=MissingCode`);
        return;
    }

    try {
      const {tokens} = await oauth2Client.getToken(code);
      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token;

      if (!accessToken || !refreshToken) {
        throw new Error("Token non ricevuti da Google.");
      }

      const configRef = db.collection("configurazione").doc("main");
      await configRef.set({
        gmailConnected: true,
        gmailTokens: {
          accessToken,
          refreshToken,
          expiry_date: tokens.expiry_date,
        },
      }, {merge: true});

      // Redirect the user back to the app's configuration page
      res.redirect(`${appRedirectUrl}?app=Configurazione&auth_success=true`);
    } catch (error) {
      logger.error("Errore durante l'autenticazione Google:", error);
      res.redirect(`${appRedirectUrl}?auth_error=true`);
    }
  },
);
