//import { handleRequest } from './handler'
import {
  getFailedPreDraftEmailResolution,
  getFailedApprovedEmailResolutions,
  getFailedVotingStartEmailResolutions,
} from "../email";
import { getGraphErrorTimestamp } from "../graph";
import { getOdooErrorTimestamp } from "../odoo";

export async function handleEmailHealth() {
  const notEmailedResolutionIds = (await getFailedPreDraftEmailResolution())
    .concat(await getFailedApprovedEmailResolutions())
    .concat(await getFailedVotingStartEmailResolutions())
    .map((r) => r.id);
  if (notEmailedResolutionIds.length === 0) {
    return new Response("OK");
  } else {
    return new Response(
      `${notEmailedResolutionIds.length} emails weren't sent. Check the logs for details`,
      {
        status: 500,
      }
    );
  }
}

export async function handleOdooHealth() {
  const graphVotersErrorTimestamp = await getOdooErrorTimestamp();
  if (graphVotersErrorTimestamp === null) {
    return new Response("OK");
  } else {
    return new Response(
      "Can't communicate with Odoo. Either login or user fetching are broken. Check the logs for more details.",
      {
        status: 500,
      }
    );
  }
}

export async function handleGraphHealth() {
  const graphErrorTimestamp = await getGraphErrorTimestamp();
  if (graphErrorTimestamp === null) {
    return new Response("OK");
  } else {
    return new Response("Can't connect to graph. Check logs for details.", {
      status: 500,
    });
  }
}
