import { AllData } from "./api";
import { useLocalStorage } from "./utils";

export const Settings: React.FC<{ allData: AllData }> = () => {
  const [excludes, setExcludes] = useLocalStorage<string[]>("pullrequests.xyz_settings_excludes", []);

  return (
    <div className="container p-3 mx-auto">
      <div className="mb-5 text-xl font-bold">Settings</div>

      <div className="mb-3 font-bold">Exclude repositories</div>
      <div className="mb-3">Add repository excludes here.</div>

      {excludes.concat([""]).map((exclude, i) => {
        return (
          <div>
            <input
              type="text"
              value={exclude}
              onChange={(e) => {
                setExcludes((old: string[]) => {
                  let newValue = (old || []).slice();
                  newValue[i] = e.target.value;
                  newValue = newValue.filter((x) => x);
                  return newValue;
                });
              }}
              className="px-5 py-2 mb-3 border rounded-full dark:text-gray-300 dark:bg-black dark:bg-opacity-30 dark:border-opacity-0"
            />
          </div>
        );
      })}
    </div>
  );
};
