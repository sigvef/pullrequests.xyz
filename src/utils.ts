import { useState } from "react";
import { PullRequest, PullRequestColorizationInformation } from "./api";

export function useLocalStorage<T>(key: string, initialValue: T): [T, (fn: (value: T) => T) => void] {
  let [internalValue, setInternalValue] = useState<T>(JSON.parse(localStorage.getItem(key) || "null"));
  let v = internalValue;
  if (v === null) {
    v = initialValue;
    localStorage.setItem(key, JSON.stringify(v));
  }
  const setValue = (fn: (value: T) => T) => {
    setInternalValue((old) => {
      const v = fn(old);
      localStorage.setItem(key, JSON.stringify(v));
      return v;
    });
  };
  return [v, setValue];
}

export const getPullrequestColorizationInformation = (pr: PullRequest): PullRequestColorizationInformation => {
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

  return {
    shouldHighlight,
    isWip,
    isAuthor,
    youAreAssigned,
    needsAssignee,
    needsReview,
    needsRebase,
  };
};

export const cacheInLocalStore = async (fn: () => Promise<any>, key: string) => {
  let value = JSON.parse(localStorage.getItem(key) || "null");
  if (value !== null) {
    return value;
  }
  value = await fn();
  localStorage.setItem(key, JSON.stringify(value));
  return value;
};
