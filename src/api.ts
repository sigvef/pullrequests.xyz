import megaquery from "./megaquery.graphql?raw";

export interface PullRequest {
  id: string;
  author: {
    login: string;
    avatarUrl: string;
  };
  repo: { name: string };
  viewerDidAuthor: boolean;
  reviewDecision: "REVIEW_REQUIRED" | "APPROVED" | "CHANGES_REQUESTED";
  commits: { nodes: [{ commit: { statusCheckRollup?: { state: string } } }] };
  labels: { nodes: { name: string }[] };
  mergeable: string;
  createdAt: string;
  isDraft: boolean;
  title: string;
  url: string;
  assignees: {
    nodes: {
      id: string;
      login: string;
      avatarUrl: string;
    }[];
  };
  settings: {
    shouldHighlight: boolean;
    isWip: boolean;
    isAuthor: boolean;
    youAreAssigned: boolean;
    needsAssignee: boolean;
    needsReview: boolean;
    needsRebase: boolean;
  };
}

export function api(query: any, variables: any, token: string) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `bearer ${token}`);
  return fetch("https://api.github.com/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
    headers,
  });
}

export type AllData = { user: any; groups: { name: string; prs: PullRequest[] }[] };

export async function getAllPullrequestGroups(token: string): Promise<AllData> {
  const owners: { [owner: string]: PullRequest[] } = {};
  let after: string | null = null;
  let user: any = {};

  while (true) {
    let result: any = await api(megaquery, { after }, token);
    let obj = await result.json();
    user.name = obj.data.viewer.name;
    user.avatarUrl = obj.data.viewer.avatarUrl;
    const repos = obj.data.viewer.repositories.nodes.filter((repo: any) => repo.pullRequests.nodes.length > 0);
    repos.forEach((repo: any) => {
      const ownerName = repo.owner.login;
      owners[ownerName] = owners[ownerName] || [];
      owners[ownerName] = owners[ownerName].concat(repo.pullRequests.nodes);
      for (const pr of repo.pullRequests.nodes) {
        pr.repo = { name: repo.name };
      }
    });
    if (!obj.data.viewer.repositories.pageInfo.hasNextPage) {
      break;
    }
    after = obj.data.viewer.repositories.pageInfo.endCursor;
  }
  const newData = Object.entries(owners)
    .map(([name, prs]) => ({ name, prs }))
    .sort((a, b) => (a.name > b.name ? 1 : -1));
  for (const obj of newData) {
    obj.prs.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    for (const pr of obj.prs) {
      const needsRebase = pr.mergeable === "CONFLICTING";
      const isAuthor = pr.viewerDidAuthor;
      const isWip = pr.isDraft || pr.title.trim().toLowerCase().replaceAll(/\[|\]/g, "").startsWith("wip");

      const needsReview = pr.reviewDecision === "REVIEW_REQUIRED" && !isWip;
      const changesRequested = pr.reviewDecision === "CHANGES_REQUESTED";
      const needsAssignee = !pr.assignees || pr.assignees.nodes.length === 0;
      const youAreAssigned =
        pr.assignees &&
        pr.assignees.nodes.length > 0 &&
        pr.assignees.nodes.findIndex((assignee) => assignee.login === "sigvef") !== -1;
      let shouldHighlight = false;
      const ciStatus = pr.commits.nodes[0].commit.statusCheckRollup?.state;

      if (!needsAssignee && !youAreAssigned && !isAuthor) {
        shouldHighlight = false;
      }
      if (isAuthor && ciStatus === "FAILURE") {
        shouldHighlight = true;
      }
      if (isAuthor && needsRebase) {
        shouldHighlight = true;
      }
      if (!isAuthor && needsReview && needsAssignee) {
        shouldHighlight = true;
      }
      if (!isAuthor && needsReview && youAreAssigned) {
        shouldHighlight = true;
      }
      if (isAuthor && changesRequested) {
        shouldHighlight = true;
      }
      if (needsAssignee && !isAuthor) {
        shouldHighlight = true;
      }
      if (isWip && !isAuthor) {
        shouldHighlight = false;
      }
      if (ciStatus === "FAILURE" && !isAuthor) {
        shouldHighlight = false;
      }
      if (!isAuthor && changesRequested) {
        shouldHighlight = false;
      }

      if (pr.labels?.nodes.find((label) => label.name.toLowerCase() === "skip colorization")) {
        shouldHighlight = false;
      }

      pr.settings = {
        shouldHighlight,
        isWip,
        isAuthor,
        youAreAssigned,
        needsAssignee,
        needsReview,
        needsRebase,
      };
    }
  }
  return {
    groups: newData,
    user,
  };
}
