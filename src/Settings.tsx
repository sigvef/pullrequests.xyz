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
              className="mb-3 px-3 py-1 border rounded-full"
            />
          </div>
        );
      })}
    </div>
  );
};
