import { createContext, useContext, useState, useCallback } from "react";

const NavActionsContext = createContext(null);

export function NavActionsProvider({ children }) {
  const [navActions, setNavActionsState] = useState(null);
  const [navCenter, setNavCenterState] = useState(null);

  const setNavActions = useCallback((node) => {
    setNavActionsState(node);
  }, []);

  const setNavCenter = useCallback((node) => {
    setNavCenterState(node);
  }, []);

  return (
    <NavActionsContext.Provider value={{ navActions, setNavActions, navCenter, setNavCenter }}>
      {children}
    </NavActionsContext.Provider>
  );
}

export const useNavActions = () => useContext(NavActionsContext);
