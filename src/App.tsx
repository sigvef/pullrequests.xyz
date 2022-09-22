import { Link, Route, Switch } from "wouter";
import logo from "./logo.svg";
import "./App.css";
import { useEffect, useState } from "react";
import { AllData, api, PullRequest, getRateLimit, getAllPullRequestData, getAreThereUnreadNotifications } from "./api";
import { TokenScreen } from "./TokenScreen";
import { Spinner } from "./Spinner";
import { PullRequestBrowser } from "./PullRequestBrowser";
import { Settings } from "./Settings";
import { BellIcon } from "@primer/octicons-react";
import { useLocalStorage } from "./utils";

function App() {
  const [data, _setData] = useState<AllData | null>(null);
  const [token, setToken] = useState(localStorage.getItem("pullrequests.xyz_token") || "");
  const [excludes] = useLocalStorage<string[]>("pullrequests.xyz_settings_excludes", []);

  const setData = (data: AllData | null) => {
    _setData(data);
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    (async () => {
      _setData(null);

      const user = await api(
        `
          query User {
            viewer {
                name
                login
                avatarUrl
            }
          }
      `,
        {},
        token
      ).then((r) => r.json());

      const [_, areThereAnyUnreadNotifications, prs] = await Promise.all([
        getRateLimit(token).then((x) => console.log(x)),
        getAreThereUnreadNotifications(token),
        getAllPullRequestData(token, user.data.viewer.login, excludes),
      ]);
      const prsByOwner: { [owner: string]: PullRequest[] } = {};
      const seen = new Set();
      for (const pr of prs) {
        if (seen.has(pr.canonicalIdentifier)) {
          continue;
        }
        seen.add(pr.canonicalIdentifier);
        const owner = pr.repository.owner.login;
        prsByOwner[owner] = prsByOwner[owner] || [];
        prsByOwner[owner].push(pr);
      }

      const groups = Object.entries(prsByOwner).map(([name, prs]) => ({ name, prs }));

      groups.forEach((group) => {
        group.prs.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
      });
      groups.sort((a, b) => (a.name > b.name ? 1 : -1));

      const dataToSet = {
        user: user.data.viewer,
        groups,
        areThereAnyUnreadNotifications,
      };
      setData(dataToSet);
    })();
  }, [token]);

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

  return (
    <div>
      <div className="h-16 mb-8 navbar-shadow dark:navbar-shadow">
        <div className="container flex items-center h-16 px-4 mx-auto">
          <a href="/" className="flex items-center">
            <img src={logo} className="w-8 h-8 mr-3" />
            <div className="font-bold">Pullrequests</div>
            <div className="font-thin">.xyz</div>
          </a>
          <div className="flex-1" />
          <div className="mr-8">
            <Link to="https://github.com/notifications">
              <div className="relative flex items-center justify-center">
                <BellIcon />
                {data.areThereAnyUnreadNotifications && (
                  <div
                    className="bg-blue-600 rounded-full"
                    style={{
                      position: "absolute",
                      width: 14,
                      height: 14,
                      top: -6,
                      right: -4,
                      border: "2px solid white",
                    }}
                  />
                )}
              </div>
            </Link>
          </div>
          <div className="mr-8">
            <Link to="/settings">Settings</Link>
          </div>
          <div className="hidden mr-5 sm:block">{data.user.name}</div>
          <div className="self-center flex-shrink-0 w-8 h-8 mr-3">
            <img
              src={data.user.avatarUrl}
              className="w-8 h-8 bg-gray-100 rounded-full shadow dark:bg-gray-500 dark:bg-opacity-10"
            />
          </div>
        </div>
      </div>
      <Switch>
        <Route path="/settings">{() => <Settings allData={data} />}</Route>
        <Route path="/:owner">{() => <PullRequestBrowser allData={data} />}</Route>
        <Route path="">{() => <PullRequestBrowser allData={data} />}</Route>
      </Switch>
    </div>
  );
}

export default App;
