import { CheckIcon, DotFillIcon, GitPullRequestIcon, XIcon } from "@primer/octicons-react";
import { useEffect, useRef, useState } from "react";
import { AllData, PullRequest } from "./api";
import { Tooltip } from "@mui/material";
import { getPullrequestColorizationInformation, useLocalStorage } from "./utils";

const shortcutLetters = "asdfqwertzxcvbmyuiopASDFQWERTZXCVBNMYUIOP";

export const PullRequestBrowser: React.FC<{ allData: AllData }> = ({ allData }) => {
  const cursor = useRef(0);
  const cursorVimStateBuffer = useRef("");
  const [showWIPs, setShowWIPs] = useState(true);
  const [, setRefresher] = useState(true);
  const [excludes] = useLocalStorage<string[]>("pullrequests.xyz_settings_excludes", []);

  let filteredData = useRef<{ groups: { name: string; prs: PullRequest[] }[] } | null>(null);
  if (allData) {
    filteredData.current = {
      groups: allData.groups.map((obj) => ({ ...obj })),
    };
    filteredData.current.groups.forEach((obj) => {
      obj.prs = obj.prs.filter((pr) => {
        const isWip = pr.isDraft || pr.title.trim().toLowerCase().replaceAll(/\[|\]/g, "").startsWith("wip");
        if (isWip && !showWIPs) {
          return false;
        }
        const repoPath = `${pr.repository.owner.login}/${pr.repository.name}`;
        for (const exclude of excludes) {
          const regex = new RegExp(exclude.replaceAll("*", ".*"), "gi");
          if (regex.test(repoPath)) {
            return false;
          }
        }
        return true;
      });
    });
    filteredData.current.groups = filteredData.current.groups.filter((obj) => obj.prs.length > 0);
  }

  const setCursor = (fn: (cursor: number) => number) => {
    cursor.current = fn(cursor.current);
    if (filteredData.current) {
      const newOwner = filteredData.current.groups[cursor.current].name;
      setSelectedOwner(newOwner);
    }
    setRefresher((old) => !old);
  };

  useEffect(() => {
    const onKeypress = (e: KeyboardEvent) => {
      e.preventDefault();
      let index = shortcutLetters.indexOf(e.key);
      if (index !== -1) {
        if (e.ctrlKey) {
          index += shortcutLetters.length;
        }
        const selected = filteredData.current?.groups[cursor.current].prs[index]!;
        window.open(selected.url, "_blank");
        cursorVimStateBuffer.current = "";
      } else if (e.key === "n") {
        window.open("https://github.com/notifications", "_blank");
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
    const pathname = window.location.pathname.slice(1);
    if (allData && pathname) {
      const index = allData.groups.findIndex((group) => group.name === pathname);
      if (index !== -1) {
        setTimeout(() => setCursor(() => index));
      }
    }
    if (allData && !pathname) {
      setTimeout(() => setCursor(() => 0));
    }
  }, [allData]);

  const selectedOwner = window.location.pathname.slice(1);
  const setSelectedOwner = (owner: string) => {
    window.history.replaceState(undefined, "", `/${owner}`);
  };

  const selectedPrs = filteredData.current?.groups.find((obj) => obj.name === selectedOwner);

  return (
    <>
      <div className="container px-3 mx-auto">
        <div className="p-3 m-3">
          <select
            className="relative block px-5 py-2 mr-3 font-bold text-black bg-white border rounded-full outline-none sm:hidden divide-opacity-0 dark:border-transparent dark:bg-gray-800 dark:bg-gray-200"
            value={cursor.current}
            onChange={(e) => setCursor(() => +e.target.value)}
          >
            {filteredData.current?.groups.map(({ name }, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div
          className="flex-wrap hidden px-3 py-3 my-3 mb-6 text-gray-700 bg-gray-100 sm:flex gap-y-3 dark:bg-black dark:bg-opacity-30 dark:text-gray-400"
          style={{ borderRadius: 33 }}
        >
          {filteredData.current?.groups.map(({ name, prs }, i) => {
            const count = prs.filter(
              (pr) => getPullrequestColorizationInformation(pr, allData.user.login).shouldHighlight
            ).length;
            return (
              <button
                className={`outline-none relative py-2 px-5 rounded-full divide-opacity-0 mr-3 border dark:border-transparent dark:bg-gray-800 ${
                  name === selectedOwner ? "bg-white dark:bg-gray-200 text-black font-bold" : ""
                }`}
                key={name}
                onClick={(e) => {
                  e.preventDefault();
                  setCursor(() => i);
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
                  className={`flex items-center justify-center rounded-full w-6 h-6 dark:text-black ${
                    count > 0 ? "bg-yellow-200 dark:bg-yellow-300 font-bold" : "bg-gray-200"
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

        <div
          className={`divide-y dark:divide-gray-800 overflow-hidden mb-12 ${
            selectedPrs?.prs.length !== 1 ? "rounded-3xl" : ""
          }`}
          style={{ ...(selectedPrs?.prs.length === 1 ? { borderRadius: 33 } : {}) }}
        >
          {selectedPrs?.prs.map((pr, i) => {
            const colorizationInfo = getPullrequestColorizationInformation(pr, allData.user.login);
            return (
              <div
                key={pr.canonicalIdentifier}
                className={`h-16 px-4 flex ${colorizationInfo.isWip ? "bg-gray-200 dark:bg-gray-800 font-thin" : ""} ${
                  colorizationInfo.shouldHighlight ? "bg-yellow-100 dark:bg-yellow-500 dark:bg-opacity-20" : ""
                } 
                ${i === 0 ? "rounded-t-3xl" : ""}
                ${i === selectedPrs?.prs.length - 1 ? "rounded-b-3xl" : ""}
                `}
              >
                <div className="self-center flex-shrink-0 w-32 overflow-hidden font-thin text-right whitespace-nowrap overflow-ellipsis">
                  <a href={`https://github.com/${pr.repository.owner.login}/${pr.repository.name}`} target="_blank">
                    {pr.repository.name}
                  </a>
                </div>
                <div className="flex items-center self-center justify-center flex-shrink-0 w-12 ml-3 mr-3">
                  {pr.statusRollup === "pending" && (
                    <Tooltip title="Pending" arrow>
                      <div>
                        <DotFillIcon className={!colorizationInfo.isWip ? "text-yellow-500" : "text-gray-500"} />
                      </div>
                    </Tooltip>
                  )}
                  {pr.statusRollup === "failure" && (
                    <Tooltip title="Failure" arrow>
                      <div>
                        <XIcon className={!colorizationInfo.isWip ? "text-red-500" : "text-gray-500"} />
                      </div>
                    </Tooltip>
                  )}
                  {pr.statusRollup === "success" && (
                    <Tooltip title="Success" arrow>
                      <div>
                        <CheckIcon className={!colorizationInfo.isWip ? "text-green-500" : "text-gray-500"} />
                      </div>
                    </Tooltip>
                  )}
                  {false && <div className="font-thin text-gray-500">—</div>}
                </div>
                <Tooltip title={pr.author?.login} arrow>
                  <div className="self-center flex-shrink-0 w-6 h-6 mr-5 select-none">
                    <img
                      src={pr.author?.avatarUrl}
                      className="w-6 h-6 bg-gray-100 rounded-full shadow dark:bg-gray-500 dark:bg-opacity-10"
                    />
                  </div>
                </Tooltip>
                <div className="flex items-center flex-1 ml-2 overflow-hidden whitespace-nowrap overflow-ellipsis">
                  <div className="flex items-center">
                    <kbd
                      className={`select-none w-6 h-6 flex items-center justify-center mr-6 self-center text-gray-510 dark:text-gray-400 text-sm font-thin  bg-gray-100 shadow rounded ${
                        colorizationInfo.shouldHighlight ? "dark:bg-gray-900" : "dark:bg-gray-800"
                      } ${i < shortcutLetters.length * 2 ? "" : "opacity-0"}`}
                    >
                      {i > shortcutLetters.length ? "^" : ""}
                      {shortcutLetters[i % shortcutLetters.length]}
                    </kbd>
                    <a
                      href={pr.url}
                      target="_blank"
                      className={`overflow-ellipsis ${colorizationInfo.shouldHighlight ? "dark:text-yellow-400" : ""}`}
                    >
                      {pr.title}
                    </a>
                    {pr.labels?.map((label) => (
                      <div
                        key={label.name}
                        className="px-3 py-1 ml-3 text-xs bg-gray-200 rounded-full dark:bg-gray-700"
                      >
                        {label.name}
                      </div>
                    ))}
                  </div>
                  {pr.reviewDecision === "CHANGES_REQUESTED" && (
                    <div className="px-5 py-1 text-gray-500 border-2 rounded-full border-opacity-0">
                      Changes requested
                    </div>
                  )}
                </div>

                <div className="flex items-center flex-shrink-0">
                  {colorizationInfo.needsRebase && (
                    <div
                      className={
                        "ml-3 text-gray-500 whitespace-nowrap dark:text-gray-100 dark:text-opacity-50 " +
                        (colorizationInfo.isWip ? "font-light" : "font-normal")
                      }
                    >
                      <span className="hidden lg:inline">Needs </span>rebase
                      <GitPullRequestIcon className="ml-3" />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end flex-shrink-0 w-24 ml-3 lg:w-48">
                  {pr.reviewDecision === "APPROVED" && (
                    <div className="px-5 py-1 text-gray-500 border-2 rounded-full border-opacity-0">Approved</div>
                  )}
                  {pr.assignees?.length === 0 &&
                    colorizationInfo.needsReview &&
                    (colorizationInfo.isAuthor ? (
                      <div
                        className={`rounded-full border-2 border-opacity-0 px-5 py-1 text-gray-700 text-opacity-75 ${
                          colorizationInfo.shouldHighlight
                            ? "dark:text-yellow-100 dark:text-opacity-55"
                            : "dark:text-gray-100 dark:text-opacity-50"
                        }`}
                      >
                        <span className="hidden lg:inline">Needs </span>review
                      </div>
                    ) : (
                      <div className="px-5 py-1 text-yellow-700 border-2 border-yellow-700 rounded-full dark:border-yellow-400 dark:text-yellow-400">
                        <span className="hidden lg:inline">Needs </span>review
                      </div>
                    ))}
                  {pr.assignees?.map((assignee) => (
                    <Tooltip key={assignee.id} title={assignee.login} arrow>
                      <div key={assignee.id} className="flex-shrink-0 w-8 h-8 ml-3 select-none">
                        <img
                          src={assignee.avatarUrl}
                          className="w-8 h-8 bg-gray-100 rounded-full shadow dark:bg-gray-500 dark:bg-opacity-10"
                        />
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
};
