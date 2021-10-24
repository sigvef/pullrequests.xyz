import { Circle } from "@mui/icons-material";
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
repositories(first: 100) {
nodes {
id
name
owner {
login
}
pullRequests(first: 100, states: OPEN) {
nodes {
id
title
createdAt
mergeable
number
url
viewerDidAuthor
commits(last: 1){
          nodes{
            commit{
              commitUrl
              oid
              status {
                state
                
                contexts {
                  state
                  targetUrl
                  description
                  context
                }
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
reviewRequests {
    nodes {
id
    }
}
}
}
}
}
}
}
    `);
      const obj = await result.json();
      const repos = obj.data.viewer.repositories.nodes.filter(
        (repo: any) => repo.pullRequests.nodes.length > 0
      );
      repos.forEach((repo: any) => {
        repo.pullRequests.nodes.sort((a: any, b: any) =>
          a.createdAt > b.createdAt ? a : b
        );
      });
      repos.sort((a: any, b: any) =>
        a.pullRequests.nodes[0].createdAt > b.pullRequests.nodes[0].createdAt
          ? a
          : b
      );
      setData(repos);
    })();
  }, []);

  return (
    <div className="container sm mx-auto px-3">
      {data &&
        data.map((repo: any) => {
          return (
            <div key={repo.id} className="mb-5">
              <div className="font-bold p-3">
                {repo.owner.login}/{repo.name}
              </div>
              {repo.pullRequests.nodes.map((pr: any) => {
                const needsRebase = pr.mergeable === "CONFLICTING";
                const isAuthor = pr.viewerDidAuthor;
                const needsReview = pr.reviewDecision === "REVIEW_REQUIRED";
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
                return (
                  <div
                    key={pr.id}
                    className={`mb-3 p-3 rounded flex ${
                      shouldHighlight ? "bg-yellow-100" : ""
                    }`}
                  >
                    <div className="w-12">
                      <Circle />
                      {pr.commits.nodes[0].commit.status?.state}
                    </div>
                    <div>
                      <div>
                        <a
                          href={pr.url}
                          target="_blank"
                          className="flex flex-row items-center"
                        >
                          <div>{pr.title}</div>
                          <div className="ml-5 font-thin">#{pr.number}</div>
                        </a>
                      </div>
                      <div>{pr.author?.login ?? "No author"}</div>
                      <div>{needsRebase && "Needs rebase"}</div>
                      {JSON.stringify(pr)}
                    </div>

                    <div>
                      {pr.assignees.nodes.map((assignee: any) => (
                        <div
                          key={assignee.id}
                          className="w-8 h-8 flex-shrink-0"
                        >
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
          );
        })}
    </div>
  );
}

export default App;
