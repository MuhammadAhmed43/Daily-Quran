// Community tab = the Ameen wall (onyx). The implementation lives in app/ameen.tsx (also the /ameen route
// reached from Today); we re-export it so the tab and the route share one screen. At the tab root there is
// no back button (router.canGoBack() is false); from /ameen it shows one.
export { default } from '@/app/ameen';
