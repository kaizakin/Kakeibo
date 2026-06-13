---
name: optimistic-ui
description: Use this skill when building the frontend components for logging expenses or modifying group states.
---

# Optimistic UI Strategy for Ledgers

To ensure a seamless user experience, updates to group balances must appear instantly on the UI before the server confirms the mutation.

## Rules
1. **React Hooks:** Use Next.js App Router patterns alongside React’s `useOptimistic` hook.
2. **State Sync:** Instantly append the new expense item into the UI array with a temporary `isPending: true` flag. 
3. **Rollback Strategy:** If the underlying Server Action fails or returns an error, gracefully catch the rejection, display a toast notification, and trigger `useOptimistic` to automatically roll back the UI state to the previous ledger state.