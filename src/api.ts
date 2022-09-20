import megaquery from "./megaquery.graphql?raw";
import pullrequestquery from "./pullrequestquery.graphql?raw";

export interface PullRequest {
  id: string;
  author: {
    login: string;
    avatarUrl: string;
  };
  repository: { name: string; owner: { login: string } };
  reviewDecision: "REVIEW_REQUIRED" | "APPROVED" | "CHANGES_REQUESTED";
  auto_merge: null;
  labels: { name: string }[];
  mergeable: boolean | null;
  createdAt: string;
  isDraft: boolean;
  title: string;
  url: string;
  assignees: {
    id: string;
    login: string;
    avatarUrl: string;
  }[];
  statusRollup: string;
  check_runs: {
    id: number;
    name: string;
    conclusion: "success" | "failure" | "neutral";
  }[];
}

export interface PullRequestColorizationInformation {
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

export async function getPullRequestsForRepository(owner: string, repo: string, token: string): Promise<PullRequest[]> {
  const prs = await (
    await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&sort=created&per_page=100&page=1`, {
      headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
    })
  ).json();
  const output: PullRequest[] = [];
  const check_run_promises = [];
  const review_promises = [];
  for (const pr of prs) {
    const ref = pr.head.sha;
    check_run_promises.push(
      fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${ref}/check-runs`, {
        headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      }).then((x) => x.json())
    );
    review_promises.push(
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`, {
        headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      }).then((x) => x.json())
    );
  }
  const [check_runs_array, reviews_array] = await Promise.all([
    Promise.all(check_run_promises),
    Promise.all(review_promises),
  ]);
  for (let i = 0; i < check_runs_array.length; i++) {
    const check_runs = check_runs_array[i];
    const reviews = reviews_array[i];
    const reviewsMap: Record<string, "COMMENTED" | "APPROVED" | "CHANGES_REQUESTED" | "DISMISSED"> = {};
    for (const review of reviews) {
      reviewsMap[review.user.login] = review.state;
    }
    const reviewStates = new Set(Object.values(reviewsMap));
    const reviewDecision = reviewStates.has("CHANGES_REQUESTED")
      ? "CHANGES_REQUESTED"
      : reviewStates.has("APPROVED")
      ? "APPROVED"
      : "REVIEW_REQUIRED";
    const pr = prs[i];
    let statusRollup = check_runs.check_runs.length === 0 ? "none" : "pending";
    if (check_runs.check_runs.findIndex((x: any) => x.conclusion === "failure") !== -1) {
      statusRollup = "failure";
    } else if (check_runs.check_runs.findIndex((x: any) => x.conclusion === "pending") === -1) {
      statusRollup = "success";
    }
    for (const run of check_runs.check_runs) {
      if (run.conclusion === "failure") {
        statusRollup = "failure";
        break;
      }
    }
    output.push({
      id: pr.id,
      author: {
        login: pr.user.login,
        avatarUrl: pr.user.avatar_url,
      },
      repository: { name: repo, owner: { login: owner } },
      reviewDecision,
      auto_merge: pr.auto_merge,
      labels: pr.labels,
      mergeable: true || pr.mergable,
      createdAt: pr.created_at,
      isDraft: pr.draft,
      title: pr.title,
      url: pr.html_url,
      assignees: pr.assignees.map((x: any) => ({
        id: x.id,
        login: x.login,
        avatarUrl: x.avatar_url,
      })),
      statusRollup,
      check_runs,
    });
  }
  output.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  return output;
}

export async function getRateLimit(token: string): Promise<any> {
  return (
    await fetch("https://api.github.com/rate_limit", {
      headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
    })
  ).json();
}

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

export async function getInterestingRepos(token: string): Promise<{ owner: string; repo: string }[]> {
  const repos: { owner: string; repo: string }[] = [];
  let after: string | null = null;
  let user: any = {};

  while (true) {
    let result: any = await api(megaquery, { after }, token);
    let obj = await result.json();
    user.name = obj.data.viewer.name;
    user.avatarUrl = obj.data.viewer.avatarUrl;
    obj.data.viewer.repositories.nodes.forEach((repo: any) => {
      repos.push({ owner: repo.owner.login, repo: repo.name });
    });
    if (!obj.data.viewer.repositories.pageInfo.hasNextPage) {
      break;
    }
    after = obj.data.viewer.repositories.pageInfo.endCursor;
  }
  return repos;
}

export async function getAllPullRequestData(token: string): Promise<PullRequest[]> {
  const repos = await getInterestingRepos(token);
  const prs = (
    await Promise.all(repos.map((repo) => getPullRequestsForRepository(repo.owner, repo.repo, token)))
  ).flat();
  return prs;
}
