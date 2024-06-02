const BACKEND_ERROR_TIMESTAMP_KEY = "backendErrorTimestamp";

type BackendErrorResponse = {
  message: string;
};

type BackendResponse = BackendUser[];

type BackendUser = {
  address: string;
  status: BackendUserStatus;
  user: BackendUserDetails;
};

type BackendUserDetails = {
  id: number;
  name: string;
  email: string;
  ethAddress: string;
};

type BackendUserStatus =
  | "Board Member"
  | "Active Shareholder"
  | "Passive Shareholder";

async function call(
  event: FetchEvent | ScheduledEvent
): Promise<BackendResponse | undefined> {
  try {
    const response = await fetch(BACKEND_API, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BACKEND_API_KEY}`,
      },
      redirect: "follow",
    });

    const json = (await response.json()) as
      | BackendResponse
      | BackendErrorResponse;

    if ("message" in json) {
      event.waitUntil(SOLIDATO_NAMESPACE.put(BACKEND_ERROR_TIMESTAMP_KEY, ""));
      return undefined;
    } else {
      return json;
    }
  } catch (e) {
    console.error(e);
    event.waitUntil(
      SOLIDATO_NAMESPACE.put(BACKEND_ERROR_TIMESTAMP_KEY, Date.now().toString())
    );
    return undefined;
  }
}

async function users(event: FetchEvent | ScheduledEvent) {
  const json = await call(event);

  return json;
}

export async function fetchUsers(event: FetchEvent | ScheduledEvent) {
  const respnoseUsers = await users(event);
  let ethEmailsMap: Record<string, string> = {};
  respnoseUsers
    ?.filter((r: any) => r["address"])
    .forEach(
      (r: any) =>
        (ethEmailsMap[r["address"].toLowerCase()] = r["user"]["email"])
    );

  return ethEmailsMap;
}

export async function getBackendErrorTimestamp(): Promise<string | null> {
  const value = await SOLIDATO_NAMESPACE.get(BACKEND_ERROR_TIMESTAMP_KEY);
  if (value == "") {
    return null;
  }

  return value;
}
