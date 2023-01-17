import { ResolutionData, ContributorData, OfferData } from "./model";

const GRAPH_ERROR_TIMESTAMP_KEY = "graphErrorTimestamp";
const LAST_CREATE_TIMESTAMP_KEY = "lastCreateTimestamp";
const LAST_APPROVED_TIMESTAMP_KEY = "lastApprovedTimestamp";
const LAST_FETCHED_OFFER_TIMESTAMP_KEY = "lastFetchedOfferTimestamp";

const RESOLUTIONS_QUERY = (timestamp: string) => `
  query GetResolutions {
    resolutions(orderBy: createTimestamp, orderDirection: asc, where: {createTimestamp_gt: ${timestamp}}) {
      id
      createTimestamp
    }
  }
`;

const APPROVED_RESOLUTIONS_QUERY = (timestamp: string) => `
  query GetApprovedResolutions {
    resolutions(orderBy: approveTimestamp, orderDirection: asc, where: {approveTimestamp_gt: ${timestamp}}) {
      id
      approveTimestamp,
      resolutionType {
        noticePeriod
        votingPeriod
      }
    }
  }
`;

const NEW_OFFERS_QUERY = (timestamp: string) => `
  query GetNewOffers {
    offers(orderBy: createTimestamp, orderDirection: asc, where: {createTimestamp_gt: ${timestamp}}) {
      id
      from
      amount
      createTimestamp
    }
  }
`;

const VOTERS_QUERY = (resolutionId: string) => `
  query GetVoters {
    resolution(id: ${resolutionId}) {
      voters {
        address
      }
    }
  }
`;

const CONTRIBUTORS_QUERY = () => `
  query GetContributors {
    daoUsers {
      address
    }
  }
`;

type GraphOffers = Record<"offers", OfferData[]>;

type GraphResolutions = Record<"resolutions", ResolutionData[]>;

type GraphVoters = Record<"resolution", Record<"voters", ContributorData[]>>;
type GraphContributors = Record<"daoUsers", ContributorData[]>;
type GraphData =
  | GraphVoters
  | GraphResolutions
  | GraphOffers
  | GraphContributors;

type GraphResponse = Record<"data", GraphData>;
type GraphResponseError = Record<"errors", any[]>;

async function fetchFromGraphql(query: string) {
  const response = await fetch(SUBGRAPH_API, {
    method: "POST",
    body: JSON.stringify({
      query,
    }),
  });

  return response;
}

async function handleError(
  message: string,
  event: FetchEvent | ScheduledEvent
) {
  console.error(message);
  event.waitUntil(
    NEOKINGDOM_NAMESPACE.put(GRAPH_ERROR_TIMESTAMP_KEY, Date.now().toString())
  );
}

async function fetchData(
  event: FetchEvent | ScheduledEvent,
  query: string
): Promise<GraphData | undefined> {
  try {
    const response = await fetchFromGraphql(query);
    if (response.status !== 200) {
      throw new Error(await response.text());
    }

    const jsonBody = await response.json();
    const body = jsonBody as GraphResponse | GraphResponseError;

    if ("data" in body) {
      event.waitUntil(NEOKINGDOM_NAMESPACE.put(GRAPH_ERROR_TIMESTAMP_KEY, ""));
      return body.data;
    }

    throw new Error(JSON.stringify(jsonBody));
  } catch (e) {
    await handleError((e as Error).message, event);
    return undefined;
  }
}

export async function fetchLastCreatedResolutions(
  event: FetchEvent | ScheduledEvent
): Promise<ResolutionData[]> {
  let lastCreateTimestamp =
    (await NEOKINGDOM_NAMESPACE.get(LAST_CREATE_TIMESTAMP_KEY)) || "0";

  const data = (await fetchData(
    event,
    RESOLUTIONS_QUERY(lastCreateTimestamp)
  )) as GraphResolutions;
  const resolutions = data.resolutions as ResolutionData[];
  if (resolutions.length > 0) {
    lastCreateTimestamp = resolutions[resolutions.length - 1].createTimestamp!;
    event.waitUntil(
      NEOKINGDOM_NAMESPACE.put(LAST_CREATE_TIMESTAMP_KEY, lastCreateTimestamp)
    );
  }

  return resolutions;
}

export async function fetchApprovedResolutions(
  lastApprovedTimestamp: number,
  event: FetchEvent | ScheduledEvent
): Promise<ResolutionData[]> {
  const data = (await fetchData(
    event,
    APPROVED_RESOLUTIONS_QUERY(lastApprovedTimestamp.toString())
  )) as GraphResolutions;

  return data.resolutions as ResolutionData[];
}

export async function fetchLastApprovedResolutionIds(
  event: FetchEvent | ScheduledEvent
): Promise<ResolutionData[]> {
  let lastApprovedTimestamp =
    (await NEOKINGDOM_NAMESPACE.get(LAST_APPROVED_TIMESTAMP_KEY)) || "0";

  const resolutions = await fetchApprovedResolutions(
    parseInt(lastApprovedTimestamp),
    event
  );

  if (resolutions.length > 0) {
    lastApprovedTimestamp =
      resolutions[resolutions.length - 1].approveTimestamp!;
    event.waitUntil(
      NEOKINGDOM_NAMESPACE.put(
        LAST_APPROVED_TIMESTAMP_KEY,
        lastApprovedTimestamp
      )
    );
  }

  return resolutions;
}

export async function fetchVoters(
  event: FetchEvent | ScheduledEvent,
  resolutionId: string
): Promise<ContributorData[]> {
  const data = (await fetchData(
    event,
    VOTERS_QUERY(resolutionId)
  )) as GraphVoters;

  const voters = data.resolution.voters;

  return voters;
}

export async function fetchContributors(
  event: FetchEvent | ScheduledEvent
): Promise<ContributorData[]> {
  const data = (await fetchData(
    event,
    CONTRIBUTORS_QUERY()
  )) as GraphContributors;

  return data.daoUsers;
}

export async function fetchNewOffers(
  event: FetchEvent | ScheduledEvent
): Promise<OfferData[]> {
  let lastFetchedOfferTimestamp =
    (await NEOKINGDOM_NAMESPACE.get(LAST_FETCHED_OFFER_TIMESTAMP_KEY)) || "0";

  const data = (await fetchData(
    event,
    NEW_OFFERS_QUERY(lastFetchedOfferTimestamp)
  )) as GraphOffers;

  const offers = data.offers as OfferData[];
  if (offers.length > 0) {
    lastFetchedOfferTimestamp = offers[offers.length - 1].createTimestamp;
    event.waitUntil(
      NEOKINGDOM_NAMESPACE.put(
        LAST_FETCHED_OFFER_TIMESTAMP_KEY,
        lastFetchedOfferTimestamp
      )
    );
  }

  return offers;
}

export async function getGraphErrorTimestamp(): Promise<string | null> {
  const value = await NEOKINGDOM_NAMESPACE.get(GRAPH_ERROR_TIMESTAMP_KEY);
  if (value == "") {
    return null;
  }

  return value;
}
