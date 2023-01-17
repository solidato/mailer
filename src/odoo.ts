import { v4 as uuidv4 } from "uuid";

const ODOO_ERROR_TIMESTAMP_KEY = "odooErrorTimestamp";

type OdooResponse = {
  result: any;
  jsonrpc: "2.0";
  id: string;
};

type OdooErrorData = {
  message: string;
  arguments: any;
  debug: string;
  exception_type: string;
  name: string;
};

type OdooError = {
  message: string;
  http_status: number;
  data: OdooErrorData;
  code: number;
};

type OdooResponseError = {
  jsonrpc: "2.0";
  id: string;
  error: OdooError;
};

type OdooRequest = {
  jsonrpc: string;
  method: string;
  params: any;
  id: string;
};

async function call(
  event: FetchEvent | ScheduledEvent,
  request: OdooRequest
): Promise<OdooResponse | undefined> {
  try {
    const response = await fetch(ODOO_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      redirect: "follow",
      body: JSON.stringify(request),
    });

    const json = (await response.json()) as OdooResponse | OdooResponseError;

    if ("error" in json) {
      throw new Error(json.error.message);
    } else {
      if (json.result !== false) {
        event.waitUntil(NEOKINGDOM_NAMESPACE.put(ODOO_ERROR_TIMESTAMP_KEY, ""));
        return json;
      } else {
        throw new Error("Odoo returned a 'false' response");
      }
    }
  } catch (e) {
    console.error(e);
    event.waitUntil(
      NEOKINGDOM_NAMESPACE.put(ODOO_ERROR_TIMESTAMP_KEY, Date.now().toString())
    );
    return undefined;
  }
}

async function login(event: FetchEvent | ScheduledEvent) {
  const loginRequest = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "common",
      method: "login",
      args: ["teledisko", ODOO_USERNAME, ODOO_PASSWORD],
    },
    id: uuidv4(),
  };

  const json = await call(event, loginRequest);
  return json;
}

async function users(
  event: FetchEvent | ScheduledEvent,
  loginId: string,
  requestId: number
) {
  const usersRequest = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        "teledisko",
        requestId,
        ODOO_PASSWORD,
        "res.users",
        "search_read",
        [[]],
        {},
      ],
    },
    id: loginId,
  };

  const json = await call(event, usersRequest);

  return json;
}

export async function fetchOdooUsers(event: FetchEvent | ScheduledEvent) {
  // Login
  // Login with user name, then with UID e password
  const response = await login(event);
  const loginUID = response?.id;
  const requestId = response?.result as number;

  let ehtEmailsMap: any = {};
  if (loginUID) {
    const respnoseUsers = await users(event, loginUID, requestId);
    respnoseUsers?.result
      .filter((r: any) => r["ethereum_address"])
      .forEach(
        (r: any) =>
          (ehtEmailsMap[r["ethereum_address"].toLowerCase()] = r["email"])
      );
  }

  return ehtEmailsMap;
}

export async function getOdooErrorTimestamp(): Promise<string | null> {
  const value = await NEOKINGDOM_NAMESPACE.get(ODOO_ERROR_TIMESTAMP_KEY);
  if (value == "") {
    return null;
  }

  return value;
}
