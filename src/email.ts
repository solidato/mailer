import { ResolutionData } from "./model";

const FAILED_PRE_DRAFT_KEY = "notEmailedResolutionIds";
const FAILED_APPROVED_RESOLUTION_EMAILS_KEY = "notEmailedVotingResolutionIds";
const FAILED_VOTING_START_EMAILS_KEY = "notEmailedVotingStartResolutionIds";

async function sendEmail(
  to: string,
  cc: string,
  subject: string,
  body: string
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
          cc: Array.from(ccUnique).map((email) => {
            return {
              email: email,
            };
          }),
        },
      ],
      from: {
        email: EMAIL_FROM,
        name: "Neokingdom DAO",
      },
      subject: subject,
      content: [
        {
          type: "text/html",
          value: body,
        },
      ],
    }),
  });

  return await fetch(sendRequest);
}

const bodyTemplate1 = `<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body style="font-family:'Courier New'">`;

const bodyTemplate2 = `<br/>
Cheers,<br/>
The Oracle
<br/>
<br/>
<img src="https://raw.githubusercontent.com/NeokingdomDAO/mailer/main/assets/logo.jpeg" width="160" height="87" border="0">
</body>
</html>`;

function buildEmailPage(content: string) {
  return `${bodyTemplate1}${content}${bodyTemplate2}`;
}

async function sendPreDraftEmail(resolutionId: string) {
  const body = buildEmailPage(
    `<p>Dear Board Member,</p><p>a new pre-draft resolution has been created.<br/>Would you mind <a href="${DAO_URL}/resolutions/${resolutionId}/edit">reviewing it?</a></p>`
  );
  return await sendEmail(EMAIL_TO, EMAIL_CC, "New Pre-Draft to Review", body);
}

async function sendToContributors(
  contributors: string[],
  content: string,
  subject: string
) {
  if (contributors.length == 0) {
    throw new Error(`No recipients.`);
  }

  const body = buildEmailPage(content);

  return await sendEmail(EMAIL_TO, contributors.join(","), subject, body);
}

async function sendNewOffersEmail(contributors: string[]) {
  return await sendToContributors(
    contributors,
    `<p>Dear Contributor,</p> 
      <p>new GovernanceTokens have been offered internally.<br/>
      If you are interested in an exchange, please check them out <a href="${DAO_URL}/tokens">in the token page.</a>
      </p>`,
    "New GovernanceToken offers"
  );
}

async function sendVotingStartsEmail(
  resolutionId: string,
  contributors: string[]
) {
  return await sendToContributors(
    contributors,
    `<p>Dear Contributor,</p> 
      <p>The voting for <a href="${DAO_URL}/resolutions/${resolutionId}">the resolution #${resolutionId}</a> starts now!<br/>
      Please cast your vote before its expiration.
      </p>`,
    "Voting starts!"
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
  const content = `<p>Dear Contributor,</p><p>a new resolution has been approved.<br/>The polls open ${votingStartsString}. Remember to cast your vote then.<br>You can find more details <a href="${DAO_URL}/resolutions/${resolutionId}">on the resolution page.</a></p>`;

  return await sendToContributors(
    voters,
    content,
    "New Draft Resolution approved"
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
  const notEmailedResolutions = await NEOKINGDOM_NAMESPACE.get(key);
  var ids: ResolutionData[] = [];
  if (notEmailedResolutions != null) {
    ids = JSON.parse(notEmailedResolutions) as ResolutionData[];
  }

  return ids;
}

export async function sendPreDraftEmails(
  resolutions: ResolutionData[],
  event: FetchEvent | ScheduledEvent
) {
  const failedIds: string[] = await sendEmails(
    resolutions.map((r) => r.id),
    async (id: string) => {
      return await sendPreDraftEmail(id);
    }
  );

  event.waitUntil(
    NEOKINGDOM_NAMESPACE.put(FAILED_PRE_DRAFT_KEY, JSON.stringify(failedIds))
  );

  return failedIds;
}

export async function sendNewOffersEmails(
  contributors: string[],
  event: FetchEvent | ScheduledEvent
) {
  await sendNewOffersEmail(contributors);
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
    NEOKINGDOM_NAMESPACE.put(
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
    NEOKINGDOM_NAMESPACE.put(
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
