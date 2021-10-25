import { CheckIcon, DotFillIcon, GitPullRequestIcon, XIcon } from "@primer/octicons-react";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import "./App.css";
import { Spinner } from "./Spinner";
import megaquery from "./megaquery.graphql?raw";
import logo from "./logo.svg";
import { Tooltip } from "@mui/material";
import { TokenScreen } from "./TokenScreen";

const shortcutLetters = "asdfqwertzxcvbnmyuiop";

interface PullRequest {
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

function App() {
  const [data, setData] = useState<{ user: any; groups: { name: string; prs: PullRequest[] }[] } | null>(null);
  const [token, setToken] = useState(localStorage.getItem("pullrequests.xyz_token") || "");
  const cursor = useRef(0);
  const cursorVimStateBuffer = useRef("");
  const [showWIPs, setShowWIPs] = useState(false);
  const [, setRefresher] = useState(true);

  let filteredData = useRef<{ groups: { name: string; prs: PullRequest[] }[] } | null>(null);
  if (data) {
    filteredData.current = {
      groups: data.groups.map((obj) => ({ ...obj })),
    };
    filteredData.current.groups.forEach((obj) => {
      obj.prs = obj.prs.filter((pr) => {
        const isWip = pr.isDraft || pr.title.trim().toLowerCase().replaceAll(/\[|\]/g, "").startsWith("wip");
        if (pr.title === "Further bugfixes") {
          console.log(pr);
        }
        return !(isWip && !showWIPs);
      });
    });
    filteredData.current.groups = filteredData.current.groups.filter((obj) => obj.prs.length > 0);
  }

  const setCursor = (fn: (cursor: number) => number) => {
    cursor.current = fn(cursor.current);
    if (filteredData.current) {
      const newOwner = filteredData.current.groups[cursor.current].name;
      setSelectedOwner(newOwner);
      window.history.replaceState(undefined, "", `/${newOwner}`);
    }
    setRefresher((old) => !old);
  };

  useEffect(() => {
    const onKeypress = (e: KeyboardEvent) => {
      e.preventDefault();
      const index = shortcutLetters.indexOf(e.key);
      if (index !== -1) {
        const selected = filteredData.current?.groups[cursor.current].prs[index]!;
        window.open(selected.url, "_blank");
        cursorVimStateBuffer.current = "";
      } else if (e.key === "j") {
        window.scrollBy({
          left: 0,
          top: 96,
        });
        cursorVimStateBuffer.current = "";
      } else if (e.key === "k") {
        window.scrollBy({
          left: 0,
          top: -96,
        });
        cursorVimStateBuffer.current = "";
      } else if (e.key === "h") {
        setCursor((old) => Math.max(0, old - 1));
        cursorVimStateBuffer.current = "";
      } else if (e.key === "l") {
        setCursor((old) => Math.min((filteredData.current?.groups.length ?? 1) - 1, old + 1));
        cursorVimStateBuffer.current = "";
      } else if (e.key === "g") {
        cursorVimStateBuffer.current += "g";
      } else if (e.key === "G") {
        cursorVimStateBuffer.current = "";
        window.scrollTo({
          left: 0,
          top: 9999999999,
        });
      }
      if (cursorVimStateBuffer.current == "gg") {
        cursorVimStateBuffer.current = "";
        window.scrollTo({
          left: 0,
          top: 0,
        });
      }
    };
    window.addEventListener("keypress", onKeypress);
    return () => {
      window.removeEventListener("keypress", onKeypress);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    (async () => {
      setData(null);

      const cached = localStorage.getItem("cachedData");
      if (cached) {
        setData(JSON.parse(cached));
        return;
      }

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
      const skipSet = {
        NordicPlayground: true,
        ruoccoma: true,
        featfm: true,
      };
      const dataToSet = {
        groups: newData.filter((group) => !(group.name in skipSet)),
        user,
      };
      localStorage.setItem("cachedData", JSON.stringify(dataToSet));
      setData(dataToSet);
    })();
  }, [token]);

  const [selectedOwner, _setSelectedOwner] = useState(localStorage.getItem("selectedOwner"));
  const setSelectedOwner = (owner: string) => {
    _setSelectedOwner(owner);
    localStorage.setItem("selectedOwner", owner);
  };

  if (!token) {
    return (
      <TokenScreen
        token={token}
        onUpdate={(newToken) => {
          setToken(newToken);
          localStorage.setItem("pullrequests.xyz_token", newToken);
        }}
      />
    );
  }

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

  const selectedPrs = filteredData.current?.groups.find((obj) => obj.name === selectedOwner);

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
            <img src={logo} className="h-8 mr-3" />
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
      <div className="container px-3 mx-auto">
        <div className="my-3 bg-gray-100 py-3 px-3 rounded-full text-gray-700 mb-6">
          {filteredData.current?.groups.map(({ name, prs }) => {
            const count = prs.filter((pr) => pr.settings.shouldHighlight).length;
            return (
              <button
                className={`outline-none relative py-2 px-5 rounded-full divide-opacity-0 mr-3 ${
                  name === selectedOwner ? "bg-white text-black font-bold border" : "border"
                }`}
                key={name}
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedOwner(name);
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {name}
                </div>
                <div
                  style={{ position: "absolute", right: -8, top: -4 }}
                  className={`flex items-center justify-center rounded-full w-6 h-6 ${
                    count > 0 ? "bg-yellow-200 font-bold" : "bg-gray-200"
                  } text-sm`}
                >
                  {count || prs.length}
                </div>
                <div style={{ visibility: "hidden" }} className="font-bold">
                  {name}
                </div>
              </button>
            );
          })}
        </div>

        {/*
        <label className="flex items-center my-3">
          <input type="checkbox" checked={showWIPs} onChange={(e) => setShowWIPs(e.target.checked)} className="mr-3" />
          <div>Show WIPs</div>
        </label>
        */}

        <div className="divide-y rounded-3xl overflow-hidden mb-12">
          {selectedPrs?.prs.map((pr, i) => {
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
                } 
                ${i === 0 ? "rounded-t-3xl" : ""}
                ${i === selectedPrs?.prs.length - 1 ? "rounded-b-3xl" : ""}
                `}
              >
                <div className="self-center w-32 flex-shrink-0 font-thin text-right whitespace-nowrap overflow-hidden overflow-ellipsis">
                  <a href={`https://github.com/${selectedOwner}/${pr.repo.name}`} target="_blank">
                    {pr.repo.name}
                  </a>
                </div>
                <div className="flex items-center self-center justify-center flex-shrink-0 w-12 ml-3 mr-3">
                  {pr.commits.nodes[0].commit.statusCheckRollup?.state === "PENDING" && (
                    <Tooltip title="Pending" arrow>
                      <div>
                        <DotFillIcon className={!pr.settings.isWip ? "text-yellow-500" : "text-gray-500"} />
                      </div>
                    </Tooltip>
                  )}
                  {pr.commits.nodes[0].commit.statusCheckRollup?.state === "FAILURE" && (
                    <Tooltip title="Failure" arrow>
                      <div>
                        <XIcon className={!pr.settings.isWip ? "text-red-500" : "text-gray-500"} />
                      </div>
                    </Tooltip>
                  )}
                  {pr.commits.nodes[0].commit.statusCheckRollup?.state === "SUCCESS" && (
                    <Tooltip title="Success" arrow>
                      <div>
                        <CheckIcon className={!pr.settings.isWip ? "text-green-500" : "text-gray-500"} />
                      </div>
                    </Tooltip>
                  )}
                  {!pr.commits.nodes[0].commit.statusCheckRollup?.state && (
                    <div className="font-thin text-gray-500">—</div>
                  )}
                </div>
                <Tooltip title={pr.author.login} arrow>
                  <div className="mr-5 w-6 h-6 flex-shrink-0 self-center select-none">
                    <img src={pr.author.avatarUrl} className="w-6 h-6 rounded-full shadow" />
                  </div>
                </Tooltip>
                <div className="flex items-center ml-2 flex-1 whitespace-nowrap overflow-hidden overflow-ellipsis">
                  <div className="flex items-center">
                    <kbd className="select-none w-6 h-6 flex items-center justify-center mr-6 self-center text-gray-500 text-sm font-thin  bg-gray-100 shadow rounded">
                      {shortcutLetters[i]}
                    </kbd>
                    <a href={pr.url} target="_blank" className="overflow-ellipsis">
                      {pr.title}
                    </a>
                    {pr.labels.nodes.map((label) => (
                      <div key={label.name} className="ml-3 text-xs rounded-full px-3 py-1 bg-gray-200">
                        {label.name}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center flex-shrink-0">
                  {pr.settings.needsRebase && (
                    <div className="text-gray-500 ml-3 font-normal whitespace-nowrap">
                      <span className="hidden lg:inline">Needs </span>rebase
                      <GitPullRequestIcon className="ml-3" />
                    </div>
                  )}
                </div>

                <div className="w-24 lg:w-48 ml-3 flex justify-end items-center flex-shrink-0">
                  {pr.reviewDecision === "APPROVED" && (
                    <div className="rounded-full border-2 border-opacity-0 px-5 py-1 text-gray-500">Approved</div>
                  )}
                  {pr.assignees.nodes.length === 0 &&
                    pr.settings.needsReview &&
                    (pr.settings.isAuthor ? (
                      <div className="rounded-full border-2 border-opacity-0 px-5 py-1 text-gray-500">
                        <span className="hidden lg:inline">Needs </span>review
                      </div>
                    ) : (
                      <div className="rounded-full border-2 px-5 py-1 border-yellow-700 text-yellow-700">
                        <span className="hidden lg:inline">Needs </span>review
                      </div>
                    ))}
                  {pr.assignees.nodes.map((assignee) => (
                    <Tooltip title={assignee.login} arrow>
                      <div key={assignee.id} className="select-none ml-3 w-8 h-8 flex-shrink-0">
                        <img src={assignee.avatarUrl} className="w-8 h-8 rounded-full shadow" />
                      </div>
                    </Tooltip>
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
