import { useState } from "react";
import { AllData } from "./api";
import { useLocalStorage } from "./utils";

export type ExcludeProfile = {
  displayName: string;
  excludes: string[];
};

type SettingsProps = {
  excludeProfiles: ExcludeProfile[];
  setExcludeProfiles: (updater: (old: ExcludeProfile[]) => ExcludeProfile[]) => void;
  currentExcludeProfileIndex: number;
  setCurrentExcludeProfileIndex: (updater: (old: number) => number) => void;
};

export const Settings: React.FC<SettingsProps> = ({
  excludeProfiles,
  setExcludeProfiles,
  currentExcludeProfileIndex,
  setCurrentExcludeProfileIndex,
}) => {
  const [editingDisplayNames, setEditingDisplayNames] = useState<number[]>([]);

  return (
    <div className="container p-3 mx-auto">
      <div className="mb-5 text-xl font-bold">Settings</div>
      <div className="mb-3 font-bold">Exclude repositories</div>
      <div className="mb-3">
        Add repository excludes here. <br />
        You can keep excludes in separate profiles that you can switch between from the top menu.
      </div>
      {excludeProfiles.map((profile, profileIndex) => {
        const excludes = profile.excludes;
        return (
          <div className="p-5 my-3 rounded-3xl bg-gray-200 dark:bg-gray-800" key={profileIndex}>
            <div
              className="mb-3 border-b-2 border-dotted border-b-slate-700"
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              {editingDisplayNames.includes(profileIndex) ? (
                <div>
                  <input
                    type="text"
                    value={profile.displayName}
                    onChange={(e) => {
                      setExcludeProfiles((old) => {
                        return [
                          ...old.slice(0, profileIndex),
                          { displayName: e.target.value, excludes: [...profile.excludes] },
                          ...old.slice(profileIndex + 1),
                        ];
                      });
                    }}
                    autoFocus
                    className="px-5 py-2 mb-3 border rounded-full dark:text-gray-300 dark:bg-black dark:bg-opacity-30 dark:border-opacity-0"
                  />
                  <button
                    onClick={() => setEditingDisplayNames((old) => old.filter((it) => it !== profileIndex))}
                    className="ml-3 hover:underline"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <span>{profile.displayName}</span>
              )}
              <div>
                {!editingDisplayNames.includes(profileIndex) && (
                  <button
                    className="mr-2 hover:underline"
                    onClick={() => setEditingDisplayNames((old) => [...old, profileIndex])}
                  >
                    Rename
                  </button>
                )}
                <button
                  className="mr-2 hover:underline"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete profile ${profile.displayName}?`)) {
                      setExcludeProfiles((old) => {
                        return [...old.slice(0, profileIndex), ...old.slice(profileIndex + 1)];
                      });
                      if (currentExcludeProfileIndex > profileIndex) {
                        setCurrentExcludeProfileIndex((old) => old - 1);
                      } else if (currentExcludeProfileIndex === profileIndex) {
                        setCurrentExcludeProfileIndex(() => 0);
                      }
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            {excludes.concat([""]).map((exclude, repoIndex) => {
              return (
                <div key={`${profileIndex}-${repoIndex}`}>
                  <input
                    type="text"
                    value={exclude}
                    onChange={(e) => {
                      setExcludeProfiles((old: ExcludeProfile[]) => {
                        let newExcludes = (old[profileIndex].excludes || []).slice();
                        newExcludes[repoIndex] = e.target.value;
                        newExcludes = newExcludes.filter((x) => x);
                        return [
                          ...old.slice(0, profileIndex),
                          { displayName: profile.displayName, excludes: newExcludes },
                          ...old.slice(profileIndex + 1),
                        ];
                      });
                    }}
                    style={{ width: 300 }}
                    className="px-5 py-2 mb-3 border rounded-full dark:text-gray-300 dark:bg-black dark:bg-opacity-30 dark:border-opacity-0"
                  />
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="p-5 my-3 rounded-3xl bg-gray-200 dark:bg-gray-800" key="add-new">
        <button
          onClick={() => {
            setEditingDisplayNames((old) => [...old, excludeProfiles.length]);
            setExcludeProfiles((old) => [...old, { displayName: "New profile", excludes: [] }]);
          }}
        >
          ⊕ Add profile
        </button>
      </div>
    </div>
  );
};
