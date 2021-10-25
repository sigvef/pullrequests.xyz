import { LogoGithubIcon, MarkGithubIcon } from "@primer/octicons-react";
import { useState } from "react";
import logo from "./logo.svg";

export const TokenScreen: React.FC<{ token: string; onUpdate: (token: string) => void }> = ({ token, onUpdate }) => {
  const [value, setValue] = useState(token);
  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      className="flex flex-col items-center justify-center"
    >
      <img src={logo} className="w-20 mb-1" />
      <div className="font-bold mb-12 text-xl">
        Pullrequests<span className="font-normal">.xyz</span>
      </div>

      <div className="w-80 pl-5 mb-5">
        <strong>Pullrequests</strong>.xyz is an{" "}
        <a href="https://github.com/sigvef/pullrequests.xyz" target="_blank" className="text-blue-600">
          open-source
        </a>
        <MarkGithubIcon verticalAlign="middle" className="ml-2 text-gray-800" /> tool for maintainers to list pull
        requests from GitHub with workflow augmentation colorization and keyboard shortcut smoothness.
      </div>

      <div className="w-80 pl-5 pr-3 mb-5">Enter a GitHub Personal Access Token with repo read access to continue.</div>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          onUpdate(value);
          setValue("");
        }}
      >
        <div className="w-80 flex flex-col">
          <label className="self-stretch" htmlFor="token">
            <div className="mb-3 ml-5 font-bold">GitHub token</div>
          </label>
          <div className="flex">
            <input
              id="token"
              value={value}
              type="password"
              onChange={(e) => setValue(e.target.value)}
              className="flex-1 self-center shadow bg-gray-100 px-5 py-2 rounded-full"
            />
            <button className="self-center ml-5 shadow rounded-full px-5 py-2 bg-blue-600 text-white font-bold">
              Save
            </button>
          </div>
        </div>
      </form>
      <div className="h-48 w-full" />
    </div>
  );
};
