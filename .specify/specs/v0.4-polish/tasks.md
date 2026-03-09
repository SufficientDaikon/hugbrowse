# v0.4-polish Implementation Tasks — Stories 1 & 2

## User Story 1 — Fix Critical Crashes & Rendering Bugs (P1)

- [X] T001 [P] [US1] Add rehype-raw and rehype-sanitize imports to `src/pages/ModelDetailPage.tsx`
- [X] T002 [P] [US1] Add `rehypePlugins={[rehypeRaw, rehypeSanitize]}` to ReactMarkdown in `src/pages/ModelDetailPage.tsx`
- [X] T003 [P] [US1] Fix null safety for `file.rfilename` in Files tab (`src/pages/ModelDetailPage.tsx`) — extract to `const filename = file.rfilename ?? ""`
- [X] T004 [P] [US1] Add rehype-raw and rehype-sanitize imports to `src/components/chat/ChatMessage.tsx`
- [X] T005 [P] [US1] Add `rehypePlugins={[rehypeRaw, rehypeSanitize]}` to ReactMarkdown in `src/components/chat/ChatMessage.tsx`

## User Story 2 — Contextual Layout & Navigation (P1)

- [X] T006 [P] [US2] Import `useLocation` from react-router-dom in `src/components/layout/AppShell.tsx`
- [X] T007 [P] [US2] Add `showSidebar` conditional based on `location.pathname === "/"`
- [X] T008 [P] [US2] Wrap `<Sidebar />` with `{showSidebar && <Sidebar />}`

## Verification

- [X] T009 TypeScript compilation passes (`npx tsc --noEmit` — exit code 0)
