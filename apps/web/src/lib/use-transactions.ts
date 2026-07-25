"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { getMyTransactions, type Transaction } from "./api";

export function useTransactions(): Transaction[] | null {
  const { auth } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    getMyTransactions(auth.accessToken).then((result) => {
      if (!cancelled) setTransactions(result);
    });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return transactions;
}
