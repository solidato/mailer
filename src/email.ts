import { ResolutionData } from "./model";

const FAILED_PRE_DRAFT_KEY = "notEmailedResolutionIds";
const FAILED_APPROVED_RESOLUTION_EMAILS_KEY = "notEmailedVotingResolutionIds";
const FAILED_VOTING_START_EMAILS_KEY = "notEmailedVotingStartResolutionIds";

async function sendEmail(
  to: string,
  cc: string,
  dynamicData: Record<string, string>,
  templateId: string
) {
  const ccUnique = new Set(cc.split(","));
  ccUnique.delete(to);
  const sendRequest = new Request("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }],
          bcc: Array.from(ccUnique).map((email) => {
            return {
              email: email,
            };
          }),
          dynamic_template_data: dynamicData,
        },
      ],
      template_id: templateId,
      from: {
        email: EMAIL_FROM,
        name: "Solidato OÜ",
      },
    }),
  });

  return await fetch(sendRequest);
}

async function sendPreDraftEmail(resolutionId: string, to: string) {
  return await sendEmail(
    to,
    EMAIL_CC,
    {
      resolutionUrl: `${DAO_URL}/resolutions/${resolutionId}/edit`,
    },
    "d-4ca5e4b4a7804f08b81055d98200b1af"
  );
}

async function sendToContributors(
  contributors: string[],
  dynamicData: Record<string, string>,
  templateId: string
) {
  if (contributors.length == 0) {
    throw new Error(`No recipients.`);
  }

  return await sendEmail(
    contributors.join(","),
    EMAIL_CC,
    dynamicData,
    templateId
  );
}

async function sendVotingStartsEmail(
  resolutionId: string,
  contributors: string[]
) {
  return await sendToContributors(
    contributors,
    {
      resolutionNumber: resolutionId,
      resolutionUrl: `${DAO_URL}/resolutions/${resolutionId}`,
    },
    "d-c2de24efba85473582d9f5542b1996ac"
  );
}

async function sendResolutionApprovedEmail(
  resolutionId: string,
  voters: string[],
  votingStarts: number
) {
  let date = new Date();
  date.setTime(votingStarts * 1000);
  const votingStartsString = date.toUTCString();

  return await sendToContributors(
    voters,
    {
      votingStartsString: votingStartsString,
      resolutionUrl: `${DAO_URL}/resolutions/${resolutionId}`,
    },
    "d-0edd2029edd0443583617bf0d9151930"
  );
}

async function sendEmails(
  ids: string[],
  sendMailFunc: (id: string) => Promise<Response>
) {
  const failedIds: string[] = [];
  await Promise.all(
    ids.map(async (resolutionId) => {
      try {
        const response = await sendMailFunc(resolutionId);
        if (![200, 202].includes(response.status)) {
          failedIds!.push(resolutionId);
          console.error(await response.text());
        } else {
          console.log(`Email for resolution ${resolutionId} sent.`);
        }
      } catch (e) {
        failedIds!.push(resolutionId);
        console.error(e);
      }
    })
  );

  return failedIds;
}

export async function getFailedEmailResolutions(key: string) {
  const notEmailedResolutions = await SOLIDATO_NAMESPACE.get(key);
  var ids: ResolutionData[] = [];
  if (notEmailedResolutions != null) {
    ids = JSON.parse(notEmailedResolutions) as ResolutionData[];
  }

  return ids;
}

export async function sendPreDraftEmails(
  resolutionReceiversMap: Record<string, string>,
  event: FetchEvent | ScheduledEvent
) {
  const failedIds: string[] = await sendEmails(
    Object.keys(resolutionReceiversMap),
    async (id: string) => {
      return await sendPreDraftEmail(id, resolutionReceiversMap[id][0]);
    }
  );

  event.waitUntil(
    SOLIDATO_NAMESPACE.put(FAILED_PRE_DRAFT_KEY, JSON.stringify(failedIds))
  );

  return failedIds;
}

export async function sendResolutionApprovedEmails(
  resolutionVotersMap: any,
  resolutions: ResolutionData[],
  event: FetchEvent | ScheduledEvent
) {
  const failedIds: string[] = await sendEmails(
    Object.keys(resolutionVotersMap),
    async (id: string) => {
      return await sendResolutionApprovedEmail(
        id,
        resolutionVotersMap[id],
        parseInt(resolutions.filter((r) => r.id == id)[0].votingStarts!)
      );
    }
  );

  const failedResolutions = resolutions.filter((r) => failedIds.includes(r.id));
  event.waitUntil(
    SOLIDATO_NAMESPACE.put(
      FAILED_APPROVED_RESOLUTION_EMAILS_KEY,
      JSON.stringify(failedResolutions)
    )
  );

  return failedIds;
}

export async function sendVotingStartsEmails(
  resolutionVotersMap: any,
  resolutions: ResolutionData[],
  event: FetchEvent | ScheduledEvent
) {
  const failedIds: string[] = await sendEmails(
    Object.keys(resolutionVotersMap),
    async (id: string) => {
      return await sendVotingStartsEmail(id, resolutionVotersMap[id]);
    }
  );

  const failedResolutions = resolutions.filter((r) => failedIds.includes(r.id));
  event.waitUntil(
    SOLIDATO_NAMESPACE.put(
      FAILED_VOTING_START_EMAILS_KEY,
      JSON.stringify(failedResolutions)
    )
  );

  return failedIds;
}

export async function getFailedPreDraftEmailResolution() {
  return getFailedEmailResolutions(FAILED_PRE_DRAFT_KEY);
}

export async function getFailedApprovedEmailResolutions() {
  return getFailedEmailResolutions(FAILED_APPROVED_RESOLUTION_EMAILS_KEY);
}

export async function getFailedVotingStartEmailResolutions() {
  return getFailedEmailResolutions(FAILED_VOTING_START_EMAILS_KEY);
}
