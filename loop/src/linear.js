import { LOCAL_TICKETS, readJson, writeJson } from "./env.js";

const LINEAR = "https://api.linear.app/graphql";

async function linear(query, variables = {}) {
  const key = process.env.LINEAR_API_KEY;
  if (!key) return null;
  const res = await fetch(LINEAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }
  return body.data;
}

export function linearEnabled() {
  return Boolean(process.env.LINEAR_API_KEY && process.env.LINEAR_TEAM_ID);
}

async function statesByType() {
  const data = await linear(
    `query States($teamId: ID!) {
      workflowStates(filter: { team: { id: { eq: $teamId } } }) {
        nodes { id name type }
      }
    }`,
    { teamId: process.env.LINEAR_TEAM_ID },
  );
  const nodes = data.workflowStates.nodes;
  const pick = (type, nameHint) =>
    nodes.find((s) => s.name.toLowerCase() === nameHint) ||
    nodes.find((s) => s.type === type);
  return {
    unstarted: pick("unstarted", "todo") || pick("backlog", "backlog"),
    started: pick("started", "in progress"),
    review: nodes.find((s) => /review/i.test(s.name)) || pick("started", "in progress"),
    completed: pick("completed", "done"),
    raw: nodes,
  };
}

function localTickets() {
  return readJson(LOCAL_TICKETS, { issues: [] });
}

function saveLocal(doc) {
  writeJson(LOCAL_TICKETS, doc);
}

export async function createIssue({ title, description, label }) {
  if (linearEnabled()) {
    const states = await statesByType();
    const data = await linear(
      `mutation Create($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier title url state { name type } }
        }
      }`,
      {
        input: {
          teamId: process.env.LINEAR_TEAM_ID,
          title,
          description,
          ...(process.env.LINEAR_PROJECT_ID
            ? { projectId: process.env.LINEAR_PROJECT_ID }
            : {}),
          ...(states.unstarted?.id ? { stateId: states.unstarted.id } : {}),
        },
      },
    );
    const issue = data.issueCreate.issue;
    return { ...issue, source: "linear", label };
  }
  const doc = localTickets();
  const n = doc.issues.length + 1;
  const issue = {
    id: `local-${n}`,
    identifier: `LOC-${n}`,
    title,
    description,
    url: `file://loop/state/tickets.json#${n}`,
    state: { name: "Todo", type: "unstarted" },
    source: "local",
    label,
  };
  doc.issues.push(issue);
  saveLocal(doc);
  return issue;
}

export async function listOpenIssues() {
  if (linearEnabled()) {
    const data = await linear(
      `query Open($teamId: ID!) {
        issues(
          filter: {
            team: { id: { eq: $teamId } }
            state: { type: { in: ["unstarted", "backlog"] } }
          }
          first: 25
        ) {
          nodes { id identifier title description url state { name type } }
        }
      }`,
      { teamId: process.env.LINEAR_TEAM_ID },
    );
    return data.issues.nodes.map((i) => ({ ...i, source: "linear" }));
  }
  return localTickets().issues.filter((i) =>
    ["todo", "backlog", "unstarted"].includes(i.state.name.toLowerCase()),
  );
}

export async function setIssueState(issue, phase) {
  const map = { todo: "unstarted", progress: "started", review: "review", done: "completed" };
  const wanted = map[phase];
  if (linearEnabled() && issue.source !== "local") {
    const states = await statesByType();
    const state = states[wanted] || states.started;
    const data = await linear(
      `mutation Up($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue { id identifier url state { name type } }
        }
      }`,
      { id: issue.id, input: { stateId: state.id } },
    );
    return { ...issue, ...data.issueUpdate.issue, source: "linear" };
  }
  const doc = localTickets();
  const found = doc.issues.find((i) => i.id === issue.id || i.identifier === issue.identifier);
  if (found) {
    const names = { unstarted: "Todo", started: "In Progress", review: "In Review", completed: "Done" };
    found.state = { name: names[wanted] || phase, type: wanted };
    saveLocal(doc);
    return found;
  }
  return issue;
}

export async function commentOnIssue(issue, body) {
  if (linearEnabled() && issue.source !== "local") {
    await linear(
      `mutation C($input: CommentCreateInput!) {
        commentCreate(input: $input) { success }
      }`,
      { input: { issueId: issue.id, body } },
    );
    return;
  }
  const doc = localTickets();
  const found = doc.issues.find((i) => i.id === issue.id);
  if (found) {
    found.comments = found.comments || [];
    found.comments.push({ at: new Date().toISOString(), body });
    saveLocal(doc);
  }
}
