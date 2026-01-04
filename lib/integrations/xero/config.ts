import "server-only";

const requiredEnv = [
  "XERO_CLIENT_ID",
  "XERO_CLIENT_SECRET",
  "XERO_REDIRECT_URI",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`${key} is not set`);
  }
}

export const xeroConfig = {
  clientId: process.env.XERO_CLIENT_ID as string,
  clientSecret: process.env.XERO_CLIENT_SECRET as string,
  redirectUri: process.env.XERO_REDIRECT_URI as string,
  authUrl: "https://login.xero.com/identity/connect/authorize",
  tokenUrl: "https://identity.xero.com/connect/token",
  connectionsUrl: "https://api.xero.com/connections",
  apiBaseUrl: "https://api.xero.com/api.xro/2.0",
};
