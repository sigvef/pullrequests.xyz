import { Add, Check, Circle, Close, Remove } from "@mui/icons-material";
import {
  CheckIcon,
  DotFillIcon,
  GitPullRequestIcon,
  XIcon,
} from "@primer/octicons-react";
import { formatRelative } from "date-fns";
import { useEffect, useState } from "react";
import { api } from "./api";
import "./App.css";
import { Spinner } from "./Spinner";

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
potentialMergeCommit {
status {state}
              statusCheckRollup {
              state
                }
}
commits(last: 1){
          nodes{
            commit{
              status {
                state
              }
              statusCheckRollup {
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
    avatarUrl
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

  if (!data) {
    return (
      <div
        style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
        className="flex items-center justify-center"
      >
        <Spinner />
      </div>
    );
  }

  return (
    <div className="container px-3 mx-auto sm">
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
            needs.push(
              <span>
                <GitPullRequestIcon className="mr-3" />
                rebase
              </span>
            );
          }
          if (needsReview) {
            needs.push("review");
          }
          return (
            <div
              key={pr.id}
              className={`h-16 px-4 flex ${
                isWip ? "bg-gray-200 font-thin" : ""
              } ${shouldHighlight ? "bg-yellow-100" : ""}`}
            >
              <div className="self-center w-24 font-thin text-right whitespace-nowrap overflow-hidden overflow-ellipsis">
                {pr.repo.name}
              </div>
              <div className="flex items-center self-center justify-center flex-shrink-0 w-12 ml-3 mr-3">
                {pr.commits.nodes[0].commit.statusCheckRollup?.state ===
                  "PENDING" && (
                  <DotFillIcon
                    className={!isWip ? "text-yellow-500" : "text-gray-500"}
                  />
                )}
                {pr.commits.nodes[0].commit.statusCheckRollup?.state ===
                  "FAILURE" && (
                  <XIcon
                    className={!isWip ? "text-red-500" : "text-gray-500"}
                  />
                )}
                {pr.commits.nodes[0].commit.statusCheckRollup?.state ===
                  "SUCCESS" && (
                  <CheckIcon
                    className={!isWip ? "text-green-500" : "text-gray-500"}
                  />
                )}
                {!pr.commits.nodes[0].commit.statusCheckRollup?.state && (
                  <div className="font-thin text-gray-500">—</div>
                )}
              </div>
              <div className="mr-5 w-6 h-6 flex-shrink-0 self-center">
                <img
                  src={pr.author.avatarUrl}
                  className="w-6 h-6 rounded-full shadow"
                />
              </div>
              <div className="flex items-center ml-2">
                <div>
                  <a href={pr.url} target="_blank">
                    {pr.title}
                  </a>
                </div>
                {/*
                <div className="text-gray-500">
                  #{pr.number} opened{" "}
                  {formatRelative(new Date(pr.createdAt), new Date())} by{" "}
                  {pr.author?.login ?? "(unknown)"}
                </div>
                */}
              </div>

              <div className="flex-1" />

              <div className="flex items-center">
                {needsRebase && (
                  <div className="text-gray-500 ml-3 font-normal">
                    Needs rebase
                    <GitPullRequestIcon className="ml-3" />
                  </div>
                )}
              </div>

              <div className="w-48 ml-3 flex justify-end items-center">
                {pr.assignees.nodes.length === 0 &&
                  needsReview &&
                  (isAuthor ? (
                    <div className="rounded-full border-2 border-opacity-0 px-5 py-1 text-gray-500">
                      Needs review
                    </div>
                  ) : (
                    <div className="rounded-full border-2 px-5 py-1 border-yellow-700 text-yellow-700">
                      Needs review
                    </div>
                  ))}
                {pr.assignees.nodes.map((assignee: any) => (
                  <div key={assignee.id} className="ml-3 w-8 h-8 flex-shrink-0">
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
