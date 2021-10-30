import megaquery from "./megaquery.graphql?raw";
import pullrequestquery from "./pullrequestquery.graphql?raw";

export interface PullRequest {
  id: string;
  author: {
    login: string;
    avatarUrl: string;
  };
  repository: { name: string; owner: { login: string } };
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
}

interface PullRequestColorizationInformation {
  shouldHighlight: boolean;
  isWip: boolean;
  isAuthor: boolean;
  youAreAssigned: boolean;
  needsAssignee: boolean;
  needsReview: boolean;
  needsRebase: boolean;
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

export async function getPullRequestsViaAuthor(token: string): Promise<PullRequest[]> {
  let after: string | null = null;
  const prs: PullRequest[] = [];
  while (true) {
    let result: any = await api(pullrequestquery, { after }, token);
    const obj = await result.json();
    obj.data.viewer.pullRequests.nodes.forEach((pr: any) => {
      prs.push(pr);
    });
    if (!obj.data.viewer.pullRequests.pageInfo.hasNextPage) {
      break;
    }
    after = obj.data.viewer.pullRequests.pageInfo.endCursor;
  }
  return prs;
}

export async function getPullrequestsViaRepository(token: string): Promise<PullRequest[]> {
  const prs: PullRequest[] = [];
  let after: string | null = null;
  let user: any = {};

  while (true) {
    let result: any = await api(megaquery, { after }, token);
    let obj = await result.json();
    console.log(obj.data.rateLimit);
    user.name = obj.data.viewer.name;
    user.avatarUrl = obj.data.viewer.avatarUrl;
    const repos = obj.data.viewer.repositories.nodes.filter((repo: any) => repo.pullRequests.nodes.length > 0);
    repos.forEach((repo: any) => {
      for (const pr of repo.pullRequests.nodes) {
        pr.repository = { name: repo.name, owner: { login: repo.owner.login } };
        prs.push(pr);
      }
    });
    if (!obj.data.viewer.repositories.pageInfo.hasNextPage) {
      break;
    }
    after = obj.data.viewer.repositories.pageInfo.endCursor;
  }
  return prs;
}
