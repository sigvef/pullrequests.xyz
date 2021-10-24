import { CheckIcon, DotFillIcon, GitPullRequestIcon, XIcon } from "@primer/octicons-react";
import { useEffect, useState } from "react";
import { api } from "./api";
import "./App.css";
import { Spinner } from "./Spinner";
import megaquery from "./megaquery.graphql?raw";
import logo from "./logo.png";

function App() {
  const [data, setData] = useState<{ user: any; groups: { name: string; prs: any[] }[] } | null>(null);

  useEffect(() => {
    (async () => {
      setData(null);

      const cached = localStorage.getItem("cachedData");
      if (cached) {
        setData(JSON.parse(cached));
        return;
      }

      const owners: { [owner: string]: any[] } = {};
      let after: string | null = null;
      let user: any = {};

      while (true) {
        let result: any = await api(megaquery, { after });
        let obj = await result.json();
        user.name = obj.data.viewer.name;
        user.avatarUrl = obj.data.viewer.avatarUrl;
        console.log(obj.data.viewer.repositories.nodes);
        const repos = obj.data.viewer.repositories.nodes.filter((repo: any) => repo.pullRequests.nodes.length > 0);
        console.log(repos);
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
          const needsAssignee = !pr.assignees || pr.assignees.nodes.length === 0;
          const youAreAssigned =
            pr.assignees &&
            pr.assignees.nodes.length > 0 &&
            pr.assignees.nodes.findIndex((assignee: any) => assignee.login === "sigvef") !== -1;
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

          if (pr.labels?.nodes.find((label: any) => label.name.toLowerCase() === "skip colorization")) {
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
      const dataToSet = {
        groups: newData,
        user,
      };
      localStorage.setItem("cachedData", JSON.stringify(dataToSet));
      setData(dataToSet);
    })();
  }, []);

  const [showWIPs, setShowWIPs] = useState(false);

  const [selectedOwner, _setSelectedOwner] = useState(localStorage.getItem("selectedOwner"));
  const setSelectedOwner = (owner: string) => {
    _setSelectedOwner(owner);
    localStorage.setItem("selectedOwner", owner);
  };

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

  let filteredData = data.groups.map((obj) => ({ ...obj }));
  filteredData.forEach((obj) => {
    obj.prs = obj.prs.filter((pr) => {
      const isWip = pr.isDraft || pr.title.trim().toLowerCase().replaceAll(/\[|\]/g, "").startsWith("wip");
      return !(isWip && !showWIPs);
    });
  });
  filteredData = filteredData.filter((obj) => obj.prs.length > 0);
  const selectedPrs = filteredData.find((obj) => obj.name === selectedOwner);

  return (
    <>
      <div
        className="mb-8 h-16"
        style={{
          boxShadow: "0px 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <div className="h-16 px-4 mx-auto container flex items-center">
          <a href="/" className="flex items-center">
            <img src={logo} className="h-6 mr-3" />
            <div className="font-bold">Pullrequests</div>
            <div className="font-thin">.xyz</div>
          </a>
          <div className="flex-1" />
          <div className="mr-5">{data.user.name}</div>
          <div className="mr-3 w-8 h-8 flex-shrink-0 self-center">
            <img src={data.user.avatarUrl} className="w-8 h-8 rounded-full shadow" />
          </div>
        </div>
      </div>
      <div className="container px-3 mx-auto sm">
        <div className="mt-3">
          {filteredData.map(({ name }) => (
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
          <input type="checkbox" checked={showWIPs} onChange={(e) => setShowWIPs(e.target.checked)} className="mr-3" />
          <div>Show WIPs</div>
        </label>

        <div className="divide-y">
          {selectedPrs?.prs.map((pr: any) => {
            const needs = [];
            if (pr.settings.needsRebase) {
              needs.push(
                <span>
                  <GitPullRequestIcon className="mr-3" />
                  rebase
                </span>
              );
            }
            if (pr.settings.needsReview) {
              needs.push("review");
            }
            return (
              <div
                key={pr.id}
                className={`h-16 px-4 flex ${pr.settings.isWip ? "bg-gray-200 font-thin" : ""} ${
                  pr.settings.shouldHighlight ? "bg-yellow-100" : ""
                }`}
              >
                <div className="self-center w-32 font-thin text-right whitespace-nowrap overflow-hidden overflow-ellipsis">
                  {pr.repo.name}
                </div>
                <div className="flex items-center self-center justify-center flex-shrink-0 w-12 ml-3 mr-3">
                  {pr.commits.nodes[0].commit.statusCheckRollup?.state === "PENDING" && (
                    <DotFillIcon className={!pr.settings.isWip ? "text-yellow-500" : "text-gray-500"} />
                  )}
                  {pr.commits.nodes[0].commit.statusCheckRollup?.state === "FAILURE" && (
                    <XIcon className={!pr.settings.isWip ? "text-red-500" : "text-gray-500"} />
                  )}
                  {pr.commits.nodes[0].commit.statusCheckRollup?.state === "SUCCESS" && (
                    <CheckIcon className={!pr.settings.isWip ? "text-green-500" : "text-gray-500"} />
                  )}
                  {!pr.commits.nodes[0].commit.statusCheckRollup?.state && (
                    <div className="font-thin text-gray-500">—</div>
                  )}
                </div>
                <div className="mr-5 w-6 h-6 flex-shrink-0 self-center">
                  <img src={pr.author.avatarUrl} className="w-6 h-6 rounded-full shadow" />
                </div>
                <div className="flex items-center ml-2">
                  <div className="flex items-center">
                    <a href={pr.url} target="_blank">
                      {pr.title}
                    </a>
                    {pr.labels.nodes.map((label: any) => (
                      <div key={label.name} className="ml-3 text-xs rounded-full px-3 py-1 bg-gray-200">
                        {label.name}
                      </div>
                    ))}
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
                  {pr.settings.needsRebase && (
                    <div className="text-gray-500 ml-3 font-normal">
                      Needs rebase
                      <GitPullRequestIcon className="ml-3" />
                    </div>
                  )}
                </div>

                <div className="w-48 ml-3 flex justify-end items-center">
                  {pr.assignees.nodes.length === 0 &&
                    pr.settings.needsReview &&
                    (pr.settings.isAuthor ? (
                      <div className="rounded-full border-2 border-opacity-0 px-5 py-1 text-gray-500">Needs review</div>
                    ) : (
                      <div className="rounded-full border-2 px-5 py-1 border-yellow-700 text-yellow-700">
                        Needs review
                      </div>
                    ))}
                  {pr.assignees.nodes.map((assignee: any) => (
                    <div key={assignee.id} className="ml-3 w-8 h-8 flex-shrink-0">
                      <img src={assignee.avatarUrl} className="w-8 h-8 rounded-full shadow" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default App;
