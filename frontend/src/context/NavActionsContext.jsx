import { createContext, useContext, useState, useCallback } from "react";

const NavActionsContext = createContext(null);

export function NavActionsProvider({ children }) {
  const [navActions, setNavActionsState] = useState(null);

  const setNavActions = useCallback((node) => {
    setNavActionsState(node);
  }, []);

  return (
    <NavActionsContext.Provider value={{ navActions, setNavActions }}>
      {children}
    </NavActionsContext.Provider>
  );
}

export const useNavActions = () => useContext(NavActionsContext);
