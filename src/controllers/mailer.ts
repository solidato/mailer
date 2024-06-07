import {
  sendPreDraftEmails,
  sendResolutionApprovedEmails,
  getFailedPreDraftEmailResolution,
  getFailedApprovedEmailResolutions,
  sendVotingStartsEmails,
  getFailedVotingStartEmailResolutions,
} from "../email";
import {
  fetchLastCreatedResolutions,
  fetchLastApprovedResolutionIds,
  fetchApprovedResolutions,
} from "../graph";
import { ResolutionData } from "../model";

export async function handleCreatedResolutions(
  event: FetchEvent | ScheduledEvent,
  ethToEmails: Record<string, string>
) {
  const resolutions = await fetchLastCreatedResolutions(event);

  const previousFailedIds = await getFailedPreDraftEmailResolution();

  const resolutionReceiversMap: any = {};
  await Promise.all(
    resolutions
      .concat(previousFailedIds)
      .map(async (resolution: ResolutionData) => {
        // For the demo, emails are sent only to the resolution creator
        const receivers: Record<"address", string>[] = [
          { address: resolution.createBy! },
        ];
        const emails = receivers
          .map((receiver) => ethToEmails[receiver.address.toLowerCase()])
          .filter((email) => email);

        resolutionReceiversMap[resolution.id] = emails;
      })
  );

  await sendPreDraftEmails(resolutionReceiversMap, event);

  return new Response("OK");
}

export async function handleApprovedResolutions(
  event: FetchEvent | ScheduledEvent,
  ethToEmails: any
) {
  const newResolutions = (await fetchLastApprovedResolutionIds(event)).map(
    (r) =>
      ({
        id: r.id,
        createBy: r.createBy,
        votingStarts: (
          parseInt(r.approveTimestamp!) +
          parseInt(r.resolutionType!.noticePeriod)
        ).toString(),
      } as ResolutionData)
  );
  const previousFailedIds = await getFailedApprovedEmailResolutions();
  const totalResolutions = previousFailedIds.concat(newResolutions);

  if (totalResolutions.length > 0) {
    if (Object.keys(ethToEmails).length > 0) {
      const resolutionVotersMap: any = {};
      await Promise.all(
        totalResolutions.map(async (resolution: ResolutionData) => {
          // For the demo, emails are sent only to the resolution creator
          //const voters = await fetchVoters(event, resolution.id);
          const voters: Record<"address", string>[] = [
            { address: resolution.createBy! },
          ];
          const emails = voters
            .map((voter) => ethToEmails[voter.address.toLowerCase()])
            .filter((email) => email);

          resolutionVotersMap[resolution.id] = emails;
        })
      );

      await sendResolutionApprovedEmails(
        resolutionVotersMap,
        totalResolutions,
        event
      );
    }
  }

  return new Response("OK");
}

export async function handleVotingStarts(
  event: FetchEvent | ScheduledEvent,
  ethToEmails: any
) {
  // Get resolutions approved within the last 30 days
  const today = new Date().getTime();
  const todaySeconds = Math.floor(today / 1000);
  const aMonthAgo = new Date(today - 30 * 24 * 60 * 60 * 1000).getTime();
  const aMonthAgoSeconds = Math.floor(aMonthAgo / 1000);
  const resolutions = await fetchApprovedResolutions(aMonthAgoSeconds, event);

  const LAST_VOTING_EMAIL_SENT_KEY = "lastVotingEmailSent";
  const lastVotingEmailSent = parseInt(
    (await SOLIDATO_NAMESPACE.get(LAST_VOTING_EMAIL_SENT_KEY)) || "0"
  );

  // Get those whose approved_timestamp + notice_period is less than today
  // and greater than the last voting email sent
  // ex: Voting starts on 11th May at 12:00
  //     Today: 11th May 13:00
  //     Last email sent: 11th May 12:30 -> don't send
  //     Last email sent: 11th May 11:30 -> send
  const resolutionsToAlert = resolutions
    .filter(
      (resolution) =>
        parseInt(resolution.approveTimestamp!) +
          parseInt(resolution.resolutionType!.noticePeriod) <
        todaySeconds
    )
    .filter(
      (resolution) =>
        parseInt(resolution.approveTimestamp!) +
          parseInt(resolution.resolutionType!.noticePeriod) >
        lastVotingEmailSent
    );

  // Send notification to all contributors that can vote that resolution
  const previousFailedIds = await getFailedVotingStartEmailResolutions();
  const totalResolutions = previousFailedIds.concat(resolutionsToAlert);
  if (totalResolutions.length > 0) {
    if (Object.keys(ethToEmails).length > 0) {
      const resolutionVotersMap: any = {};
      await Promise.all(
        totalResolutions.map(async (resolution: ResolutionData) => {
          // For the demo, emails are sent only to the resolution creator
          //const voters = await fetchVoters(event, resolution.id);
          const voters: Record<"address", string>[] = [
            { address: resolution.createBy! },
          ];
          const emails = voters
            .map((voter) => ethToEmails[voter.address.toLowerCase()])
            .filter((email) => email);

          resolutionVotersMap[resolution.id] = emails;
        })
      );

      await sendVotingStartsEmails(
        resolutionVotersMap,
        resolutionsToAlert,
        event
      );
    }
  }

  event.waitUntil(
    SOLIDATO_NAMESPACE.put(
      LAST_VOTING_EMAIL_SENT_KEY,
      JSON.stringify(todaySeconds)
    )
  );

  return new Response("OK");
}
