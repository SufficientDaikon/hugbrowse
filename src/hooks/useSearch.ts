import { useEffect, useRef } from "react";
import { useSearchStore } from "../stores/search";
import { useSettings } from "../stores/settings";

export function useSearch() {
  const { query, setQuery } = useSearchStore();
  const { addSearchHistory } = useSettings();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = (value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        addSearchHistory(value.trim());
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { query, handleSearch };
}
