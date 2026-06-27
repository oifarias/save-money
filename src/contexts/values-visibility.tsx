"use client";

import { createContext, useContext, useState } from "react";

type ValuesVisibilityContextType = {
  showValues: boolean;
  toggleVisibility: () => void;
};

const ValuesVisibilityContext = createContext<ValuesVisibilityContextType>({
  showValues: true,
  toggleVisibility: () => {},
});

export function ValuesVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [showValues, setShowValues] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = sessionStorage.getItem("showValues");
    return stored === null ? true : stored === "true";
  });

  function toggleVisibility() {
    setShowValues((prev) => {
      const next = !prev;
      sessionStorage.setItem("showValues", String(next));
      return next;
    });
  }

  return (
    <ValuesVisibilityContext.Provider value={{ showValues, toggleVisibility }}>
      {children}
    </ValuesVisibilityContext.Provider>
  );
}

export function useValuesVisibility() {
  return useContext(ValuesVisibilityContext);
}
