import { mismatch, matching, missing } from "./constants";

export const Legend = () => {
  return (
    <ul className="flex items-center gap-4 border border-slate-300 rounded-md px-4 py-2">
      <li>
        <span className="mr-1 text-sm font-medium">Matching</span>
        <span>{matching}</span>
      </li>
      <li>
        <span className="mr-1 text-sm font-medium">Missing</span>
        <span>{missing}</span>
      </li>
      <li>
        <span className="mr-1 text-sm font-medium">Mismatch</span>
        <span>{mismatch}</span>
      </li>
    </ul>
  );
};
