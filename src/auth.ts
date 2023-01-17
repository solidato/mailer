const AUTH_ERROR_TIMESTAMP_KEY = "authErrorTimestamp";

export async function fetchAccessToken(
  event: FetchEvent | ScheduledEvent
): Promise<string | undefined> {
  try {
    const authTokenResponse = await fetch(ZOHO_API_AUTH, {
      body: `client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&refresh_token=${ZOHO_REFRESH_TOKEN}&grant_type=refresh_token`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    if (authTokenResponse.status === 200) {
      event.waitUntil(NEOKINGDOM_NAMESPACE.put(AUTH_ERROR_TIMESTAMP_KEY, ""));
      return JSON.parse(await authTokenResponse.text())["access_token"];
    }

    throw new Error(await authTokenResponse.text());
  } catch (e) {
    console.error(e);
    event.waitUntil(
      NEOKINGDOM_NAMESPACE.put(AUTH_ERROR_TIMESTAMP_KEY, Date.now().toString())
    );
    return undefined;
  }
}

export async function getAuthErrorTimestamp(): Promise<string | null> {
  const value = await NEOKINGDOM_NAMESPACE.get(AUTH_ERROR_TIMESTAMP_KEY);
  if (value == "") {
    return null;
  }

  return value;
}
