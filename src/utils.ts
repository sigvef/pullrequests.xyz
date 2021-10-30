import { useState } from "react";

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
