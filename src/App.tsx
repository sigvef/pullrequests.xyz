import { Check, Circle, Close, Remove } from "@mui/icons-material";
import { colors } from "@mui/material";
import { formatRelative } from "date-fns";
import { useEffect, useState } from "react";
import "./App.css";

const token = import.meta.env.VITE_GH_TOKEN;
function api(query: any) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `bearer ${token}`);
  return fetch("https://api.github.com/graphql", {
    method: "POST",
    body: JSON.stringify({ query }),
    headers,
  });
}

function App() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setData(null);
      const result = await api(`
{
  viewer {
    name
repositories(last: 100) {
nodes {
id
name
owner {
login
}
pullRequests(first: 10, states: OPEN) {
nodes {
id
title
createdAt
mergeable
number
isDraft
url
viewerDidAuthor
labels(first: 5) {
    nodes {
        name
    }
}
commits(last: 1){
          nodes{
            commit{
              status {
                state
              }
            }
          }
        }
assignees(first: 5) {
    nodes {
        id
        avatarUrl
        login
    }
}
author {
    login
}
reviewDecision
}
}
}
}
}
}
    `);
      const obj = await result.json();
      const owners: { [owner: string]: any[] } = {};
      const repos = obj.data.viewer.repositories.nodes.filter(
        (repo: any) => repo.pullRequests.nodes.length > 0
      );
      repos.forEach((repo: any) => {
        const ownerName = repo.owner.login;
        owners[ownerName] = owners[ownerName] || [];
        owners[ownerName] = owners[ownerName].concat(repo.pullRequests.nodes);
        for (const pr of repo.pullRequests.nodes) {
          pr.repo = repo;
        }
      });
      const newData = Object.entries(owners)
        .map(([name, prs]) => ({ name, prs }))
        .sort((a, b) => (a.name > b.name ? 1 : -1));
      for (const obj of newData) {
        obj.prs.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
      }
      setData(newData);
    })();
  }, []);

  const [showWIPs, setShowWIPs] = useState(false);

  const [selectedOwner, _setSelectedOwner] = useState(
    localStorage.getItem("selectedOwner")
  );
  const setSelectedOwner = (owner: string) => {
    _setSelectedOwner(owner);
    localStorage.setItem("selectedOwner", owner);
  };

  const selectedRepos = data?.find(({ name }) => name === selectedOwner);

  return (
    <div className="container sm mx-auto px-3">
      <div className="mt-3">
        {data &&
          data.map(({ name }) => (
            <button
              className={`py-1 px-5 border rounded divide-opacity-0 mr-3 ${
                name === selectedOwner ? "bg-blue-200" : ""
              }`}
              key={name}
              onClick={(e) => {
                e.preventDefault();
                setSelectedOwner(name);
              }}
            >
              {name}
            </button>
          ))}
      </div>

      <label className="flex items-center my-3">
        <input
          type="checkbox"
          checked={showWIPs}
          onChange={(e) => setShowWIPs(e.target.checked)}
          className="mr-3"
        />
        <div>Show WIPs</div>
      </label>

      <div className="divide-y">
        {selectedRepos?.prs.map((pr: any) => {
          const needsRebase = pr.mergeable === "CONFLICTING";
          const isAuthor = pr.viewerDidAuthor;
          const isWip =
            pr.isDraft ||
            pr.title
              .trim()
              .toLowerCase()
              .replaceAll(/\[|\]/g, "")
              .startsWith("wip");

          if (isWip && !showWIPs) {
            return null;
          }

          const needsReview = pr.reviewDecision === "REVIEW_REQUIRED" && !isWip;
          const needsAssignee =
            !pr.assignees || pr.assignees.nodes.length === 0;
          const youAreAssigned =
            pr.assignees &&
            pr.assignees.nodes.length > 0 &&
            pr.assignees.nodes.findIndex(
              (assignee) => assignee.login === "sigvef"
            ) !== -1;
          let shouldHighlight = false;
          if (isAuthor && needsRebase) {
            shouldHighlight = true;
          }
          if (!isAuthor && needsReview) {
            shouldHighlight = true;
          }
          if (needsAssignee && !isAuthor) {
            shouldHighlight = true;
          }
          if (!needsAssignee && !youAreAssigned && !isAuthor) {
            shouldHighlight = false;
          }
          if (isWip && !isAuthor) {
            shouldHighlight = false;
          }

          if (
            pr.labels?.nodes.find(
              (label: any) => label.name.toLowerCase() === "skip colorization"
            )
          ) {
            shouldHighlight = false;
          }

          const needs = [];
          if (needsRebase) {
            needs.push("rebase");
          }
          if (needsReview) {
            needs.push("review");
          }
          return (
            <div
              key={pr.id}
              className={`p-3 flex ${shouldHighlight ? "bg-yellow-100" : ""}`}
            >
              <div className="w-24 text-right font-thin self-center">
                {pr.repo.name}
              </div>
              <div className="w-12 ml-3 mr-3 flex-shrink-0 self-center justify-center flex items-center">
                {pr.commits.nodes[0].commit.status?.state === "PENDING" && (
                  <Circle className="text-yellow-500" />
                )}
                {pr.commits.nodes[0].commit.status?.state === "FAILURE" && (
                  <Close className="text-red-500" />
                )}
                {pr.commits.nodes[0].commit.status?.state === "SUCCESS" && (
                  <Check className="text-green-500" />
                )}
              </div>
              <div>
                <div>
                  <a href={pr.url} target="_blank">
                    <div className="flex items-center">
                      {pr.title}
                      <div className="flex items-center">
                        {needs.map((need) => (
                          <div
                            className="ml-3 rounded-full border-2 border-yellow-700 px-3 py-1 text-yellow-800"
                            id={need}
                          >
                            Needs {need}
                          </div>
                        ))}
                      </div>
                    </div>
                  </a>
                </div>
                <div className="text-gray-500">
                  #{pr.number} opened{" "}
                  {formatRelative(new Date(pr.createdAt), new Date())} by{" "}
                  {pr.author?.login ?? "(unknown)"}
                </div>
              </div>

              <div className="flex-1" />

              <div>
                {pr.assignees.nodes.map((assignee: any) => (
                  <div key={assignee.id} className="w-8 h-8 flex-shrink-0">
                    <img
                      src={assignee.avatarUrl}
                      className="w-8 h-8 rounded-full shadow"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
