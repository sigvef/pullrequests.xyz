import megaquery from "./megaquery.graphql?raw";
import pullrequestquery from "./pullrequestquery.graphql?raw";

export interface PullRequest {
  canonicalIdentifier: string;
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

export type AllData = {
  areThereAnyUnreadNotifications: boolean;
  user: any;
  groups: { name: string; prs: PullRequest[] }[];
};

interface PullRequestSpec {
  owner: string;
  repo: string;
  sha: string | null;
  number: number;
}

export async function getSinglePullRequest(prSpec: PullRequestSpec, token: string): Promise<PullRequest> {
  let check_runs, reviews, pr;
  if (prSpec.sha !== null) {
    [check_runs, reviews, pr] = await Promise.all([
      fetch(`https://api.github.com/repos/${prSpec.owner}/${prSpec.repo}/commits/${prSpec.sha}/check-runs`, {
        headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      }).then((x) => x.json()),
      fetch(`https://api.github.com/repos/${prSpec.owner}/${prSpec.repo}/pulls/${prSpec.number}/reviews`, {
        headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      }).then((x) => x.json()),
      fetch(`https://api.github.com/repos/${prSpec.owner}/${prSpec.repo}/pulls/${prSpec.number}`, {
        headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      }).then((x) => x.json()),
    ]);
  } else {
    [reviews, pr] = await Promise.all([
      fetch(`https://api.github.com/repos/${prSpec.owner}/${prSpec.repo}/pulls/${prSpec.number}/reviews`, {
        headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      }).then((x) => x.json()),
      fetch(`https://api.github.com/repos/${prSpec.owner}/${prSpec.repo}/pulls/${prSpec.number}`, {
        headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      }).then((x) => x.json()),
    ]);
    check_runs = await fetch(
      `https://api.github.com/repos/${prSpec.owner}/${prSpec.repo}/commits/${pr.head.sha}/check-runs`,
      {
        headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      }
    ).then((x) => x.json());
  }

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
  let statusRollup = check_runs.check_runs.length === 0 ? "none" : "pending";
  if (check_runs.check_runs.findIndex((x: any) => x.conclusion === "failure") !== -1) {
    statusRollup = "failure";
  } else if (check_runs.check_runs.findIndex((x: any) => x.conclusion === null) === -1) {
    statusRollup = "success";
  }
  for (const run of check_runs.check_runs) {
    if (run.conclusion === "failure") {
      statusRollup = "failure";
      break;
    }
  }
  return {
    canonicalIdentifier: `${prSpec.repo}/${prSpec.owner}#${pr.number}`,
    author: {
      login: pr.user.login,
      avatarUrl: pr.user.avatar_url,
    },
    repository: { name: prSpec.repo, owner: { login: prSpec.owner } },
    reviewDecision,
    auto_merge: pr.auto_merge,
    labels: pr.labels,
    mergeable: pr.mergeable,
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
  };
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
  let page = 1;

  while (true) {
    let result: any = await fetch(
      `https://api.github.com/user/repos?sort=created&per_page=100&direction=asc&page=${page}`,
      {
        headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      }
    ).then((x) => x.json());
    result.forEach((repo: any) => {
      if (repo.open_issues > 0) {
        repos.push({ owner: repo.owner.login, repo: repo.name });
      }
    });
    page++;
    if (result.length < 100) {
      break;
    }
  }
  return repos;
}

async function getInterestingPrSpecs(
  token: string,
  repos: { owner: string; repo: string }[],
  login: string
): Promise<PullRequestSpec[]> {
  const prNames = [];
  const [prsViaRepos, prsViaSearch] = await Promise.all([
    Promise.all(
      repos.map((repo) =>
        fetch(
          `https://api.github.com/repos/${repo.owner}/${repo.repo}/pulls?state=open&sort=created&per_page=100&page=1`,
          {
            headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
          }
        ).then((x) => x.json())
      )
    ).then((x) => x.flat()),
    fetch("https://api.github.com/search/issues?sort=created&order=desc&per_page=100&q=is:open is:pr author:" + login, {
      headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
    }).then((x) => x.json()),
  ]);
  const seen = new Set();
  for (const pr of prsViaRepos) {
    console.log(pr);
    const [, , , , owner, repo] = pr.issue_url.split("/");
    const canonicalIdentifier = `${owner}/${repo}#${pr.number}`;
    seen.add(canonicalIdentifier);
    prNames.push({
      sha: pr.head.sha,
      number: pr.number,
      owner,
      repo,
    });
  }
  for (const pr of prsViaSearch.items) {
    const [, , , , owner, repo] = pr.repository_url.split("/");
    const canonicalIdentifier = `${owner}/${repo}#${pr.number}`;
    if (seen.has(canonicalIdentifier)) {
      continue;
    }
    seen.add(canonicalIdentifier);
    prNames.push({
      sha: null,
      number: pr.number,
      owner,
      repo,
    });
  }
  return prNames;
}

export async function getAreThereUnreadNotifications(token: string): Promise<boolean> {
  return (
    (
      await fetch("https://api.github.com/notifications?per_page=1", {
        headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      }).then((x) => x.json())
    ).length > 0
  );
}

export async function getAllPullRequestData(token: string, login: string): Promise<PullRequest[]> {
  const repos = await getInterestingRepos(token);
  const prSpecs = await getInterestingPrSpecs(token, repos, login);
  return Promise.all(prSpecs.map((prSpec) => getSinglePullRequest(prSpec, token)));
}
