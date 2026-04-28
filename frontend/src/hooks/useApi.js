import { useState, useCallback } from "react";
import axios from "axios";

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (method, url, data = null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios({ method, url, data });
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.error || "Error de conexión";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, request };
}
