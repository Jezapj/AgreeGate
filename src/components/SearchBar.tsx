"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "@/app/page.module.css";
import { SearchIcon, ArrowUpIcon } from "./icons";

interface SearchBarProps {
  initialValue?: string;
  loading?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
  onSearch: (query: string) => void;
}

export default function SearchBar({
  initialValue = "",
  loading = false,
  autoFocus = false,
  onSearch,
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q && !loading) onSearch(q);
  }

  return (
    <form className={styles.searchForm} onSubmit={handleSubmit} role="search">
      <div className={styles.searchWrap}>
        <SearchIcon className={styles.searchIcon} />
        <input
          ref={inputRef}
          className={styles.searchInput}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask real people anything…"
          aria-label="Search"
          autoComplete="off"
          spellCheck={false}
          maxLength={300}
        />
        <button
          className={styles.searchBtn}
          type="submit"
          disabled={loading || !value.trim()}
        >
          {loading ? "Searching" : "Search"}
          {!loading && <ArrowUpIcon size={15} />}
        </button>
      </div>
    </form>
  );
}
