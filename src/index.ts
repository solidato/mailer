import {
  handleEmailHealth,
  handleGraphHealth,
  handleOdooHealth,
} from "./controllers/health";

import {
  handleApprovedResolutions,
  handleCreatedResolutions,
  handleVotingStarts,
} from "./controllers/mailer";
import { fetchUsers } from "./backend";

async function handleEmails(event: ScheduledEvent) {
  const ethToEmails: any = await fetchUsers(event);

  await handleCreatedResolutions(event, ethToEmails);
  await handleApprovedResolutions(event, ethToEmails);
  await handleVotingStarts(event, ethToEmails);

  return new Response("OK");
}

async function handle(event: FetchEvent) {
  if (event.request.url.includes("/mails/created")) {
    return await handleCreatedResolutions(event, await fetchUsers(event));
  }

  if (event.request.url.includes("/mails/approved")) {
    return await handleApprovedResolutions(event, await fetchUsers(event));
  }

  if (event.request.url.includes("/mails/vote")) {
    return await handleVotingStarts(event, await fetchUsers(event));
  }

  if (event.request.url.includes("/health/email")) {
    return await handleEmailHealth();
  }

  if (event.request.url.includes("/health/graph")) {
    return await handleGraphHealth();
  }

  if (event.request.url.includes("/health/odoo")) {
    return await handleOdooHealth();
  }

  return new Response("Non existing route", { status: 404 });
}

addEventListener("fetch", (event) => {
  event.respondWith(handle(event));
});

addEventListener("scheduled", (event) => {
  event.waitUntil(handleEmails(event));
});
